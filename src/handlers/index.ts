import axios from "axios";
import { Request, Response, NextFunction } from "express";
import { keccak256, concat } from "ethers";
import { SimulationResponse, SimulationResponseSuccess } from "flashbots-ethers-v6-provider-bundle";
import { createJSONRPCErrorResponse, createJSONRPCSuccessResponse, JSONRPCErrorException } from "json-rpc-2.0";
import { env, Logger, stringifyBigInts } from "../lib";

// Error handler that logs error and sends JSON-RPC error response.
export function expressErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof JSONRPCErrorException) {
    Logger.error("JSON-RPC error", { error: err });
    res.status(200).send(createJSONRPCErrorResponse(req.body.id, err.code, err.message, err.data));
  } else {
    Logger.error("Internal error", { error: err });
    res
      .status(200)
      .send(createJSONRPCErrorResponse(req.body.id, -32603, "Internal error", `${err.name}: ${err.message}`));
  }
}

// Helper to remove unlock transaction from the simulation response and recalculate bundle totals.
// Logic based on CallBundle function implementation in https://github.com/flashbots/builder/blob/main/internal/ethapi/api.go
function removeUnlockFromSimulationResult(
  simulationResponse: SimulationResponseSuccess,
  unlockTxHash: string,
): SimulationResponseSuccess {
  const results = simulationResponse.results.filter((txResponse) => txResponse.txHash !== unlockTxHash);
  const coinbaseDiff = results.reduce((total, txResponse) => total + BigInt(txResponse.coinbaseDiff), 0n);
  const gasFees = results.reduce((total, txResponse) => total + BigInt(txResponse.gasFees), 0n);
  const totalGasUsed = results.reduce((total, txResponse) => total + txResponse.gasUsed, 0);

  return {
    bundleGasPrice: coinbaseDiff / BigInt(totalGasUsed),
    bundleHash: keccak256(concat(results.map((txResponse) => txResponse.txHash))),
    coinbaseDiff,
    ethSentToCoinbase: coinbaseDiff - gasFees,
    gasFees,
    results,
    stateBlockNumber: simulationResponse.stateBlockNumber,
    totalGasUsed,
  };
}

// Bundle simulation handler that sends simulation response to the client without the unlock transaction.
export function handleBundleSimulation(
  simulationResponse: SimulationResponse,
  unlockTxHash: string,
  req: Request,
  res: Response,
) {
  if ("error" in simulationResponse) {
    Logger.info("Simulation error", { simulationResponse });
    if (simulationResponse.error.message.includes(unlockTxHash)) {
      // Mark as internal error if the prepended unlock tx was at fault.
      res.status(200).send(createJSONRPCErrorResponse(req.body.id, -32603, "Internal error"));
    } else {
      // Otherwise pass through the error.
      res
        .status(200)
        .send(createJSONRPCErrorResponse(req.body.id, simulationResponse.error.code, simulationResponse.error.message));
    }
    return;
  } else {
    const clientSimulationResult = removeUnlockFromSimulationResult(simulationResponse, unlockTxHash);
    res.status(200).send(createJSONRPCSuccessResponse(req.body.id, stringifyBigInts(clientSimulationResult)));
  }
}

// Handler that passes unsupported requests to the forwardUrl.
export async function handleUnsupportedRequest(req: Request, res: Response) {
  const { method, body } = req;

  Logger.debug(`Received unsupported request! Forwarding to ${env.forwardUrl} ...`, { body });
  const response = await axios({
    method: method as any,
    url: `${env.forwardUrl}`,
    headers: { ...req.headers, host: new URL(env.forwardUrl).hostname },
    data: body,
  });

  const { status, data } = response;

  res.status(status).send(data);
}

// Helper to check if the original bundle reverts without the unlock and logs for debugging.
export function originalBundleReverts(simulationResponse: SimulationResponse) {
  if ("error" in simulationResponse) {
    Logger.debug("Original bundle simulation error", { simulationResponse });
    return false;
  } else if (!simulationResponse.firstRevert || !("error" in simulationResponse.firstRevert)) {
    Logger.debug("Original bundle simulation succeeds without unlock", stringifyBigInts({ simulationResponse }));
    return false;
  }
  return true;
}
