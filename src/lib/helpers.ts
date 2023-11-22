import { JsonRpcProvider, WebSocketProvider, Network, Wallet, Provider, isHexString, Transaction } from "ethers";
import MevShareClient from "@flashbots/mev-share-client";
import { FlashbotsBundleProvider } from "flashbots-ethers-v6-provider-bundle";
import { env } from "./env";

export function getProvider() {
  return new JsonRpcProvider(env.providerUrl, new Network("mainnet", 1));
}

export async function initWallet(provider: JsonRpcProvider | WebSocketProvider) {
  const authSigner = new Wallet(env.authKey).connect(provider);

  return {
    wallet: new Wallet(env.senderKey).connect(provider),
    mevshare: MevShareClient.useEthereumMainnet(authSigner),
    flashbotsBundleProvider: await FlashbotsBundleProvider.create(provider, authSigner),
  };
}

// Function to grab the most recent base fee, for accurate gas estimation.
export async function getBaseFee(provider: Provider) {
  const block = await provider.getBlock("latest");
  const baseFee = block?.baseFeePerGas;
  if (!isDefined(baseFee)) {
    console.error(`Block did not contain base fee. Block received from provider ${block}`);
    throw new Error(`Block did not contain base fee. Is this running on an EIP-1559 network?`);
  }
  return baseFee;
}

// Simple utility function that returns a copy of an input array with a dropped element.
export function copyAndDrop<T>(array: T[], index: number): T[] {
  const clone = array.slice();
  clone.splice(index, 1);
  return clone;
}

// A wrapper around parseFloat that throws if the output is NaN.
export function getFloat(input: string): number {
  const output = parseFloat(input);
  if (isNaN(output)) throw new Error(`Value ${input} cannot be converted to a float`);
  return output;
}

// A wrapper around parseInt that throws if the output is NaN.
export function getInt(input: string): number {
  const output = parseInt(input);
  if (isNaN(output)) throw new Error(`Value ${input} cannot be converted to an int`);
  return output;
}

export function getStringArray(input: string): string[] {
  let output: unknown;
  try {
    output = JSON.parse(input);
  } catch {
    throw new Error(`Value ${input} cannot be converted to an array of strings`);
  }

  if (Array.isArray(output) && output.every((el: unknown): el is string => typeof el === "string")) {
    return output;
  }

  throw new Error(`Value ${input} is valid JSON, but is not an array of strings`);
}

// Simple type guard to ensure check that a value is defined (and help typescript understand).
export function isDefined<T>(input: T | null | undefined): input is T {
  return input !== null && input !== undefined;
}

// Helper function for bundle params type guard making sure all tx strings can be decoded.
function isValidTx(tx: any) {
  if (typeof tx !== "string") return false;
  try {
    Transaction.from(tx);
    return true;
  } catch {
    return false;
  }
}

// Type guard for params in eth_sendBundle method. We ignore all optional properties as we don't use them.
// Based on Flashbots RPC Endpont docs: https://docs.flashbots.net/flashbots-auction/advanced/rpc-endpoint#eth_sendbundle
export function isEthSendBundleParams(params: any): params is [{ txs: string[]; blockNumber: string }] {
  return (
    Array.isArray(params) &&
    params.length === 1 &&
    typeof params[0] === "object" &&
    Array.isArray(params[0].txs) &&
    params[0].txs.every((tx: any) => isValidTx(tx)) &&
    isHexString(params[0].blockNumber)
  );
}
