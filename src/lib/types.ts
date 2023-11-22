import { BundleParams, HintPreferences } from "@flashbots/mev-share-client";

// Extend BundleParams to include undocumented wantRefund required for precise kickback to work.
export interface ExtendedBundleParams extends BundleParams {
  privacy?: {
      hints?: HintPreferences,
      builders?: Array<string>,
      wantRefund?: number, // Optional property to set total refund percent.
  }
}
