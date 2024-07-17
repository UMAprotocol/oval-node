import dotenv from "dotenv";
import { getAddress, parseEther } from "ethers";
import { MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID, fallback, supportedNetworks } from "./constants";
import { getBoolean, getFloat, getInt, getOvalConfigs, getOvalConfigsShared, getPrivateKey, getStringArray } from "./helpers";
import { OvalConfigs, OvalConfigsShared } from "./types";
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

type EnvironmentVariables = {
  port: number;
  authKey: string;
  chainId: number;
  providerUrl: string;
  ovalConfigs: OvalConfigs;
  ovalConfigsShared: OvalConfigsShared;
  forwardUrl: string;
  builders: string[];
  minNetBuilderPaymentWei: bigint;
  passThroughNonReverting: boolean;
  maxOvalHeaderAddresses: number;
  flashbotsOrigin: string | undefined;
  gckmsConfig: string;
  chainIdBlockOffsets: {
    [key: number]: number;
  };
  sharedWalletUsageCleanupInterval: number;
  standardCoinbaseFactory: string;
  standardChainlinkFactory: string;
  standardChronicleFactory: string;
  standardPythFactory: string;
  defaultRefundAddress: string;
  defaultRefundPercent: number;
  ovalDiscoveryInterval: number;
};

export const env: EnvironmentVariables = {
  port: getInt(getEnvVar("PORT", fallback.port.toString())),
  gckmsConfig: getEnvVar("GCKMS_CONFIG", fallback.gckmsConfig),
  authKey: getPrivateKey(getEnvVar("AUTH_PRIVATE_KEY")),
  chainId,
  providerUrl: getEnvVar("PROVIDER_URL"),
  ovalConfigs: getOvalConfigs(getEnvVar("OVAL_CONFIGS", stringifiedFallbackOvalConfigs)),
  ovalConfigsShared: getOvalConfigsShared(getEnvVar("OVAL_CONFIGS_SHARED", "[]")),
  forwardUrl: getEnvVar("FORWARD_URL", fallback.forwardUrl),
  builders: getStringArray(getEnvVar("BUILDERS", JSON.stringify(fallback.builders))),
  minNetBuilderPaymentWei: parseEther(getEnvVar("MIN_NET_BUILDER_PAYMENT", fallback.minNetBuilderPayment)),
  passThroughNonReverting: getBoolean(
    getEnvVar("PASS_THROUGH_NON_REVERTING", fallback.passThroughNonReverting.toString()),
  ),
  maxOvalHeaderAddresses: getInt(getEnvVar("MAX_OVAL_HEADER_ADDRESSES", "5")),
  flashbotsOrigin: process.env["FLASHBOTS_ORIGIN"],
  chainIdBlockOffsets: {
    [MAINNET_CHAIN_ID]: getInt(getEnvVar("MAINNET_BLOCK_OFFSET", "0")),
    [SEPOLIA_CHAIN_ID]: getInt(getEnvVar("SEPOLIA_BLOCK_OFFSET", "24")),
  },
  sharedWalletUsageCleanupInterval: getInt(getEnvVar("SHARED_WALLET_USAGE_CLEANUP_INTERVAL", "60")),
  ovalDiscoveryInterval: getInt(getEnvVar("OVAL_DISCOVERY_INTERVAL", "180")),
  standardCoinbaseFactory: getAddress(getEnvVar("STANDARD_COINBASE_FACTORY", "0x0e3d2b8220C0f74A287B85690a8cfeE5b45C2D44")),
  standardChainlinkFactory: getAddress(getEnvVar("STANDARD_CHAINLINK_FACTORY", "0x6d0cbebdeBc5060E6264fcC497d5A277B5748Cf9")),
  standardChronicleFactory: getAddress(getEnvVar("STANDARD_CHRONICLE_FACTORY", "0xE0225B5224512868814D9b10A14F705d99Ba0EdF")),
  standardPythFactory: getAddress(getEnvVar("STANDARD_PYTH_FACTORY", "0x53A2a7C0cBb76B20782C6842A25876C5377B64e8")),
  defaultRefundAddress: getAddress(getEnvVar("DEFAULT_REFUND_ADDRESS", "0x9Cc5b1bc0E1970D44B5Adc7ba51d76a5DD375434")),
  defaultRefundPercent: getFloat(getEnvVar("DEFAULT_REFUND_PERCENT", fallback.refundPercent)),
};