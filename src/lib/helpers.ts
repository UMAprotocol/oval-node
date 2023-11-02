import { JsonRpcProvider, WebSocketProvider, Network, Wallet } from "ethers";
import MevShareClient from "@flashbots/mev-share-client";
import { env } from "./env";

export function getProvider() {
  return new JsonRpcProvider(env.providerUrl, new Network("mainnet", 1));
}

export function getWebsocketProvider() {
  return new WebSocketProvider(env.providerWss, new Network("mainnet", 1));
}

export async function initWallet(provider: JsonRpcProvider | WebSocketProvider) {
  const authSigner = new Wallet(env.authKey).connect(provider);

  return {
    provider,
    wallet: new Wallet(env.senderKey).connect(provider),
    authSigner,
    mevshare: MevShareClient.useEthereumMainnet(authSigner),
    feeData: await provider.getFeeData(),
  };
}