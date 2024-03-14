export interface OvalConfig {
  unlockerKey: string;
  refundAddress: string;
  refundPercent: number;
}

// Records to store supported Oval instances and their configs.
export type OvalConfigs = Record<string, OvalConfig>;

export type Refund = {
  bodyIdx: number;
  percent: number;
};

export interface OvalHeaderConfigs {
  unlockAddresses: {
    ovalAddress: string;
  }[];
}

type EthereumAddress = string;

export interface UnlockAddress {
  ovalAddress: EthereumAddress;
}

export interface OvalHeaderConfigs {
  unlockAddresses: UnlockAddress[];
  additionalData?: Record<string, any>; // Placeholder for future expansion, not used at the moment.
}
