import { getAddress } from "ethers";
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

function getEnvVar(varName: string, defaultValue?: string): string {
  const envValue = process.env[varName];
  if (envValue !== undefined) return envValue;
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`Environment error: ${varName} not set.`);
}

export const env = {
  authKey: getEnvVar("AUTH_PRIVATE_KEY"),
  providerUrl: getEnvVar("PROVIDER_URL"),
  providerWss: getEnvVar("PROVIDER_WSS"),
  senderKey: getEnvVar("SENDER_PRIVATE_KEY"),
  forwardUrl: getEnvVar("FORWARD_URL"),
  oevOracle: getAddress(getEnvVar("OEV_ORACLE_ADDRESS")),
};
