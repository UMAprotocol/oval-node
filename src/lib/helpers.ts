import { JsonRpcProvider, WebSocketProvider, Network, Wallet } from "ethers";
import MevShareClient from "@flashbots/mev-share-client";
import Env from "./env";

export function getProvider() {
  return new JsonRpcProvider(Env.providerUrl, new Network("mainnet", 1));
}

export function getWebsocketProvider() {
  return new WebSocketProvider(Env.providerWss, new Network("mainnet", 1));
}

export async function initWallet(provider: JsonRpcProvider | WebSocketProvider) {
  const authSigner = new Wallet(Env.authKey).connect(provider);

  return {
    provider,
    wallet: new Wallet(Env.senderKey).connect(provider),
    authSigner,
    mevshare: MevShareClient.useEthereumMainnet(authSigner),
    feeData: await provider.getFeeData(),
  };
}
