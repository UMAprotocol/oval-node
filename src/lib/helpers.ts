import { JsonRpcProvider, Network, Wallet, Provider, isAddress, isHexString, Transaction, ethers } from "ethers";
import MevShareClient, { SupportedNetworks } from "@flashbots/mev-share-client";
import { FlashbotsBundleProvider } from "flashbots-ethers-v6-provider-bundle";
import { env } from "./env";
import { Logger } from "./logging";
import { OvalConfig, OvalConfigs } from "./types";
import { JSONRPCRequest } from "json-rpc-2.0";
import { Request } from "express";
import { chainIdBlockOffsets, supportedNetworks } from "./constants";

export function getProvider() {
  const network = new Network(supportedNetworks[env.chainId], env.chainId);
  return new JsonRpcProvider(env.providerUrl, network);
}

// Initialize unlocker wallets for each Oval instance.
export function initWallets(provider: JsonRpcProvider) {
  return Object.entries(env.ovalConfigs).reduce(
    (wallets, [address, config]) => {
      wallets[address] = new Wallet(config.unlockerKey).connect(provider);
      return wallets;
    },
    {} as Record<string, Wallet>,
  );
}

export async function initClients(provider: JsonRpcProvider, searcherPublicKey: string) {
  // Derive a private key from the searcher's public key and the unlocker's private key.
  // This approach ensures that each searcher maintains an independent reputation within the Flashbots network,
  // preventing the unlocker from being impacted by a searcher's actions.
  // This is in line with Flashbots' advanced reputation management system.
  // Refer to Flashbots documentation for more details: https://docs.flashbots.net/flashbots-auction/advanced/reputation
  const derivedPrivateKey = ethers.solidityPackedKeccak256(["address", "bytes32"], [searcherPublicKey, env.authKey]);

  // Create an Ethereum wallet signer using the derived private key, connected to the provided JSON RPC provider.
  const authSigner = new Wallet(derivedPrivateKey).connect(provider);

  // Use custom network for MevShare and connect for FlashbotsBundle as we might need adding x-flashbots-origin headers.
  const network = {
    streamUrl: SupportedNetworks[supportedNetworks[env.chainId]].streamUrl,
    apiUrl: env.forwardUrl,
    apiHeaders: env.flashbotsOrigin !== undefined ? { "x-flashbots-origin": env.flashbotsOrigin } : undefined,
  };
  const connect = new ethers.FetchRequest(env.forwardUrl);
  if (env.flashbotsOrigin !== undefined) connect.setHeader("x-flashbots-origin", env.flashbotsOrigin);

  // Return initialized clients for MevShare and FlashbotsBundle, both authenticated using the derived private key.
  return {
    mevshare: new MevShareClient(authSigner, network),
    flashbotsBundleProvider: await FlashbotsBundleProvider.create(provider, authSigner, connect),
  };
}

// Function to grab the most recent base fee, for accurate gas estimation.
export async function getBaseFee(provider: Provider, req: Request) {
  const block = await provider.getBlock("latest");
  const baseFee = block?.baseFeePerGas;
  if (!isDefined(baseFee)) {
    Logger.debug(req.transactionId, `Block did not contain base fee. Block received from provider ${block}`);
    throw new Error(`Block did not contain base fee. Is this running on an EIP-1559 network?`);
  }
  return baseFee;
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

// A wrapper around parsing a string as a boolean that throws if the conversion fails.
export function getBoolean(input: string): boolean {
  const lowerCaseInput = input.toLowerCase();
  if (lowerCaseInput === "true") {
    return true;
  } else if (lowerCaseInput === "false") {
    return false;
  } else {
    throw new Error(`Value ${input} cannot be converted to a boolean`);
  }
}

// Simple type guard to ensure check that a value is defined (and help typescript understand).
function isDefined<T>(input: T | null | undefined): input is T {
  return input !== null && input !== undefined;
}

// Helper function for bundle params type guard making sure all tx strings can be decoded.
function isValidTx(tx: unknown) {
  if (typeof tx !== "string") return false;
  try {
    Transaction.from(tx);
    return true;
  } catch {
    return false;
  }
}

// Type guard for params in eth_sendBundle method. We only support the required properties for RPC to work. Requests
// with unsupported parameters will be forwarded to fallback relay.
// Based on Flashbots RPC Endpont docs: https://docs.flashbots.net/flashbots-auction/advanced/rpc-endpoint#eth_sendbundle
export function isEthSendBundleParams(params: unknown): params is [{ txs: string[]; blockNumber: string }] {
  return (
    Array.isArray(params) &&
    params.length === 1 &&
    typeof params[0] === "object" &&
    Array.isArray(params[0].txs) &&
    params[0].txs.every((tx: unknown) => isValidTx(tx)) &&
    isHexString(params[0].blockNumber) &&
    Object.keys(params[0]).every((key) => ["txs", "blockNumber"].includes(key)) // Nothing else supported.
  );
}

// Type guard for params in eth_callBundle method. We only support the required properties for RPC to work. Requests
// with unsupported parameters will be forwarded to fallback relay.
// Based on Flashbots RPC Endpont docs: https://docs.flashbots.net/flashbots-auction/advanced/rpc-endpoint#eth_callbundle
export function isEthCallBundleParams(
  params: unknown,
): params is [{ txs: string[]; blockNumber: string; stateBlockNumber: string }] {
  return (
    Array.isArray(params) &&
    params.length === 1 &&
    typeof params[0] === "object" &&
    Array.isArray(params[0].txs) &&
    params[0].txs.every((tx: unknown) => isValidTx(tx)) &&
    isHexString(params[0].blockNumber) &&
    params[0].stateBlockNumber === "latest" && // We only support latest as otherwise unlock nonce could be too high.
    Object.keys(params[0]).every((key) => ["txs", "blockNumber", "stateBlockNumber"].includes(key)) // Nothing else supported.
  );
}

// Helper function to deal with bigints when logging or responding to the client.
export function stringifyBigInts(obj: any): any {
  if (typeof obj === "bigint") {
    return obj.toString();
  } else if (typeof obj === "object") {
    if (Array.isArray(obj)) {
      return obj.map((item) => stringifyBigInts(item));
    } else {
      const newObj: Record<string, any> = {};
      for (const key in obj) {
        newObj[key] = stringifyBigInts(obj[key]);
      }
      return newObj;
    }
  }
  return obj;
}

// Type guard for OvalConfig.
function isOvalConfig(input: unknown): input is OvalConfig {
  return (
    typeof input === "object" &&
    input !== null &&
    !Array.isArray(input) &&
    "unlockerKey" in input &&
    typeof input["unlockerKey"] === "string" &&
    ((!input["unlockerKey"].startsWith("0x") && isHexString("0x" + input["unlockerKey"], 32)) ||
      isHexString(input["unlockerKey"], 32)) &&
    "refundAddress" in input &&
    typeof input["refundAddress"] === "string" &&
    isAddress(input["refundAddress"]) &&
    "refundPercent" in input &&
    typeof input["refundPercent"] === "number" &&
    Number.isInteger(input["refundPercent"]) &&
    input["refundPercent"] >= 0 &&
    input["refundPercent"] <= 100
  );
}

// Type guard for OvalConfigs. All records must have unique Oval addresses and unlockerKeys.
function isOvalConfigs(input: unknown): input is OvalConfigs {
  return (
    typeof input === "object" &&
    input !== null &&
    !Array.isArray(input) &&
    Object.keys(input).length === new Set(Object.keys(input)).size &&
    Object.keys(input).every((key) => isAddress(key)) &&
    Object.values(input).every((value) => isOvalConfig(value)) &&
    Object.values(input).length === new Set(Object.values(input).map((value) => value.unlockerKey)).size
  );
}

export function getOvalConfigs(input: string): OvalConfigs {
  let parsedInput: unknown;

  try {
    parsedInput = JSON.parse(input);
  } catch (error) {
    throw new Error(`Value "${input}" cannot be converted to OvalConfigs records`);
  }

  if (isOvalConfigs(parsedInput)) {
    return parsedInput;
  }

  throw new Error(`Value "${input}" is valid JSON but is not OvalConfigs records`);
}

// Verify the bundle signature header and return the address of the private key that produced the searchers signature if
// valid, otherwise return null.
export function verifyBundleSignature(
  body: JSONRPCRequest,
  xFlashbotsSignatureHeader: string | string[] | undefined,
  req: Request,
) {
  if (typeof xFlashbotsSignatureHeader !== "string") {
    Logger.debug(req.transactionId, `Invalid signature header: ${xFlashbotsSignatureHeader}, expected string`);
    return null;
  }

  const bundleSignaturePublicKey = xFlashbotsSignatureHeader.split(":")[0];
  const bundleSignedMessage = xFlashbotsSignatureHeader.split(":")[1];

  const serializedBody = JSON.stringify(body);

  const hash = ethers.id(serializedBody);

  const recoveredAddress = ethers.verifyMessage(hash, bundleSignedMessage);

  const verified = recoveredAddress === bundleSignaturePublicKey;

  return verified ? recoveredAddress : null;
}

// Validate private key and prepend 0x prefix if missing.
export function getPrivateKey(input: string): string {
  // Prepend 0x if missing.
  const privateKey = input.startsWith("0x") ? input : "0x" + input;
  if (!isHexString(privateKey, 32)) throw new Error(`Value ${input} not a valid private key`);
  return privateKey;
}

// Calculate the maximum block number to target with bundles by chainId.
export function getMaxBlockByChainId(chainId: number, targetBlock: number) {
  // In mainnet this is always the targetBlock, but in Goerli we add 24 blocks to the targetBlock.
  return targetBlock + chainIdBlockOffsets[chainId];
}
