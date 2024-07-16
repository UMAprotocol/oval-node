export interface OvalConfig {
  unlockerKey?: string;
  gckmsKeyId?: string;
  refundAddress: string;
  refundPercent: number;
}

export interface OvalConfigShared {
  unlockerKey?: string;
  gckmsKeyId?: string;
}

// Records to store supported Oval instances and their configs.
export type OvalConfigs = Record<string, OvalConfig>;

// Shared Oval configs
export type OvalConfigsShared = Array<OvalConfigShared>;

export type Refund = {
  bodyIdx: number;
  percent: number;
};

type EthereumAddress = string;

export interface UnlockAddress {
  ovalAddress: EthereumAddress;
}

export type OvalAddressConfigList = string[];

export type EnvironmentVariables = {
  port: number;
  authKey: string;
  chainId: number;
  providerUrl: string;
  ovalConfigs: OvalConfigs;
  forwardUrl: string;
  builders: string[];
  minNetBuilderPaymentWei: bigint;
  passThroughNonReverting: boolean;
  maxOvalHeaderAddresses: number;
  flashbotsOrigin: string | undefined;
  gckmsConfig: string;
  chainIdBlockOffsets: {
    [key: number]: number;
  };
};