import { getAddress } from "ethers";
import dotenv from "dotenv";
import { fallback } from "./constants";
dotenv.config({ path: ".env" });

const environmentError = (varName: string) => new Error(`Environment error: ${varName} not set.`);

if (!process.env.AUTH_PRIVATE_KEY) throw environmentError("AUTH_PRIVATE_KEY");
if (!process.env.SENDER_PRIVATE_KEY) throw environmentError("SENDER_PRIVATE_KEY");
if (!process.env.PROVIDER_URL) throw environmentError("PROVIDER_URL");

export const env = {
  authKey: process.env.AUTH_PRIVATE_KEY,
  providerUrl: process.env.PROVIDER_URL,
  senderKey: process.env.SENDER_PRIVATE_KEY,
  forwardUrl: process.env.FORWARD_URL || fallback.forwardUrl,
  oevOracle: process.env.OEV_ORACLE_ADDRESS ? getAddress(process.env.OEV_ORACLE_ADDRESS) : fallback.oevOracle,
  honeyPot: process.env.HONEYPOT_ADDRESS ? getAddress(process.env.HONEYPOT_ADDRESS) : fallback.honeyPot,
  refundAddress: process.env.REFUND_ADDRESS ? getAddress(process.env.REFUND_ADDRESS) : fallback.refundAddress,
};
