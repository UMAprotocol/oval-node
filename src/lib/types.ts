export interface OvalConfig {
  unlockerKey?: string;
  gckmsKeyId?: string;
  refundAddress: string;
  refundPercent: number;
}

// Records to store supported Oval instances and their configs.
export type OvalConfigs = Record<string, OvalConfig>;

export type Refund = {
  bodyIdx: number;
  percent: number;
};

type EthereumAddress = string;

export interface UnlockAddress {
  ovalAddress: EthereumAddress;
}

export type OvalAddressConfigList = string[];
