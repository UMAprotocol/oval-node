import { Transaction } from "ethers";
import { env } from "../lib";

// Sample bundle processor. Can be extended to handle different kinds of bundle decomposition. For now it
// simply looks for backrun txs to the demo implementation and removes them from the bundle. It is also responsible for
// matching a given bundle type and returning the appropriate contract address and refund address.
export function processBundle(transactions: string[]): {
  processedTransactions: string[];
  processedBundle: boolean;
  oevShare: string;
  refundAddress: string;
} {
  let processedBundle = false,
    oevShare = "",
    refundAddress = "";
  for (const [index, tx] of transactions.entries()) {
    const target = Transaction.from(tx);

    if (target.to === env.honeyPot && target.data === "0x4d54a8ca") {
      processedBundle = true;
      oevShare = env.oevOracle;
      refundAddress = env.refundAddress;
      delete transactions[index];
    }
  }

  return { processedTransactions: transactions.filter(Boolean), processedBundle, oevShare, refundAddress };
}
