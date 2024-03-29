import { getAddress, parseEther } from "ethers";
import dotenv from "dotenv";
import { fallback, supportedNetworks } from "./constants";
import { getBoolean, getInt, getFloat, getStringArray, getOvalConfigs, getPrivateKey } from "./helpers";
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
    [getAddress(getEnvVar("OVAL_ADDRESS"))]: {
      unlockerKey: getPrivateKey(getEnvVar("SENDER_PRIVATE_KEY")),
      refundAddress: getEnvVar("REFUND_ADDRESS"),
      refundPercent: getFloat(getEnvVar("REFUND_PERCENT", fallback.refundPercent)),
    },
  };
  stringifiedFallbackOvalConfigs = JSON.stringify(fallbackOvalConfigs);
} catch {
  stringifiedFallbackOvalConfigs = undefined;
}
// Chain ID and network
const chainId = getInt(getEnvVar("CHAIN_ID", fallback.chainId.toString()));
if (!supportedNetworks[chainId]) {
  throw new Error(`Unsupported chainId: ${chainId}`);
}

export const env = {
  port: getInt(getEnvVar("PORT", fallback.port.toString())),
  authKey: getPrivateKey(getEnvVar("AUTH_PRIVATE_KEY")),
  chainId,
  providerUrl: getEnvVar("PROVIDER_URL"),
  ovalConfigs: getOvalConfigs(getEnvVar("OVAL_CONFIGS", stringifiedFallbackOvalConfigs)),
  forwardUrl: getEnvVar("FORWARD_URL", fallback.forwardUrl),
  builders: getStringArray(getEnvVar("BUILDERS", JSON.stringify(fallback.builders))),
  minNetBuilderPaymentWei: parseEther(getEnvVar("MIN_NET_BUILDER_PAYMENT", fallback.minNetBuilderPayment)),
  passThroughNonReverting: getBoolean(
    getEnvVar("PASS_THROUGH_NON_REVERTING", fallback.passThroughNonReverting.toString()),
  ),
  flashbotsOrigin: process.env["FLASHBOTS_ORIGIN"],
};
