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
export const SEPOLIA_CHAIN_ID = 11155111;

type SupportedNetworks = "mainnet" | "goerli" | "sepolia";
export const supportedNetworks: {
  [key: number]: SupportedNetworks;
} = {
  [MAINNET_CHAIN_ID]: "mainnet",
  [GOERLI_CHAIN_ID]: "goerli",
  [SEPOLIA_CHAIN_ID]: "sepolia",
};

export const chainIdBlockOffsets: {
  [key: number]: number;
} = {
  [MAINNET_CHAIN_ID]: 0,
  [GOERLI_CHAIN_ID]: 24,
  [SEPOLIA_CHAIN_ID]: 24,
};

export const flashbotsSupportedNetworks: {
  [key in SupportedNetworks]: {
    name: string;
    chainId: number;
    streamUrl: string;
    apiUrl: string;
  };
} = {
  mainnet: {
    name: "mainnet",
    chainId: 1,
    streamUrl: "https://mev-share.flashbots.net",
    apiUrl: "https://relay.flashbots.net",
  },
  goerli: {
    name: "goerli",
    chainId: 5,
    streamUrl: "https://mev-share-goerli.flashbots.net",
    apiUrl: "https://relay-goerli.flashbots.net",
  },
  sepolia: {
    name: "sepolia",
    chainId: 11155111,
    streamUrl: "https://mev-share-sepolia.flashbots.net",
    apiUrl: "https://relay-sepolia.flashbots.net",
  },
};

export const FLASHBOTS_SIGNATURE_HEADER = "x-flashbots-signature";

export const OVAL_ADDRESSES_HEADER = "x-oval-addresses";
