export interface OvalConfig {
  unlockerKey: string;
  refundAddress: string;
  refundPercent: number;
}

// Records to store supported Oval instances and their configs.
export type OvalConfigs = Record<string, OvalConfig>;
