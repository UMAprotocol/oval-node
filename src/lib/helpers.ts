import { JsonRpcProvider, WebSocketProvider, Network, Wallet } from "ethers";
import MevShareClient from "@flashbots/mev-share-client";
import { env } from "./env";

export function getProvider() {
  return new JsonRpcProvider(env.providerUrl, new Network("mainnet", 1));
}

export async function initWallet(provider: JsonRpcProvider | WebSocketProvider) {
  const authSigner = new Wallet(env.authKey).connect(provider);

  return {
    wallet: new Wallet(env.senderKey).connect(provider),
    mevshare: MevShareClient.useEthereumMainnet(authSigner),
  };
}

// Simple utility function that returns a copy of an input array with a dropped element.
export function copyAndDrop<T>(array: T[], index: number): T[] {
  const clone = array.slice();
  clone.splice(index, 1);
  return clone;
}
