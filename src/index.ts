import express, { Request, Response, NextFunction } from "express";
import bodyParser from "body-parser";
import axios from "axios";
import https from "https";
import dotenv from "dotenv";
import morgan from "morgan";

dotenv.config();

import { toBigInt, Wallet, TransactionRequest, Contract, Transaction } from "ethers";
import { createJSONRPCSuccessResponse, JSONRPCErrorException, isJSONRPCRequest, isJSONRPCID } from "json-rpc-2.0";
import { BundleParams } from "@flashbots/mev-share-client";
import MevShareClient from "@flashbots/mev-share-client";

import { initWallet, getProvider, env, getBaseFee, isEthSendBundleParams } from "./lib";
import { oevOracleAbi } from "./abi";
import { expressErrorHandler, processBundle } from "./handlers";

const agent = new https.Agent({ rejectUnauthorized: false }); // this might not be needed (and might add security risks in prod).

const app = express();
app.use(bodyParser.json());
app.use(morgan("tiny"));

const provider = getProvider();
const oevOracle = new Contract(env.oevOracle, oevOracleAbi);

// Start restful API server to listen for root inbound post requests.
app.post("/", async (req, res, next) => {
  try {
    const { url, method, body } = req;
    console.log(`\nReceived: ${method} ${url}`);
    console.log(`Body: ${JSON.stringify(body, null, 2)}`); // Pretty print JSON

    // If the request is a valid JSON RPC 2.0 eth_sendBundle method, process the bundle. The process Bundle function will
    // execute target specific modifications to the bundle depending on its structure.
    if (
      isJSONRPCRequest(body) &&
      isJSONRPCID(body.id) &&
      body.method == "eth_sendBundle" &&
      isEthSendBundleParams(body.params)
    ) {
      const processResult = processBundle(body.params[0].txs);
      if (processResult.foundOEVTransaction) {
        const { oevShare, refundAddress, processedTransactions } = processResult;
        console.log("discovered tx & modified payload! Sending unlock tx bundle and backrun bundle...");
        const targetBlock = parseInt(Number(body.params[0].blockNumber).toString());

        const { wallet, mevshare } = await initWallet(provider);

        // Send the call to OEVShare to unlock the latest value.
        const unlockTxHash = await sendUnlockLatestValue(
          wallet,
          mevshare,
          oevOracle,
          targetBlock,
          oevShare,
          refundAddress,
        );

        // Construct the bundle with the modified payload to backrun the UnlockLatestValue call.
        const bundle: BundleParams["body"] = [
          { hash: unlockTxHash },
          ...processedTransactions.map((tx): { tx: string; canRevert: boolean } => {
            return { tx, canRevert: false };
          }),
        ];

        const bundleParams: BundleParams = {
          inclusion: {
            block: targetBlock,
            maxBlock: targetBlock + env.blockRangeSize,
          },
          body: bundle,
        };

        console.log(`Forwarded a bundle with the following BundleParams: ${JSON.stringify(bundleParams, null, 2)}`);

        const backrunResult = await mevshare.sendBundle(bundleParams);

        res.status(200).send(createJSONRPCSuccessResponse(body.id, backrunResult));
        return; // Exit the function here to prevent the request from being forwarded to the FORWARD_URL.
      }
    }
    // Else, if we did not receive a valid eth_sendBundle or the handlers did not find a transaction payload to modify,
    // simply forward the request to the FORWARD_URL.
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
  oevOracle: Contract,
  targetBlock: number,
  oevShare: string,
  refundAddress: string,
) => {
  // Run concurrently to save a little time.
  const [nonce, baseFee, data, network] = await Promise.all([
    wallet.getNonce(),
    getBaseFee(provider),
    oevOracle.interface.encodeFunctionData("unlockLatestValue"),
    provider.getNetwork(),
  ]);

  // Construct transaction to call unlockLatestValue on OEVShare Oracle from permissioned address.
  const tx: TransactionRequest = {
    type: 2,
    chainId: network.chainId,
    to: oevShare, // Target is OEVShare Oracle used in the demo.
    nonce,
    value: 0,
    gasLimit: 200000,
    data,
    // Double the current base fee as a basic safe gas esimtate. We can make this more sophisticated in the future.
    maxFeePerGas: baseFee * 2n,
    maxPriorityFeePerGas: 0, // searcher should pay the full tip.
  };

  const signedTx = await wallet.signTransaction(tx);

  // Send this as a bundle. Define the max share hints and share 70% kickback to HoneyDao (demo contract).
  const bundleParams: BundleParams = {
    inclusion: { block: targetBlock, maxBlock: targetBlock + env.blockRangeSize },
    body: [{ tx: signedTx, canRevert: false }],
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
      builders: [
        "flashbots",
        "f1b.io",
        "rsync",
        "beaverbuild.org",
        "builder0x69",
        "Titan",
        "EigenPhi",
        "boba-builder",
        "Gambit Labs",
        "payload",
      ],
    },
  };

  console.log(`Unlock Latest Call bundle: ${JSON.stringify(bundleParams, null, 2)}`); // Pretty print JSON
  await mevshare.sendBundle(bundleParams);
  const hash = Transaction.from(signedTx).hash;
  if (!hash) throw new Error("No hash in signed unlock transaction");
  return hash;
};
