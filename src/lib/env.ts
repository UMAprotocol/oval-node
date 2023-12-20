import { getAddress } from "ethers";
import dotenv from "dotenv";
import { fallback } from "./constants";
import { getInt, getFloat, getStringArray, getOvalConfigs } from "./helpers";
import { OvalConfigs } from "./types";
dotenv.config({ path: ".env" });

function getEnvVar(varName: string, defaultValue?: string): string {
  const envValue = process.env[varName];
  if (envValue !== undefined) return envValue;
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`Environment error: ${varName} not set.`);
}

// Single Oval instance config used only for backwards compatibility when OVAL_CONFIGS is not set.
let stringifiedFallbackOvalConfigs: string | undefined;
try {
  const fallbackOvalConfigs: OvalConfigs = {
    [getAddress(getEnvVar("OEV_ORACLE_ADDRESS", fallback.oevShareAddress))]: {
      unlockerKey: getEnvVar("SENDER_PRIVATE_KEY"),
      refundAddress: getEnvVar("REFUND_ADDRESS", fallback.refundAddress),
      refundPercent: getFloat(getEnvVar("REFUND_PERCENT", fallback.refundPercent)),
    }
  };
  stringifiedFallbackOvalConfigs = JSON.stringify(fallbackOvalConfigs);
} catch {
  stringifiedFallbackOvalConfigs = undefined;
}

export const env = {
  authKey: getEnvVar("AUTH_PRIVATE_KEY"),
  providerUrl: getEnvVar("PROVIDER_URL"),
  ovalConfigs: getOvalConfigs(getEnvVar("OVAL_CONFIGS", stringifiedFallbackOvalConfigs)),
  senderKey: getEnvVar("SENDER_PRIVATE_KEY"),
  forwardUrl: getEnvVar("FORWARD_URL", fallback.forwardUrl),
  oevShareAddress: getAddress(getEnvVar("OEV_ORACLE_ADDRESS", fallback.oevShareAddress)),
  honeyPot: getAddress(getEnvVar("HONEYPOT_ADDRESS", fallback.honeyPot)),
  refundAddress: getAddress(getEnvVar("REFUND_ADDRESS", fallback.refundAddress)),
  blockRangeSize: getInt(getEnvVar("BLOCK_RANGE_SIZE", fallback.blockRangeSize)),
  refundPercent: getFloat(getEnvVar("REFUND_PERCENT", fallback.refundPercent)),
  builders: getStringArray(getEnvVar("BUILDERS", JSON.stringify(fallback.builders))),
};
