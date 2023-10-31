import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import https from "https";
import dotenv from "dotenv";
import morgan from "morgan";

dotenv.config();

import { toBigInt, Wallet, TransactionRequest, Contract, Transaction } from "ethers";
import { BundleParams } from "@flashbots/mev-share-client";
import MevShareClient from "@flashbots/mev-share-client";

import { initWallet, getProvider, env } from "./lib";
import { oevOracleAbi } from "./abi";

import { processBundle } from "./handlers";

const agent = new https.Agent({ rejectUnauthorized: false });

const provider = getProvider();
const oevOracle = new Contract(env.oevOracle, oevOracleAbi);

const app = express();
app.use(bodyParser.json());
app.use(morgan("tiny"));

app.all("*", async (req, res) => {
  const { url, method, body } = req;

  console.log(`\nReceived: ${method} ${url}`);
  console.log(`Body: ${JSON.stringify(body, null, 2)}`); // Pretty print JSON

  const forwardUrl = process.env.FORWARD_URL || "https://relay.flashbots.net";

  if (!forwardUrl) {
    console.error("FORWARD_URL is not defined");
    res.status(500).send("Internal Server Error");
    return;
  }

  let processedBundle = false;
  console.log("body.method", body.method);
  if (body.method == "eth_sendBundle")
    ({ processed: body.params[0].txs, processedBundle } = processBundle(body.params[0].txs));

  console.log("body.params[0] after", body.params[0]);

  if (processedBundle) {
    console.log("discovered tx & modified payload! Sending unlock tx bundle and backrun bundle...");
    const targetBlock = parseInt(Number(body.params[0].blockNumber).toString());

    const { wallet, mevshare } = await initWallet(provider);

    // Send the call to OEVShare to unlock the latest value.
    const updateTx = await sendUnlockLatestValue(wallet, mevshare, oevOracle, targetBlock);

    // Construct the bundle with the modified payload to backrun the UnlockLatestValue call.
    const bundle = [
      { hash: updateTx },
      ...body.params[0].txs.map((tx: any) => {
        return { tx: tx, canRevert: false };
      }),
    ];

    const bundleParams: BundleParams = {
      inclusion: {
        block: targetBlock,
        maxBlock: targetBlock + 25,
      },
      body: bundle,
    };

    console.log(`BundleParams: ${JSON.stringify(bundleParams, null, 2)}`);

    const backrunResult = await mevshare.sendBundle(bundleParams);

    console.log(`BackrunResult: ${JSON.stringify(backrunResult, null, 2)}`); // Pretty print JSON
    res.status(200).send({ jsonrpc: "2.0", id: body.id, result: backrunResult });
  } else {
    // Else, if we did not it an eth_sendBundle or the handelers did not find a transaction payload to modify, simply
    // forward the request to the FORWARD_URL.
    try {
      const response = await axios({
        method: method as any,
        url: `${forwardUrl}`,
        headers: { ...req.headers, host: new URL(forwardUrl).hostname },
        data: body,
        httpsAgent: agent,
      });

      const { status, data } = response;

      console.log(`\nResponse: Status ${status}`);
      console.log(`Data: ${JSON.stringify(data, null, 2)}`); // Pretty print JSON
      res.status(status).send(data);
    } catch (error) {
      console.error("There was an error produced against body", body);
      console.error("error", error);
      res.status(500).send("Internal Server Error");
    }
  }
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});

export const sendUnlockLatestValue = async (
  wallet: Wallet,
  mevshare: MevShareClient,
  oevOracle: Contract,
  targetBlock: number,
) => {
  // Construct transaction to call unlockLatestValue on OEVShare Oracle from permissioned address.
  const tx: TransactionRequest = {
    type: 2,
    chainId: provider._network.chainId,
    to: "0xb3cAcdC722470259886Abb57ceE1fEA714e86387", // Target is OEVShare Oracle used in the demo.
    nonce: await wallet.getNonce(),
    value: 0,
    gasLimit: 200000,
    data: await oevOracle.interface.encodeFunctionData("unlockLatestValue"),
    maxFeePerGas: toBigInt(50e9),
    maxPriorityFeePerGas: 0, // searcher should pay the full tip.
  };

  const signedTx = await wallet.signTransaction(tx);

  // Send this as a bundle. Define the max share hints and share 70% kickback to HoneyDao (demo contract).
  const bundleParams: BundleParams = {
    inclusion: { block: targetBlock, maxBlock: targetBlock + 25 },
    body: [{ tx: signedTx, canRevert: false }],
    validity: {
      refundConfig: [
        {
          address: "0xe4d0cC1976D637d01eC8d4429e8cA6F96254654b",
          percent: 70,
        },
      ],
    },
    privacy: {
      hints: {
        calldata: true,
        logs: true,
        contractAddress: true,
        functionSelector: true,
        defaultLogs: true,
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
  return Transaction.from(signedTx).hash;
};
