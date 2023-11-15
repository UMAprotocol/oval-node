import { Request, Response, NextFunction } from "express";
import { createJSONRPCErrorResponse, JSONRPCErrorException } from "json-rpc-2.0";

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
