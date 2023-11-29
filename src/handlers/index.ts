import { Request, Response, NextFunction } from "express";
import { FlashbotsBundleProvider } from "flashbots-ethers-v6-provider-bundle";
import { createJSONRPCErrorResponse, JSONRPCErrorException } from "json-rpc-2.0";
import { Logger } from "../lib";

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

// Bundle simulation handler that just logs errors for debugging.
export async function logSimulationErrors(
  flashbotsBundleProvider: FlashbotsBundleProvider,
  signedTransactions: string[],
  targetBlock: number,
) {
  const simulationResponse = await flashbotsBundleProvider.simulate(signedTransactions, targetBlock);
  if ("error" in simulationResponse) {
    Logger.debug("Simulation error", { simulationResponse });
  } else if (simulationResponse.firstRevert && "error" in simulationResponse.firstRevert) {
    Logger.debug("Simulation reverted", { simulationResponse });
  }
}
