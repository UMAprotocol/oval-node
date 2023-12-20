import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import morgan from "morgan";

dotenv.config();

import { Wallet, TransactionRequest, Interface, Transaction } from "ethers";
import { FlashbotsBundleProvider } from "flashbots-ethers-v6-provider-bundle";
import { createJSONRPCSuccessResponse, isJSONRPCRequest, isJSONRPCID } from "json-rpc-2.0";
import { BundleParams } from "@flashbots/mev-share-client";
import MevShareClient from "@flashbots/mev-share-client";

import {
  getProvider,
  env,
  getBaseFee,
  initClients,
  initWallets,
  isEthCallBundleParams,
  isEthSendBundleParams,
  ExtendedBundleParams,
  Logger,
} from "./lib";
import { ovalAbi } from "./abi";
import {
  expressErrorHandler,
  handleBundleSimulation,
  handleUnsupportedRequest,
  originalBundleReverts,
} from "./handlers";

const app = express();
app.use(bodyParser.json());
app.use(morgan("tiny"));

const provider = getProvider();
const unlockerWallets = initWallets(provider);
const { ovalConfigs } = env;
const ovalInterface = Interface.from(ovalAbi);

// Start restful API server to listen for root inbound post requests.
app.post("/", async (req, res, next) => {
  try {
    const { url, method, body } = req;
    Logger.debug(`Received: ${method} ${url}`, { body });

    // If the request is a valid JSON RPC 2.0 eth_sendBundle method, prepend the unlock transaction.
    if (
      isJSONRPCRequest(body) &&
      isJSONRPCID(body.id) &&
      body.method == "eth_sendBundle" &&
      isEthSendBundleParams(body.params)
    ) {
      Logger.debug("Received eth_sendBundle request!", { body });

      const backrunTxs = body.params[0].txs;
      const targetBlock = parseInt(Number(body.params[0].blockNumber).toString());

      const { mevshare, flashbotsBundleProvider } = await initClients(provider);

      // Simulate the original bundle to check if it reverts without the unlock.
      const originalSimulationResponse = await flashbotsBundleProvider.simulate(backrunTxs, targetBlock);
      if (!originalBundleReverts(originalSimulationResponse)) {
        await handleUnsupportedRequest(req, res); // Pass through if the original bundle doesn't revert.
        return;
      }

      Logger.debug("Finding unlock that does not revert the bundle...");

      const unlock = await findUnlock(flashbotsBundleProvider, backrunTxs, targetBlock);
      if (!unlock) {
        Logger.debug("No valid unlock found!");
        await handleUnsupportedRequest(req, res); // Pass through if no unlock is found.
        return;
      }

      Logger.debug(`Found valid unlock at ${unlock.ovalAddress}. Sending unlock tx bundle and backrun bundle...`);

      // Send the call to Oval to unlock the latest value.
      await sendUnlockLatestValue(
        unlock.signedUnlockTx,
        ovalConfigs[unlock.ovalAddress].refundAddress,
        ovalConfigs[unlock.ovalAddress].refundPercent,
        mevshare,
        targetBlock,
      );

      // Construct the bundle with the modified payload to backrun the UnlockLatestValue call.
      const bundle: BundleParams["body"] = [
        { hash: unlock.unlockTxHash },
        ...body.params[0].txs.map((tx): { tx: string; canRevert: boolean } => {
          return { tx, canRevert: false };
        }),
      ];

      const bundleParams: BundleParams = {
        inclusion: {
          block: targetBlock,
          maxBlock: targetBlock + env.blockRangeSize,
        },
        body: bundle,
        privacy: {
          builders: env.builders,
        },
      };

      const backrunResult = await mevshare.sendBundle(bundleParams);

      Logger.debug("Forwarded a bundle to MEV-Share", { bundleParams });

      res.status(200).send(createJSONRPCSuccessResponse(body.id, backrunResult));
    } else if (
      isJSONRPCRequest(body) &&
      isJSONRPCID(body.id) &&
      body.method == "eth_callBundle" &&
      isEthCallBundleParams(body.params)
    ) {
      Logger.debug("Received eth_callBundle request!", { body });

      const backrunTxs = body.params[0].txs;
      const targetBlock = parseInt(Number(body.params[0].blockNumber).toString());

      const { flashbotsBundleProvider } = await initClients(provider);

      // Simulate the original bundle to check if it reverts without the unlock.
      const originalSimulationResponse = await flashbotsBundleProvider.simulate(backrunTxs, targetBlock);
      if (!originalBundleReverts(originalSimulationResponse)) {
        await handleUnsupportedRequest(req, res); // Pass through if the original bundle doesn't revert.
        return;
      }

      Logger.debug("Finding unlock that does not revert the bundle...");

      const unlock = await findUnlock(flashbotsBundleProvider, backrunTxs, targetBlock);
      if (!unlock) {
        Logger.debug("No valid unlock found!");
        await handleUnsupportedRequest(req, res); // Pass through if no unlock is found.
        return;
      }

      Logger.debug(`Found valid unlock at ${unlock.ovalAddress}. Simulating unlock tx bundle and backrun bundle...`);

      const simulationResponse = await flashbotsBundleProvider.simulate(
        [unlock.signedUnlockTx, ...backrunTxs],
        targetBlock,
      );

      // Send back the simulation response without the unlock transaction.
      handleBundleSimulation(simulationResponse, unlock.unlockTxHash, req, res);
    } else await handleUnsupportedRequest(req, res);
  } catch (error) {
    next(error);
  }
});

app.use(expressErrorHandler);

app.listen(3000, () => {
  Logger.info("Server is running on http://localhost:3000");
});

const createUnlockLatestValueTx = async (
  wallet: Wallet,
  baseFee: bigint,
  data: string,
  chainId: bigint,
  ovalAddress: string,
) => {
  const nonce = await wallet.getNonce();

  // Construct transaction to call unlockLatestValue on Oval Oracle from permissioned address.
  const unlockTx: TransactionRequest = {
    type: 2,
    chainId,
    to: ovalAddress,
    nonce,
    value: 0,
    gasLimit: 200000,
    data,
    // Double the current base fee as a basic safe gas esimtate. We can make this more sophisticated in the future.
    maxFeePerGas: baseFee * 2n,
    maxPriorityFeePerGas: 0, // searcher should pay the full tip.
  };

  const signedUnlockTx = await wallet.signTransaction(unlockTx);

  const unlockTxHash = Transaction.from(signedUnlockTx).hash;
  if (!unlockTxHash) throw new Error("No hash in signed unlock transaction");

  return { unlockTxHash, signedUnlockTx };
};

// Simulate calls to unlockLatestValue on each Oval instance bundled with original backrun transactions. Tries to find
// the first unlock that doesn't revert the bundle.
const findUnlock = async (
  flashbotsBundleProvider: FlashbotsBundleProvider,
  backrunTxs: string[],
  targetBlock: number,
) => {
  const [baseFee, network] = await Promise.all([getBaseFee(provider), provider.getNetwork()]);
  const data = ovalInterface.encodeFunctionData("unlockLatestValue");

  const unlocks = await Promise.all(
    Object.keys(ovalConfigs).map(async (ovalAddress) => {
      const { unlockTxHash, signedUnlockTx } = await createUnlockLatestValueTx(
        unlockerWallets[ovalAddress],
        baseFee,
        data,
        network.chainId,
        ovalAddress,
      );

      const simulationResponse = await flashbotsBundleProvider.simulate([signedUnlockTx, ...backrunTxs], targetBlock);

      return { ovalAddress, unlockTxHash, signedUnlockTx, simulationResponse };
    }),
  );

  // Find the first unlock that doesn't revert.
  return unlocks.find((unlock) => !("error" in unlock.simulationResponse) && !unlock.simulationResponse.firstRevert);
};

const sendUnlockLatestValue = async (
  signedUnlockTx: string,
  refundAddress: string,
  refundPercent: number,
  mevshare: MevShareClient,
  targetBlock: number,
) => {
  // Send this as a bundle. Define the max share hints and share kickback to configured refund address.
  const bundleParams: ExtendedBundleParams = {
    inclusion: { block: targetBlock, maxBlock: targetBlock + env.blockRangeSize },
    body: [{ tx: signedUnlockTx, canRevert: false }],
    validity: {
      refundConfig: [
        {
          address: refundAddress,
          percent: 100,
        },
      ],
    },
    privacy: {
      hints: {
        calldata: true,
        logs: true,
        contractAddress: true,
        functionSelector: true,
        txHash: true,
      },
      builders: env.builders,
      wantRefund: refundPercent,
    },
  };

  Logger.debug("Unlock Latest Call bundle", { bundleParams });
  await mevshare.sendBundle(bundleParams);
};
