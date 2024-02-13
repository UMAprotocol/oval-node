import express, { Request } from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import morgan from "morgan";
import { v4 as uuidv4 } from 'uuid';
import './lib/express-extensions';

dotenv.config();

import { Wallet, TransactionRequest, Interface, Transaction } from "ethers";
import { FlashbotsBundleProvider } from "flashbots-ethers-v6-provider-bundle";
import { createJSONRPCErrorResponse, createJSONRPCSuccessResponse, isJSONRPCRequest, isJSONRPCID } from "json-rpc-2.0";
import { BundleParams } from "@flashbots/mev-share-client";

import {
  getProvider,
  env,
  getBaseFee,
  initClients,
  initWallets,
  isEthCallBundleParams,
  isEthSendBundleParams,
  Logger,
  verifyBundleSignature,
  getMaxBlockByChainId,
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
app.use((req, res, next) => {
  req.transactionId = uuidv4();
  next();
});

const provider = getProvider();
const unlockerWallets = initWallets(provider);
const { ovalConfigs } = env;
const ovalInterface = Interface.from(ovalAbi);

// Start restful API server to listen for root inbound post requests.
app.post("/", async (req, res, next) => {
  try {
    const { url, method, body } = req;
    Logger.debug(req.transactionId, `Received: ${method} ${url}`, { body });

    if (!isJSONRPCRequest(body) || !isJSONRPCID(body.id)) {
      await handleUnsupportedRequest(req, res);
      return;
    }

    // Verify that the signature in the request headers matches the bundle payload.
    const verifiedSignatureSearcherPkey = verifyBundleSignature(body, req.headers["x-flashbots-signature"], req);

    // Prepend the unlock transaction if the request is a valid JSON RPC 2.0 'eth_sendBundle' method with a valid bundle signature.
    if (verifiedSignatureSearcherPkey && body.method == "eth_sendBundle") {
      if (!isEthSendBundleParams(body.params)) {
        Logger.info(req.transactionId, "Received unsupported eth_sendBundle request!", { body });
        res.status(200).send(createJSONRPCErrorResponse(body.id, -32000, "Unsupported eth_sendBundle params"));
        return;
      }

      Logger.debug(req.transactionId, "Received eth_sendBundle request!", { body });

      const backrunTxs = body.params[0].txs;
      const targetBlock = parseInt(Number(body.params[0].blockNumber).toString());

      const { mevshare, flashbotsBundleProvider } = await initClients(provider, verifiedSignatureSearcherPkey);

      // If configured, simulate the original bundle to check if it reverts without the unlock.
      if (env.passThroughNonReverting) {
        const originalSimulationResponse = await flashbotsBundleProvider.simulate(backrunTxs, targetBlock);
        if (!originalBundleReverts(originalSimulationResponse, req)) {
          await handleUnsupportedRequest(req, res); // Pass through if the original bundle doesn't revert.
          return;
        }
      }

      Logger.debug(req.transactionId, "Finding unlock that does not revert the bundle...");

      const unlock = await findUnlock(flashbotsBundleProvider, backrunTxs, targetBlock, req);
      if (!unlock) {
        Logger.debug(req.transactionId, "No valid unlock found!");
        await handleUnsupportedRequest(req, res); // Pass through if no unlock is found.
        return;
      }

      // Dynamically adjust refund percent so that builder nets at least configured minimum. We don't need to consider
      // refund gas costs as the builder is deducting them from refund and should not include the bundle if refund gas
      // costs exceed refund value.
      const adjustedRefundPercent = adjustRefundPercent(
        unlock.simulationResponse.coinbaseDiff,
        ovalConfigs[unlock.ovalAddress].refundPercent,
      );
      if (adjustedRefundPercent <= 0) {
        Logger.debug(req.transactionId, `Insufficient builder payment ${unlock.simulationResponse.coinbaseDiff}`);
        await handleUnsupportedRequest(req, res); // Pass through as minimum payment not met.
        return;
      }

      Logger.debug(req.transactionId, `Found valid unlock at ${unlock.ovalAddress}. Sending unlock tx bundle and backrun bundle...`);

      // Construct the inner bundle with call to Oval to unlock the latest value.
      const unlockBundle = createUnlockLatestValueBundle(
        unlock.signedUnlockTx,
        ovalConfigs[unlock.ovalAddress].refundAddress,
        targetBlock,
      );

      // Construct the outer bundle with the modified payload to backrun the UnlockLatestValue call.
      const bundle: BundleParams["body"] = [
        { bundle: unlockBundle },
        ...backrunTxs.map((tx): { tx: string; canRevert: boolean } => {
          return { tx, canRevert: false };
        }),
      ];

      const bundleParams: BundleParams = {
        inclusion: {
          block: targetBlock,
          maxBlock: getMaxBlockByChainId(env.chainId, targetBlock),
        },
        body: bundle,
        privacy: {
          builders: env.builders,
        },
        validity: {
          refund: [{ bodyIdx: 0, percent: adjustedRefundPercent }],
        },
      };

      const backrunResult = await mevshare.sendBundle(bundleParams);

      Logger.debug(req.transactionId, "Forwarded a bundle to MEV-Share", { bundleParams });
      Logger.info(req.transactionId, "Bundle accepted by MEV-Share", { bundleHash: backrunResult.bundleHash });

      res.status(200).send(createJSONRPCSuccessResponse(body.id, backrunResult));
      return; // Exit the function here to prevent the request from being forwarded to the FORWARD_URL.
    } else if (verifiedSignatureSearcherPkey && body.method == "eth_callBundle") {
      if (!isEthCallBundleParams(body.params)) {
        Logger.info(req.transactionId, "Received unsupported eth_callBundle request!", { body });
        res.status(200).send(createJSONRPCErrorResponse(body.id, -32000, "Unsupported eth_callBundle params"));
        return;
      }

      Logger.debug(req.transactionId, "Received eth_callBundle request!", { body });

      const backrunTxs = body.params[0].txs;
      const targetBlock = parseInt(Number(body.params[0].blockNumber).toString());

      const { flashbotsBundleProvider } = await initClients(provider, verifiedSignatureSearcherPkey);

      // If configured, simulate the original bundle to check if it reverts without the unlock.
      if (env.passThroughNonReverting) {
        const originalSimulationResponse = await flashbotsBundleProvider.simulate(backrunTxs, targetBlock);
        if (!originalBundleReverts(originalSimulationResponse, req)) {
          await handleUnsupportedRequest(req, res); // Pass through if the original bundle doesn't revert.
          return;
        }
      }

      Logger.debug(req.transactionId, "Finding unlock that does not revert the bundle...");

      const unlock = await findUnlock(flashbotsBundleProvider, backrunTxs, targetBlock, req);
      if (!unlock) {
        Logger.debug(req.transactionId, "No valid unlock found!");
        await handleUnsupportedRequest(req, res); // Pass through if no unlock is found.
        return;
      }

      Logger.debug(req.transactionId, `Found valid unlock at ${unlock.ovalAddress}. Simulating unlock tx bundle and backrun bundle...`);

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

// Health check endpoint.
app.get("/ready", (req, res) => {
  res.status(200).send("OK");
});

app.use(expressErrorHandler);

app.listen(env.port, () => {
  Logger.debug("Startup", `Server is running on port ${env.port}`);
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
    // Double the current base fee as a basic safe gas estimate. We can make this more sophisticated in the future.
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
  req: express.Request,
) => {
  const [baseFee, network] = await Promise.all([getBaseFee(provider, req), provider.getNetwork()]);
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
  for (const unlock of unlocks) {
    if (!("error" in unlock.simulationResponse) && !unlock.simulationResponse.firstRevert) {
      return {
        // Spread in order to preserve inferred SimulationResponseSuccess type.
        ...unlock,
        simulationResponse: unlock.simulationResponse,
      };
    }
  }

  return undefined;
};

const createUnlockLatestValueBundle = (signedUnlockTx: string, refundAddress: string, targetBlock: number) => {
  // Create this as a bundle. Define the max share hints and share kickback to configured refund address.
  const bundleParams: BundleParams = {
    inclusion: { block: targetBlock, maxBlock: getMaxBlockByChainId(env.chainId, targetBlock) },
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
    },
  };

  return bundleParams;
};

// Adjusts refund percent to ensure that net builder captured value reaches the minimum configured amount.
// This can still return 0 if gross builder payment is not sufficient and caller should handle this.
const adjustRefundPercent = (grossBuilderPayment: bigint, originalRefundPercent: number) => {
  // Require positive builder payment that covers at least minNetBuilderPaymentWei.
  if (grossBuilderPayment <= 0 || grossBuilderPayment < env.minNetBuilderPaymentWei) return 0;

  // No need for scaling as Flashbots accepts only integer refund percent value.
  const maxRefundPercent = Number(((grossBuilderPayment - env.minNetBuilderPaymentWei) * 100n) / grossBuilderPayment);

  // Bound adjusted refund percent by maxRefundPercent.
  return Math.min(originalRefundPercent, maxRefundPercent);
};
