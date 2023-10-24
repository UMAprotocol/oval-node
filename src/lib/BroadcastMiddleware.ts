// import {
//   FlashbotsBundleProvider,
//   DEFAULT_FLASHBOTS_RELAY,
//   FlashbotsOptions,
// } from "flashbots-ethers-v6-provider-bundle";

// import { FetchRequest, Networkish, Signer, Provider, } from "ethers";

// export interface BundleBroadcastResponse {
//   bundleTransactions: Array<TransactionAccountNonce>;
//   wait: () => Promise<FlashbotsBundleResolution>;
//   receipts: () => Promise<Array<TransactionReceipt>>;
//   bundleHashes: Array<string>;
// }

// export class BuilderBroadcaster extends FlashbotsBundleProvider {
//   private connectionInfoArr: Array<FetchRequest>;

//   constructor(
//     genericProvider: Provider,
//     authSigner: Signer,
//     network: Networkish,
//     connectionInfoOrUrls: Array<FetchRequest>,
//   ) {
//     const defaultConnectionInfo = { url: DEFAULT_FLASHBOTS_RELAY };
//     super(genericProvider, authSigner, DEFAULT_FLASHBOTS_RELAY, network);
//     this.connectionInfoArr = connectionInfoOrUrls;
//   }

//   /**
//    * Creates a new Builder Bundle Broadcaster.
//    * @param genericProvider ethers.js mainnet provider
//    * @param authSigner account to sign bundles
//    * @param connectionInfoOrUrl (optional) connection settings
//    * @param network (optional) network settings
//    *
//    * @example
//    * ```typescript
//    * const {providers, Wallet} = require("ethers")
//    * const {BuilderBroadcaster} = require("@flashbots/ethers-provider-bundle")
//    * const authSigner = Wallet.createRandom()
//    * const provider = new providers.JsonRpcProvider("http://localhost:8545")
//    * const broadcaster = await BuilderBroadcaster.create(provider, authSigner, ['https://relay.flashbots.net/'])
//    * ```
//    */
//   static async createBroadcaster(
//     genericProvider: Provider,
//     authSigner: Signer,
//     builderEndpoints: Array<string>,
//     network?: Networkish,
//   ): Promise<any> {
//     const connectionInfoOrUrlArray: any = Array.isArray(builderEndpoints)
//       ? builderEndpoints.map((b_e) => ({ url: b_e }))
//       : [];

//     const networkish: Networkish = {
//       chainId: 0,
//       name: "",
//     };
//     if (typeof network === "string") {
//       networkish.name = network;
//     } else if (typeof network === "number") {
//       networkish.chainId = network;
//     }

//     if (networkish.chainId === 0) {
//       networkish.chainId = Number((await genericProvider.getNetwork()).chainId);
//     }

//     return new BuilderBroadcaster(genericProvider, authSigner, networkish, connectionInfoOrUrlArray);
//   }

//   public async broadcastBundle(
//     signedBundledTransactions: Array<string>,
//     targetBlockNumber: number,
//     opts?: FlashbotsOptions,
//   ): Promise<BundleBroadcast> {
//     const params = {
//       txs: signedBundledTransactions,
//       blockNumber: `0x${targetBlockNumber.toString(16)}`,
//       minTimestamp: opts?.minTimestamp,
//       maxTimestamp: opts?.maxTimestamp,
//       revertingTxHashes: opts?.revertingTxHashes,
//       replacementUuid: opts?.replacementUuid,
//     };

//     const request = JSON.stringify(super.prepareRelayRequest("eth_sendBundle", [params]));
//     const responses = await this.requestBroadcast(request);

//     const bundleTransactions = signedBundledTransactions.map((signedTransaction) => {
//       const transactionDetails = ethers.utils.parseTransaction(signedTransaction);
//       return {
//         signedTransaction,
//         hash: ethers.utils.keccak256(signedTransaction),
//         account: transactionDetails.from || "0x0",
//         nonce: transactionDetails.nonce,
//       };
//     });

//     const bundleHashes = responses
//       .filter((response) => response.error === undefined || response.error === null)
//       .map((response) => response.result?.bundleHash)
//       .filter(Boolean);

//     return {
//       bundleTransactions,
//       wait: () => super.waitForBundleInclusion(bundleTransactions, targetBlockNumber, TIMEOUT_MS),
//       receipts: () => super.fetchReceipts(bundleTransactions),
//       bundleHashes: bundleHashes,
//     };
//   }

//   private async requestBroadcast(request: string) {
//     const responseHandles = new Array();
//     [];
//     for (let connectionInfo of this.connectionInfoArr) {
//       const updatedConnectionInfo = { ...connectionInfo };
//       updatedConnectionInfo.headers = {
//         "X-Flashbots-Signature": `${await this.authSigner.getAddress()}:${await this.authSigner.signMessage(
//           id(request),
//         )}`,
//         ...connectionInfo.headers,
//       };
//       const promise = new Promise((resolve) => resolve(fetchJson(updatedConnectionInfo, request)));
//       responseHandles.push(promise);
//     }

//     let responses = await Promise.all(responseHandles);
//     return responses;
//   }
// }
