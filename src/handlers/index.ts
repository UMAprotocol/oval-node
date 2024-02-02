import axios, { AxiosError, AxiosResponse } from "axios";
import { Request, Response, NextFunction } from "express";
import { keccak256, concat } from "ethers";
import { SimulationResponse, SimulationResponseSuccess } from "flashbots-ethers-v6-provider-bundle";
import { createJSONRPCErrorResponse, createJSONRPCSuccessResponse, JSONRPCErrorException } from "json-rpc-2.0";
import { env, Logger, stringifyBigInts } from "../lib";

// Error handler that logs error and sends JSON-RPC error response.
export function expressErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof JSONRPCErrorException) {
    Logger.error(req.transactionId, "JSON-RPC error", { error: err });
    res.status(200).send(createJSONRPCErrorResponse(req.body.id, err.code, err.message, err.data));
  } else {
    Logger.error(req.transactionId, "Internal error", { error: err });
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
    Logger.debug(req.transactionId, "Simulation error", { simulationResponse });
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

// Handler to deal with errors on forwarded requests.
function handleForwardedRequestErrors(err: unknown, req: Request, res: Response) {
  // Pass through Axios response if we have it, otherwise wrap as internal error.
  if (err instanceof AxiosError && err.response !== undefined) {
    Logger.debug(req.transactionId, "Forwarded request error", { error: err, responseData: err.response.data });
    res.status(err.response.status).send(err.response.data);
  } else {
    Logger.debug(req.transactionId, "Forwarded request error", { error: err });
    const data = err instanceof Error ? `${err.name}: ${err.message}` : null;
    res.status(200).send(createJSONRPCErrorResponse(req.body.id, -32603, "Internal error", data));
  }
}

// Handler that passes unsupported requests to the forwardUrl.
export async function handleUnsupportedRequest(req: Request, res: Response) {
  const { method, body } = req;

  Logger.debug(req.transactionId, `Received unsupported request! Forwarding to ${env.forwardUrl} ...`, { body });

  let response: AxiosResponse;
  try {
    response = await axios({
      method: method as any,
      url: `${env.forwardUrl}`,
      headers: { ...req.headers, host: new URL(env.forwardUrl).hostname },
      data: body,
    });
  } catch (err) {
    handleForwardedRequestErrors(err, req, res);
    return; // Handler already sent response to the client.
  }

  const { status, data } = response;

  res.status(status).send(data);
}

// Helper to check if the original bundle reverts without the unlock and logs for debugging.
export function originalBundleReverts(simulationResponse: SimulationResponse, req: Request) {
  if ("error" in simulationResponse) {
    Logger.debug(req.transactionId, "Original bundle simulation error", { simulationResponse });
    return false;
  } else if (!simulationResponse.firstRevert || !("error" in simulationResponse.firstRevert)) {
    Logger.debug(req.transactionId, "Original bundle simulation succeeds without unlock", stringifyBigInts({ simulationResponse }));
    return false;
  }
  return true;
}
