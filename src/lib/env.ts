import { getAddress } from "ethers";
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

const environmentError = (varName: string) => new Error(`Environment error: ${varName} not set.`);

if (!process.env.AUTH_PRIVATE_KEY) throw environmentError("AUTH_PRIVATE_KEY");
if (!process.env.SENDER_PRIVATE_KEY) throw environmentError("SENDER_PRIVATE_KEY");
if (!process.env.PROVIDER_URL) throw environmentError("PROVIDER_URL");
if (!process.env.OEV_ORACLE_ADDRESS) throw environmentError("OEV_ORACLE_ADDRESS");

export const env = {
  authKey: process.env.AUTH_PRIVATE_KEY || "",
  providerUrl: process.env.PROVIDER_URL || "",
  providerWss: process.env.PROVIDER_WSS || "",
  oevShareBuilder: process.env.OEV_SHARE_BUILDER || "",
  senderKey: process.env.SENDER_PRIVATE_KEY || "",
  oevOracle: getAddress(process.env.OEV_ORACLE_ADDRESS) || "0",
};
