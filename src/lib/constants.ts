export const fallback = {
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
