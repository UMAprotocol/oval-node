import { Transaction } from "ethers";

// Sample bundle processor. Could be extended to handel different kinds of bundle decomposition. For now it
// simply looks for backrun txs to the demo implementation and removes them from the bundle.
export function processBundle(transactions: Transaction[]): { processed: Transaction[]; processedBundle: boolean } {
  let processedBundle = false;
  for (const [index, tx] of transactions.entries()) {
    const target = Transaction.from(tx);

    if (target.to === "0xAFA42f17e0C4e6E80Bd743BB67ed02da2Fbd8965" && target.data === "0x4d54a8ca") {
      processedBundle = true;
      delete transactions[index];
    }
  }

  return { processed: transactions.filter(Boolean), processedBundle };
}
