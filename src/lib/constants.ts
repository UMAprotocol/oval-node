export const fallback = {
  chainId: 1,
  port: 3000,
  forwardUrl: "https://relay.flashbots.net",
  refundPercent: "90",
  builders: [
    "flashbots",
    "f1b.io",
    "rsync",
    "beaverbuild.org",
    "builder0x69",
    "Titan",
    "EigenPhi",
    "boba-builder",
    "Gambit Labs",
    "payload",
  ],
  minNetBuilderPayment: "0",
  passThroughNonReverting: false,
} as const;

export const MAINNET_CHAIN_ID = 1;
export const GOERLI_CHAIN_ID = 5;

type SupportedNetworks = "mainnet" | "goerli";
export const supportedNetworks: {
  [key: number]: SupportedNetworks;
} = {
  [MAINNET_CHAIN_ID]: "mainnet",
  [GOERLI_CHAIN_ID]: "goerli",
};

export const chainIdBlockOffsets: {
  [key: number]: number;
} = {
  [MAINNET_CHAIN_ID]: 0,
  [GOERLI_CHAIN_ID]: 24,
};
