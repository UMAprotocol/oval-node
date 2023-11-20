import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import https from "https";
import dotenv from "dotenv";
import morgan from "morgan";

dotenv.config();

import { Wallet, TransactionRequest, Contract, Transaction } from "ethers";
import { createJSONRPCSuccessResponse, isJSONRPCRequest, isJSONRPCID } from "json-rpc-2.0";
import { BundleParams } from "@flashbots/mev-share-client";
import MevShareClient from "@flashbots/mev-share-client";

import { initWallet, getProvider, env, getBaseFee, isEthSendBundleParams } from "./lib";
import { oevShareAbi } from "./abi";
import { expressErrorHandler, logSimulationErrors } from "./handlers";

const agent = new https.Agent({ rejectUnauthorized: false }); // this might not be needed (and might add security risks in prod).

const app = express();
app.use(bodyParser.json());
app.use(morgan("tiny"));

const provider = getProvider();
const { oevShareAddress, refundAddress } = env;
const oevShare = new Contract(oevShareAddress, oevShareAbi);

// Start restful API server to listen for root inbound post requests.
app.post("/", async (req, res, next) => {
  try {
    const { url, method, body } = req;
    console.log(`\nReceived: ${method} ${url}`);
    console.log(`Body: ${JSON.stringify(body, null, 2)}`); // Pretty print JSON

    // If the request is a valid JSON RPC 2.0 eth_sendBundle method, prepend the unlock transaction.
    if (
      isJSONRPCRequest(body) &&
      isJSONRPCID(body.id) &&
      body.method == "eth_sendBundle" &&
      isEthSendBundleParams(body.params)
    ) {
      console.log("discovered tx & modified payload! Sending unlock tx bundle and backrun bundle...");
      const targetBlock = parseInt(Number(body.params[0].blockNumber).toString());

      const { wallet, mevshare, flashbotsBundleProvider } = await initWallet(provider);

      // Send the call to OEVShare to unlock the latest value.
      const { unlockTxHash, signedUnlockTx } = await sendUnlockLatestValue(
        wallet,
        mevshare,
        oevShare,
        targetBlock,
        oevShareAddress,
        refundAddress,
      );

      // Construct the bundle with the modified payload to backrun the UnlockLatestValue call.
      const bundle: BundleParams["body"] = [
        { hash: unlockTxHash },
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

      // Currently we only log simulation errors for debugging. We still proceed with bundle submission as some errors
      // can be recovered by the operator (e.g. provide funding to accounts).
      await logSimulationErrors(flashbotsBundleProvider, [signedUnlockTx, ...body.params[0].txs],targetBlock);

      console.log(`Forwarded a bundle with the following BundleParams: ${JSON.stringify(bundleParams, null, 2)}`);

      const backrunResult = await mevshare.sendBundle(bundleParams);

      res.status(200).send(createJSONRPCSuccessResponse(body.id, backrunResult));
      return; // Exit the function here to prevent the request from being forwarded to the FORWARD_URL.
    }
    // Else, if we did not receive a valid eth_sendBundle, simply forward the request to the FORWARD_URL.
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
  console.log("Server is running on http://localhost:3000");
});

export const sendUnlockLatestValue = async (
  wallet: Wallet,
  mevshare: MevShareClient,
  oevShare: Contract,
  targetBlock: number,
  oevShareAddress: string,
  refundAddress: string,
) => {
  // Run concurrently to save a little time.
  const [nonce, baseFee, data, network] = await Promise.all([
    wallet.getNonce(),
    getBaseFee(provider),
    oevShare.interface.encodeFunctionData("unlockLatestValue"),
    provider.getNetwork(),
  ]);

  // Construct transaction to call unlockLatestValue on OEVShare Oracle from permissioned address.
  const tx: TransactionRequest = {
    type: 2,
    chainId: network.chainId,
    to: oevShareAddress, // Target is OEVShare Oracle used in the demo.
    nonce,
    value: 0,
    gasLimit: 200000,
    data,
    // Double the current base fee as a basic safe gas esimtate. We can make this more sophisticated in the future.
    maxFeePerGas: baseFee * 2n,
    maxPriorityFeePerGas: 0, // searcher should pay the full tip.
  };

  const signedUnlockTx = await wallet.signTransaction(tx);

  // Send this as a bundle. Define the max share hints and share 70% kickback to HoneyDao (demo contract).
  const bundleParams: BundleParams = {
    inclusion: { block: targetBlock, maxBlock: targetBlock + env.blockRangeSize },
    body: [{ tx: signedUnlockTx, canRevert: false }],
    validity: {
      refundConfig: [
        {
          address: refundAddress,
          percent: env.refundPercent,
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

  console.log(`Unlock Latest Call bundle: ${JSON.stringify(bundleParams, null, 2)}`); // Pretty print JSON
  await mevshare.sendBundle(bundleParams);
  const unlockTxHash = Transaction.from(signedUnlockTx).hash;
  if (!unlockTxHash) throw new Error("No hash in signed unlock transaction");
  return { unlockTxHash, signedUnlockTx };
};
