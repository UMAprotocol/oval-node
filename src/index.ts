import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import https from "https";
import dotenv from "dotenv";
import morgan from "morgan";

dotenv.config();

import {
  toBigInt,
  JsonRpcProvider,
  TransactionRequest,
  Contract,
  Transaction,
} from "ethers";
import { HintPreferences, BundleParams } from "@flashbots/mev-share-client";

import { initWallet, getProvider } from "./lib/helpers";
import env from "./lib/env";
import { oevOracleAbi } from "./abi/OevOracle";

const agent = new https.Agent({
  rejectUnauthorized: false,
});

const provider = getProvider();
const oevOracle = new Contract(env.oevOracle, oevOracleAbi, provider);

const app = express();
app.use(bodyParser.json());
app.use(morgan("tiny"));

const NUM_TARGET_BLOCKS = 25;

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
  console.log("body.method", body.method);

  let discoveredTx = false;
  if (body.method == "eth_sendBundle") {
    console.log("body.params[0] before", body.params[0]);
    for (const [index, tx] of body.params[0].txs.entries()) {
      const target = Transaction.from(tx);
      console.log("looking at tx", target.hash, "to", target.to);
      if (target.to === env.oevOracle) {
        discoveredTx = true;
        delete body.params[0].txs[index];
      }
    }
    body.params[0].txs = body.params[0].txs.filter(Boolean);
    console.log("body.params[0] after", body.params[0]);
  }

  if (discoveredTx) {
    console.log("discovered tx! modifying payload and sending unlock tx");
    const updateTx = await sendUpdateTx(provider, oevOracle);
    console.log("update tx", updateTx);

    const bundle = [
      { hash: updateTx },
      ...body.params[0].txs.map((tx: any) => {
        return { tx: tx, canRevert: true };
      }),
    ];

    console.log(
      `sending backrun bundles targeting next ${NUM_TARGET_BLOCKS} blocks...`
    );
    console.log("bundle", bundle);
    const targetBlock = parseInt(Number(body.params[0].blockNumber).toString());
    console.log("MEV-share targetBlock", targetBlock);
    const bundleParams: BundleParams = {
      inclusion: {
        block: targetBlock,
        maxBlock: targetBlock + NUM_TARGET_BLOCKS,
      },
      body: bundle,
    };

    console.log(`BundleParams: ${JSON.stringify(bundleParams, null, 2)}`); // Pretty print JSON
    const { mevshare } = await initWallet(provider);
    const backrunResult = await mevshare.sendBundle(bundleParams);
    console.log(`BackrunResult: ${JSON.stringify(backrunResult, null, 2)}`); // Pretty print JSON
    res
      .status(200)
      .send({ jsonrpc: "2.0", id: body.id, result: backrunResult });
  } else {
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

export const sendUpdateTx = async (
  provider: JsonRpcProvider,
  oevOracle: Contract,
  maxBlockNumber?: number,
  tip?: BigInt
) => {
  const { wallet, feeData, mevshare } = await initWallet(provider);
  const tipActual = tip ? tip.valueOf() : BigInt(0);

  console.log("sending unlock tx from", wallet.address);
  const tx: TransactionRequest = {
    type: 2,
    chainId: provider._network.chainId,
    to: await oevOracle.getAddress(),
    nonce: await wallet.getNonce(),
    value: 0,
    gasLimit: 200000,
    data: await oevOracle.interface.encodeFunctionData("decimals"),
    maxFeePerGas: toBigInt(50e9),
    maxPriorityFeePerGas: toBigInt(1e9),
  };

  console.log("TX", tx);

  const signedTx = await wallet.signTransaction(tx);

  const hints: HintPreferences = {
    calldata: true,
    logs: true,
    contractAddress: true,
    functionSelector: true,
  };
  return await mevshare.sendTransaction(signedTx, {
    hints,
    maxBlockNumber,
    // builders: [
    //   "builder0x69",
    //   "boba-builder",
    //   "gambit+labs",
    //   "eigenphi",
    //   "rsync",
    //   "flashbots",
    //   "f1b.io",
    //   "beaverbuild.org",
    //   "titan",
    //   "payload",
    // ],
  });
};
