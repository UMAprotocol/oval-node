import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import https from "https";
import dotenv from "dotenv";
import morgan from "morgan";

dotenv.config();

import { keccak256, Wallet, TransactionRequest, Contract, Transaction } from "ethers";
import { createJSONRPCErrorResponse, createJSONRPCSuccessResponse, isJSONRPCRequest, isJSONRPCID } from "json-rpc-2.0";
import { BundleParams } from "@flashbots/mev-share-client";
import MevShareClient from "@flashbots/mev-share-client";

import {
  initWallet,
  getProvider,
  env,
  getBaseFee,
  isEthCallBundleParams,
  isEthSendBundleParams,
  ExtendedBundleParams,
  Logger,
} from "./lib";
import { ovalAbi } from "./abi";
import { expressErrorHandler, handleBundleSimulation, logSimulationErrors } from "./handlers";

const agent = new https.Agent({ rejectUnauthorized: false }); // this might not be needed (and might add security risks in prod).

const app = express();
app.use(bodyParser.json());
app.use(morgan("tiny"));

const provider = getProvider();
const { ovalAddress, refundAddress } = env;
const oval = new Contract(ovalAddress, ovalAbi);

// Start restful API server to listen for root inbound post requests.
app.post("/", async (req, res, next) => {
  try {
    const { url, method, body } = req;
    Logger.debug(`Received: ${method} ${url}`, { body });

    // If the request is a valid JSON RPC 2.0 eth_sendBundle method, prepend the unlock transaction.
    if (isJSONRPCRequest(body) && isJSONRPCID(body.id) && body.method == "eth_sendBundle") {
      if (!isEthSendBundleParams(body.params)) {
        Logger.info("Received unsupported eth_sendBundle request!", { body });
        res.status(200).send(createJSONRPCErrorResponse(req.body.id, -32000, "Unsupported eth_sendBundle params"));
        return;
      }

      Logger.debug("Received eth_sendBundle request! Sending unlock tx bundle and backrun bundle...", { body });

      const targetBlock = parseInt(Number(body.params[0].blockNumber).toString());

      const { wallet, mevshare, flashbotsBundleProvider } = await initWallet(provider);

      // Send the call to Oval to unlock the latest value.
      const { unlockBundleHash, signedUnlockTx } = await sendUnlockLatestValue(
        wallet,
        mevshare,
        oval,
        targetBlock,
        refundAddress,
      );

      // Construct the bundle with the modified payload to backrun the UnlockLatestValue call.
      const bundle: BundleParams["body"] = [
        { hash: unlockBundleHash },
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

      // We only log simulation errors for debugging, but proceed with bundle submission as the client is expected to
      // have simulated the bundle before broadcasting it.
      const simulationResponse = await flashbotsBundleProvider.simulate(
        [signedUnlockTx, ...body.params[0].txs],
        targetBlock,
      );
      logSimulationErrors(simulationResponse);

      const backrunResult = await mevshare.sendBundle(bundleParams);

      Logger.debug("Forwarded a bundle to MEV-Share", { bundleParams });

      res.status(200).send(createJSONRPCSuccessResponse(body.id, backrunResult));
      return; // Exit the function here to prevent the request from being forwarded to the FORWARD_URL.
    } else if (isJSONRPCRequest(body) && isJSONRPCID(body.id) && body.method == "eth_callBundle") {
      if (!isEthCallBundleParams(body.params)) {
        Logger.info("Received unsupported eth_callBundle request!", { body });
        res.status(200).send(createJSONRPCErrorResponse(req.body.id, -32000, "Unsupported eth_callBundle params"));
        return;
      }

      Logger.debug("Received eth_callBundle request! Simulating unlock tx and backrun bundle...", { body });

      const { wallet, flashbotsBundleProvider } = await initWallet(provider);

      // Sign the call to Oval to unlock the latest value.
      const { unlockTxHash, signedUnlockTx } = await createUnlockLatestValueTx(wallet, oval);

      const simulationResponse = await flashbotsBundleProvider.simulate(
        [signedUnlockTx, ...body.params[0].txs],
        body.params[0].blockNumber,
      );

      // Send back the simulation response without the unlock transaction.
      handleBundleSimulation(simulationResponse, unlockTxHash, req, res);
      return; // Exit the function here to prevent the request from being forwarded to the FORWARD_URL.
    }
    // Else, if we did not receive a valid eth_sendBundle or eth_callBundle, forward the request to the FORWARD_URL.
    Logger.debug(`Received unsupported request! Forwarding to ${env.forwardUrl} ...`, { body });
    const response = await axios({
      method: method as any,
      url: `${env.forwardUrl}`,
      headers: { ...req.headers, host: new URL(env.forwardUrl).hostname },
      data: body,
      httpsAgent: agent,
    });

    const { status, data } = response;

    res.status(status).send(data);
  } catch (error) {
    next(error);
  }
});

app.use(expressErrorHandler);

app.listen(3000, () => {
  Logger.info("Server is running on http://localhost:3000");
});

const createUnlockLatestValueTx = async (wallet: Wallet, oval: Contract) => {
  // Run concurrently to save a little time.
  const [nonce, baseFee, data, network, ovalAddress] = await Promise.all([
    wallet.getNonce(),
    getBaseFee(provider),
    oval.interface.encodeFunctionData("unlockLatestValue"),
    provider.getNetwork(),
    oval.getAddress(),
  ]);

  // Construct transaction to call unlockLatestValue on Oval Oracle from permissioned address.
  const unlockTx: TransactionRequest = {
    type: 2,
    chainId: network.chainId,
    to: ovalAddress, // Target is Oval Oracle used in the demo.
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

const sendUnlockLatestValue = async (
  wallet: Wallet,
  mevshare: MevShareClient,
  oval: Contract,
  targetBlock: number,
  refundAddress: string,
) => {
  const { unlockTxHash, signedUnlockTx } = await createUnlockLatestValueTx(wallet, oval);

  // Send this as a bundle. Define the max share hints and share kickback to HoneyDao (demo contract).
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
      wantRefund: env.refundPercent,
    },
  };

  Logger.debug("Unlock Latest Call bundle", { bundleParams });
  await mevshare.sendBundle(bundleParams);

  // MEV-Share is now referencing bundle hash as double hash of the transaction.
  const unlockBundleHash = keccak256(unlockTxHash);

  return { unlockBundleHash, signedUnlockTx };
};
