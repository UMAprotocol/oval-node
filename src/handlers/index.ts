import { Request, Response, NextFunction } from "express";
import { keccak256, concat } from "ethers";
import { SimulationResponse, SimulationResponseSuccess } from "flashbots-ethers-v6-provider-bundle";
import { createJSONRPCErrorResponse, createJSONRPCSuccessResponse, JSONRPCErrorException } from "json-rpc-2.0";
import { Logger, stringifyBigInts } from "../lib";

// Error handler that logs error and sends JSON-RPC error response.
export function expressErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof JSONRPCErrorException) {
    Logger.error("JSON-RPC error", { err });
    res.status(200).send(createJSONRPCErrorResponse(req.body.id, err.code, err.message, err.data));
  } else {
    Logger.error("Internal error", { err });
    res
      .status(200)
      .send(createJSONRPCErrorResponse(req.body.id, -32603, "Internal error", `${err.name}: ${err.message}`));
  }
}

// Bundle simulation handler that just logs errors for debugging.
export function logSimulationErrors(simulationResponse: SimulationResponse) {
  if ("error" in simulationResponse) {
    Logger.debug("Simulation error", { simulationResponse });
  } else if (simulationResponse.firstRevert && "error" in simulationResponse.firstRevert) {
    Logger.debug("Simulation reverted", stringifyBigInts({ simulationResponse }));
  }
}

// Helper to remove unlock transaction from the simulation response and recalculate bundle totals.
// Logic based on CallBundle function implementation in https://github.com/flashbots/builder/blob/main/internal/ethapi/api.go
function removeUnlockFromSimulationResult(
  simulationResponse: SimulationResponseSuccess,
  unlockTxHash: string,
): SimulationResponseSuccess {
  const results = simulationResponse.results.filter((txResponse) => txResponse.txHash !== unlockTxHash);
  const coinbaseDiff = results.reduce((total, txResponse) => total + BigInt(txResponse.coinbaseDiff), BigInt(0));
  const gasFees = results.reduce((total, txResponse) => total + BigInt(txResponse.gasFees), BigInt(0));
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
    if (simulationResponse.error.message.includes(unlockTxHash)) {
      // Mask as internal error if the prepended unlock tx was at fault.
      Logger.debug("Simulation error", { simulationResponse });
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
