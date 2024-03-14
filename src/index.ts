import bodyParser from "body-parser";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import { v4 as uuidv4 } from "uuid";
import "./lib/express-extensions";

dotenv.config();

import { BundleParams } from "@flashbots/mev-share-client";
import { createJSONRPCErrorResponse, isJSONRPCID, isJSONRPCRequest } from "json-rpc-2.0";

import {
  expressErrorHandler,
  handleBundleSimulation,
  handleUnsupportedRequest,
  originalBundleReverts,
} from "./handlers";
import {
  FLASHBOTS_SIGNATURE_HEADER,
  Logger,
  OVAL_CONFIG_HEADER,
  Refund,
  adjustRefundPercent,
  calculateBundleRefunds,
  createUnlockLatestValueBundle,
  env,
  findUnlock,
  getOvalHeaderConfigs,
  getProvider,
  getUnlockBundlesFromOvalAddresses,
  initClients,
  isEthCallBundleParams,
  isEthSendBundleParams,
  sendBundle,
  verifyBundleSignature
} from "./lib";

const app = express();
app.use(bodyParser.json());
app.use(morgan("tiny"));
app.use((req, res, next) => {
  req.transactionId = uuidv4();
  next();
});

const provider = getProvider();
const { ovalConfigs } = env;

// Start restful API server to listen for root inbound post requests.
app.post("/", async (req, res, next) => {
  try {
    const { url, method, body } = req;
    Logger.debug(req.transactionId, `Received: ${method} ${url}`, { body });

    if (!isJSONRPCRequest(body) || !isJSONRPCID(body.id)) {
      await handleUnsupportedRequest(req, res, "Invalid JSON RPC request");
      return;
    }

    // Verify that the signature in the request headers matches the bundle payload.
    const verifiedSignatureSearcherPkey = verifyBundleSignature(body, req.headers[FLASHBOTS_SIGNATURE_HEADER], req);

    // Get Oval header configs if present.
    const { valid, ovalHeaderConfigs } = getOvalHeaderConfigs(req.headers[OVAL_CONFIG_HEADER], ovalConfigs);
    if (!valid) {
      await handleUnsupportedRequest(req, res, "Error parsing Oval header configs");
      return;
    }

    // Prepend the unlock transaction if the request is a valid JSON RPC 2.0 'eth_sendBundle' method with a valid bundle signature.
    if (verifiedSignatureSearcherPkey && body.method == "eth_sendBundle") {
      if (!isEthSendBundleParams(body.params)) {
        Logger.debug(req.transactionId, "Received unsupported eth_sendBundle request!", { body });
        res.status(200).send(createJSONRPCErrorResponse(body.id, -32000, "Unsupported eth_sendBundle params"));
        return;
      }

      Logger.debug(req.transactionId, "Received eth_sendBundle request!", { body });

      const backrunTxs = body.params[0].txs;
      const targetBlock = parseInt(Number(body.params[0].blockNumber).toString());

      const { mevshare, flashbotsBundleProvider } = await initClients(provider, verifiedSignatureSearcherPkey);

      let bundle: BundleParams["body"], refunds: Refund[];
      // If ovalHeaderConfigs.unlockAddresses are configured, send the unlock transaction bundles and the backrun bundle without simulation.
      // This setting enables the searcher to request a specific list of unlock addresses for use in their bundle and
      // accelerates the process by omitting the step of finding unlock addresses and performing simulations.
      if (ovalHeaderConfigs) {
        const ovalAddresses = ovalHeaderConfigs.unlockAddresses.map((unlockAddress) => unlockAddress.ovalAddress);
        const { unlockBundles } = await getUnlockBundlesFromOvalAddresses(flashbotsBundleProvider, backrunTxs, targetBlock, ovalAddresses, req);

        Logger.debug(req.transactionId, "Header unlock addresses found. Sending unlock tx bundle and backrun bundle...", ovalAddresses);
        // Construct the outer bundle with the modified payload to backrun the UnlockLatestValue call.
        bundle = [
          ...unlockBundles,
          ...backrunTxs.map((tx): { tx: string; canRevert: boolean } => {
            return { tx, canRevert: false };
          }),
        ];

        // Calculate refunds for the each unlock bundles this assumes the unlock bundles are the first elements in the bundle
        // and the ovalAddresses are in the same order as the unlock bundles.
        refunds = calculateBundleRefunds(ovalAddresses, ovalConfigs);

        return sendBundle(req, res, mevshare, targetBlock, body.id, bundle, refunds);
      } else {

        // If configured, simulate the original bundle to check if it reverts without the unlock.
        if (env.passThroughNonReverting) {
          const originalSimulationResponse = await flashbotsBundleProvider.simulate(backrunTxs, targetBlock);
          if (!originalBundleReverts(originalSimulationResponse, req)) {
            await handleUnsupportedRequest(req, res, "Original bundle does not revert"); // Pass through if the original bundle doesn't revert.
            return;
          }
        }

        Logger.debug(req.transactionId, "Finding unlock that does not revert the bundle...");

        const unlock = await findUnlock(flashbotsBundleProvider, backrunTxs, targetBlock, req);
        if (!unlock) {
          Logger.debug(req.transactionId, "No valid unlock found!");
          await handleUnsupportedRequest(req, res, "No valid unlock found"); // Pass through if no unlock is found.
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
          await handleUnsupportedRequest(req, res, "Insufficient builder payment"); // Pass through as minimum payment not met.
          return;
        }

        Logger.debug(
          req.transactionId,
          `Found valid unlock at ${unlock.ovalAddress}. Sending unlock tx bundle and backrun bundle...`,
        );

        // Construct the inner bundle with call to Oval to unlock the latest value.
        const unlockBundle = createUnlockLatestValueBundle(
          unlock.signedUnlockTx,
          ovalConfigs[unlock.ovalAddress].refundAddress,
          targetBlock,
        );

        // Construct the outer bundle with the modified payload to backrun the UnlockLatestValue call.
        bundle = [
          { bundle: unlockBundle },
          ...backrunTxs.map((tx): { tx: string; canRevert: boolean } => {
            return { tx, canRevert: false };
          }),
        ];
        refunds = [{ bodyIdx: 0, percent: adjustedRefundPercent }]
      }

      // Exit the function here to prevent the request from being forwarded to the FORWARD_URL.
      return sendBundle(req, res, mevshare, targetBlock, body.id, bundle, refunds);

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
          await handleUnsupportedRequest(req, res, "Original bundle does not revert"); // Pass through if the original bundle doesn't revert.
          return;
        }
      }

      let simulationResponse, unlockTransactionHashes;
      if (ovalHeaderConfigs) {
        const ovalAddresses = ovalHeaderConfigs.unlockAddresses.map((unlockAddress) => unlockAddress.ovalAddress);
        Logger.debug(req.transactionId, "Header unlock addresses found: simulating unlock tx bundle and backrun bundle...", ovalAddresses);

        const { unlockSignedTransactions, unlockTxHashes } = await getUnlockBundlesFromOvalAddresses(flashbotsBundleProvider, backrunTxs, targetBlock, ovalAddresses, req);
        simulationResponse = await flashbotsBundleProvider.simulate(
          [...unlockSignedTransactions, ...backrunTxs],
          targetBlock,
        );
        unlockTransactionHashes = unlockTxHashes;
      } else {
        Logger.debug(req.transactionId, "Finding unlock that does not revert the bundle...");

        const unlock = await findUnlock(flashbotsBundleProvider, backrunTxs, targetBlock, req);
        if (!unlock) {
          Logger.debug(req.transactionId, "No valid unlock found!");
          await handleUnsupportedRequest(req, res, "No valid unlock found"); // Pass through if no unlock is found.
          return;
        }

        Logger.debug(
          req.transactionId,
          `Found valid unlock at ${unlock.ovalAddress}. Simulating unlock tx bundle and backrun bundle...`,
        );

        simulationResponse = await flashbotsBundleProvider.simulate(
          [unlock.signedUnlockTx, ...backrunTxs],
          targetBlock,
        );
        unlockTransactionHashes = [unlock.unlockTxHash];
      }

      // Send back the simulation response without the unlock transaction.
      return handleBundleSimulation(simulationResponse, unlockTransactionHashes, req, res);

    } else await handleUnsupportedRequest(req, res, "Invalid signature or method");
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
