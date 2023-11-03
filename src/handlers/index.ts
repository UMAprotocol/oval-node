import { Transaction } from "ethers";

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

    if (target.to === "0xAFA42f17e0C4e6E80Bd743BB67ed02da2Fbd8965" && target.data === "0x4d54a8ca") {
      processedBundle = true;
      oevShare = "0xb3cAcdC722470259886Abb57ceE1fEA714e86387";
      refundAddress = "0xe4d0cC1976D637d01eC8d4429e8cA6F96254654b";
      delete transactions[index];
    }
  }

  return { processedTransactions: transactions.filter(Boolean), processedBundle, oevShare, refundAddress };
}
