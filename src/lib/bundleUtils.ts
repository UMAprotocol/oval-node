import { Interface, Transaction, TransactionRequest, Wallet } from "ethers";
import express from "express";
import { FlashbotsBundleProvider } from "flashbots-ethers-v6-provider-bundle";
import { getBaseFee, getMaxBlockByChainId, getOvalAddresses, getOvalRefundConfig, getProvider, isOvalSharedUnlockerKey } from "./helpers";
import { WalletManager } from "./walletManager";

import MevShareClient, { BundleParams } from "@flashbots/mev-share-client";
import { JSONRPCID, createJSONRPCSuccessResponse } from "json-rpc-2.0";

import { env } from "./env";
import { Logger } from "./logging";
import { Refund } from "./types";
import { Oval__factory, PermissionProxy__factory } from "../contract-types";

export const ovalInterface = Oval__factory.createInterface();

export const createUnlockLatestValueTx = async (
  wallet: Wallet,
  baseFee: bigint,
  data: string,
  chainId: bigint,
  target: string,
) => {
  const nonce = await wallet.getNonce();

  // Construct transaction to call unlockLatestValue on Oval Oracle from permissioned address.
  const unlockTx: TransactionRequest = {
    type: 2,
    chainId,
    to: target,
    nonce,
    value: 0,
    gasLimit: 200000,
    data,
    // Double the current base fee as a basic safe gas estimate. We can make this more sophisticated in the future.
    maxFeePerGas: baseFee * 2n,
    maxPriorityFeePerGas: 0, // searcher should pay the full tip.
  };

  const signedUnlockTx = await wallet.signTransaction(unlockTx);

  const unlockTxHash = Transaction.from(signedUnlockTx).hash;
  if (!unlockTxHash) throw new Error("No hash in signed unlock transaction");

  return { unlockTxHash, signedUnlockTx };
};

// Prepare unlockLatestValue transaction for a given Oval instance and simulate the bundle with the unlock transaction prepended if simulate is true.
// If shouldRecordWalletUsage is true, the wallet usage will be recorded in the WalletManager.
export const prepareUnlockTransaction = async (
  flashbotsBundleProvider: FlashbotsBundleProvider,
  backrunTxs: string[],
  targetBlock: number,
  ovalAddress: string,
  req: express.Request,
  simulate = true,
  shouldRecordWalletUsage = true,
) => {
  const provider = getProvider();
  const [baseFee, network] = await Promise.all([getBaseFee(provider, req), provider.getNetwork()]);
  const unlockerWallet = WalletManager.getInstance().getWallet(ovalAddress, targetBlock, req.transactionId, shouldRecordWalletUsage);
  const isSharedWallet = isOvalSharedUnlockerKey(unlockerWallet.address);

  // Encode the unlockLatestValue function call depending on whether the unlocker is a shared wallet or not.
  let data = ovalInterface.encodeFunctionData("unlockLatestValue");
  let target = ovalAddress;
  if (isSharedWallet) {
    target = env.permissionProxyAddress;
    data = PermissionProxy__factory.createInterface().encodeFunctionData("execute", [ovalAddress, data]);
  }

  const { unlockTxHash, signedUnlockTx } = await createUnlockLatestValueTx(
    unlockerWallet,
    baseFee,
    data,
    network.chainId,
    target,
  );

  if (!simulate) return { ovalAddress, unlockTxHash, signedUnlockTx, unlockerWallet };

  const simulationResponse = await flashbotsBundleProvider.simulate([signedUnlockTx, ...backrunTxs], targetBlock);

  return { ovalAddress, unlockTxHash, signedUnlockTx, simulationResponse, unlockerWallet };
};

export const getUnlockBundlesFromOvalAddresses = async (
  flashbotsBundleProvider: FlashbotsBundleProvider,
  backrunTxs: string[],
  targetBlock: number,
  ovalAddresses: string[],
  req: express.Request,
) => {
  const unlockBundles: { bundle: BundleParams }[] = [];
  const unlockSignedTransactions: string[] = [];
  const unlockTxHashes: string[] = [];
  for (const ovalAddress of ovalAddresses) {
    const unlock = await prepareUnlockTransaction(
      flashbotsBundleProvider,
      backrunTxs,
      targetBlock,
      ovalAddress,
      req,
      false, // Do not simulate
    );

    // Construct the inner bundle with call to Oval to unlock the latest value.
    const unlockBundle = createUnlockLatestValueBundle(
      unlock.signedUnlockTx,
      getOvalRefundConfig(ovalAddress).refundAddress,
      targetBlock,
    );

    unlockBundles.push({ bundle: unlockBundle });
    unlockSignedTransactions.push(unlock.signedUnlockTx);
    unlockTxHashes.push(unlock.unlockTxHash);
  }
  return { unlockBundles, unlockSignedTransactions, unlockTxHashes };
};

// Simulate calls to unlockLatestValue on each Oval instance bundled with original backrun transactions. Tries to find
// the first unlock that doesn't revert the bundle. If updateWalletUsage is true, the wallet usage will be recorded in the WalletManager.
export const findUnlock = async (
  flashbotsBundleProvider: FlashbotsBundleProvider,
  backrunTxs: string[],
  targetBlock: number,
  req: express.Request,
  updateWalletUsage = true
) => {
  const unlocks = await Promise.all(
    getOvalAddresses().map(async (ovalAddress) =>
      // Do not record wallet usage here as we will record it in the loop below once we find a valid unlock.
      // See shouldRecordWalletUsage parameter in WalletManager.getWallet.
      prepareUnlockTransaction(flashbotsBundleProvider, backrunTxs, targetBlock, ovalAddress, req, true, false),
    ),
  );

  // Find the first unlock that doesn't revert.
  for (const unlock of unlocks) {
    if (
      unlock.simulationResponse &&
      !("error" in unlock.simulationResponse) &&
      !unlock.simulationResponse.firstRevert
    ) {
      if (updateWalletUsage) {
        WalletManager.getInstance().updateWalletUsage(unlock.ovalAddress, unlock.unlockerWallet, targetBlock);
      }
      return {
        // Spread in order to preserve inferred SimulationResponseSuccess type.
        ...unlock,
        simulationResponse: unlock.simulationResponse,
      };
    }
  }

  return undefined;
};

export const createUnlockLatestValueBundle = (signedUnlockTx: string, refundAddress: string, targetBlock: number) => {
  // Create this as a bundle. Define the max share hints and share kickback to configured refund address.
  const bundleParams: BundleParams = {
    inclusion: { block: targetBlock, maxBlock: getMaxBlockByChainId(env.chainId, targetBlock) },
    body: [{ tx: signedUnlockTx, canRevert: false }],
    validity: {
      refundConfig: [
        {
          address: refundAddress,
          percent: 100,
        },
      ],
    },
    privacy: {
      hints: {
        calldata: true,
        logs: true,
        contractAddress: true,
        functionSelector: true,
        txHash: true,
      },
      builders: env.builders,
    },
  };

  return bundleParams;
};

// Adjusts refund percent to ensure that net builder captured value reaches the minimum configured amount.
// This can still return 0 if gross builder payment is not sufficient and caller should handle this.
export const adjustRefundPercent = (grossBuilderPayment: bigint, originalRefundPercent: number) => {
  // Require positive builder payment that covers at least minNetBuilderPaymentWei.
  if (grossBuilderPayment <= 0 || grossBuilderPayment < env.minNetBuilderPaymentWei) return 0;

  // No need for scaling as Flashbots accepts only integer refund percent value.
  const maxRefundPercent = Number(((grossBuilderPayment - env.minNetBuilderPaymentWei) * 100n) / grossBuilderPayment);

  // Bound adjusted refund percent by maxRefundPercent.
  return Math.min(originalRefundPercent, maxRefundPercent);
};

// Send the bundle to MEV-Share and return the response.
export const sendBundle = async (
  req: express.Request,
  res: express.Response,
  mevshare: MevShareClient,
  targetBlock: number,
  bodyId: JSONRPCID,
  bundle: BundleParams["body"],
  refunds: Refund[],
) => {
  const bundleParams: BundleParams = {
    inclusion: {
      block: targetBlock,
      maxBlock: getMaxBlockByChainId(env.chainId, targetBlock),
    },
    body: bundle,
    privacy: {
      builders: env.builders,
    },
    validity: {
      refund: refunds,
    },
  };

  const backrunResult = await mevshare.sendBundle(bundleParams);

  Logger.debug(req.transactionId, "Forwarded a bundle to MEV-Share", { bundleParams });
  Logger.info(req.transactionId, "Bundle accepted by MEV-Share", { bundleHash: backrunResult.bundleHash });

  res.status(200).send(createJSONRPCSuccessResponse(bodyId, backrunResult));
};
