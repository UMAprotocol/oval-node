import { Transaction } from "ethers";
import { Request, Response, NextFunction } from "express";
import { createJSONRPCErrorResponse, JSONRPCErrorException } from "json-rpc-2.0";
import { env, copyAndDrop } from "../lib";

// Sample bundle processor. Can be extended to handle different kinds of bundle decomposition. For now it
// simply looks for backrun txs to the demo implementation and removes them from the bundle. It is also responsible for
// matching a given bundle type and returning the appropriate contract address and refund address.
export function processBundle(transactions: string[]):
  | {
      processedTransactions: string[];
      foundOEVTransaction: true;
      oevShare: string;
      refundAddress: string;
    }
  | { foundOEVTransaction: false } {
  for (const [index, tx] of transactions.entries()) {
    const target = Transaction.from(tx);

    if (target.to === env.honeyPot && target.data === "0x4d54a8ca") {
      // Notes:
      // 1. Right now, this does not check for multiple calls that match, as that is unexpected. Open question: how should that be handled?
      // 2. Copy transactions to avoid modifying the input, which the calling code might not expect.
      return {
        foundOEVTransaction: true,
        oevShare: env.oevOracle,
        refundAddress: env.refundAddress,
        processedTransactions: copyAndDrop(transactions, index),
      };
    }
  }

  // Don't return irrelevant parameters if nothing was found. Caller will have to check the boolean before accessing.
  return { foundOEVTransaction: false };
}

// Error handler that logs error and sends JSON-RPC error response.
export function expressErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error(err.stack); // Log the error for debugging
  if (err instanceof JSONRPCErrorException) {
    res.status(200).send(createJSONRPCErrorResponse(req.body.id, err.code, err.message, err.data));
  } else {
    res
      .status(200)
      .send(createJSONRPCErrorResponse(req.body.id, -32603, "Internal error", `${err.name}: ${err.message}`));
  }
}
