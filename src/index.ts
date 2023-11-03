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

const agent = new https.Agent({ rejectUnauthorized: false }); // this might not be needed (and might add security risks in prod).

const app = express();
app.use(bodyParser.json());
app.use(morgan("tiny"));

const provider = getProvider();
const oevOracle = new Contract(env.oevOracle, oevOracleAbi);

// Start restful API server to listen for all inbound requests.
app.all("*", async (req, res) => {
  const { url, method, body } = req;
  console.log(`\nReceived: ${method} ${url}`);
  console.log(`Body: ${JSON.stringify(body, null, 2)}`); // Pretty print JSON

  // If the request is an eth_sendBundle, process the bundle. The process Bundle function will execute target specific
  // modifications to the bundle depending on its structure.
  if (body.method == "eth_sendBundle") {
    const { processedTransactions, processedBundle, oevShare, refundAddress } = processBundle(body.params[0].txs);
    if (processedBundle) {
      console.log("discovered tx & modified payload! Sending unlock tx bundle and backrun bundle...");
      body.params[0].txs = processedTransactions;
      const targetBlock = parseInt(Number(body.params[0].blockNumber).toString());

      const { wallet, mevshare } = await initWallet(provider);

      // Send the call to OEVShare to unlock the latest value.
      const updateTx = await sendUnlockLatestValue(wallet, mevshare, oevOracle, targetBlock, oevShare, refundAddress);

      // Construct the bundle with the modified payload to backrun the UnlockLatestValue call.
      const bundle: Array<{ hash: string } | { tx: string; canRevert: boolean }> = [
        { hash: updateTx },
        ...processedTransactions.map((tx): { tx: string; canRevert: boolean } => {
          return { tx, canRevert: false };
        }),
      ];

      const bundleParams: BundleParams = {
        inclusion: {
          block: targetBlock,
          maxBlock: targetBlock + 25,
        },
        body: bundle,
      };

      console.log(`Forwarded a bundle with the following BundleParams: ${JSON.stringify(bundleParams, null, 2)}`);

      const backrunResult = await mevshare.sendBundle(bundleParams);

      res.status(200).send({ jsonrpc: "2.0", id: body.id, result: backrunResult });
      return;
    }
  }
  // Else, if we did not it an eth_sendBundle or the handelers did not find a transaction payload to modify, simply
  // forward the request to the FORWARD_URL.
  try {
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
    console.error("There was an error produced against body", body);
    console.error("error", error);
    res.status(500).send("Internal Server Error");
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
  oevShare: string,
  refundAddress: string,
) => {
  // Construct transaction to call unlockLatestValue on OEVShare Oracle from permissioned address.
  const tx: TransactionRequest = {
    type: 2,
    chainId: provider._network.chainId,
    to: oevShare, // Target is OEVShare Oracle used in the demo.
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
          address: refundAddress,
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
  if (!hash) throw new Error("No hash returned from sendBundle");
  return hash;
};
