# Oval Node

<p align="center">
  <img alt="UMA Logo" src="https://i.imgur.com/fSkkK5M.png" width="440">
</p>

Oval is an MEV capture mechanism that lets protocols reclaim Oracle Extractable Value(OEV) by auctioning oracle updates. It leverages Flashbot's [MEV-share](https://docs.flashbots.net/flashbots-protect/mev-share) OFA system by running auctions for the right to backrun an oracle update.

For more information on how Oval works and how to integrate with it see the [docs](https://docs.oval.xyz/).

## Repo contents

This repository contains the implementation of the Oval Node. This enables searchers to send standard bundles with the `eth_sendBundle` RPC method to interact with protocols that use Oval. The Node works by pre-pending an `unlockLatestValue` transaction in front of a searchers bundle before forwarding the bundle to Flashbot's MEV-share. This means that searchers don't need to know how Oval works under the hood and can simply send their existing bundles. See the [docs](https://docs.oval.xyz/for-searchers/getting-started) for integration information and details on the bundle pre-pending logic.

## Running the Oval Node

Note in the vast majority of cases there is no need to run your own Oval Node (except for testing). The operator of the Oval Node has the ability to submit `unlockLatestValue` transactions and so controls the ability to initiate an auction. For production deployments of Oval please reach out to us on Discord to configure this.

If you do want to run it yourself for testing purposes it can be done either by running the Javascript code directly or by executing it from within a Docker container.

### 0 Prerequisite

Clone the repo, install dependencies. Make sure you have at least Node 16 installed.

```
git clone https://github.com/UMAprotocol/oval-node.git
cd oval-node
yarn
```

### 1. Configuring the environment variables:

Define a `.env` file and define, at minimum, the following (see [here](./src/lib/env.ts) for more settings):

```
OVAL_CONFIGS=<oval_configs_json>              # JSON string that maps Oval contract addresses to their specific configurations (see below).
OVAL_CONFIGS_SHARED=<oval_configs_shared_json># JSON string for shared unlocker configurations (see below).
OVAL_ADDRESS=0x420                            # (Only if not using OVAL_CONFIGS) The address of the Oval contract you want to target with the Oval Node.
REFUND_ADDRESS=0x42069                        # (Only if not using OVAL_CONFIGS) The refund address you want to send the OEV kickback to.
REFUND_PERCENT=0.5                            # (Only if not using OVAL_CONFIGS) The percentage of the OEV kickback to send to the refund address.
SENDER_PRIVATE_KEY=<your_sender_private_key>  # (Only if not using OVAL_CONFIGS) Private key of the actor authorized to call unlockLatestValue on the Oval.
GCKMS_CONFIG=<gckms_config_json>              # JSON string that specifies the GCKMS configuration for retrieving unlocker keys. (Optional)

AUTH_PRIVATE_KEY=<your_auth_private_key>      # Root private key for deriving searcher-specific keys for signing bundles.
PROVIDER_URL=<your_provider_url>              # Ethereum mainnet/goerli RPC provider URL.
BUILDERS=<builders_json_array>                # JSON array specifying the builders for MEV-Share.
CHAIN_ID=<network_chain_id>                   # Chain ID of the Ethereum network you are targeting, 1 or 5 for mainnet or goerli.
```

`OVAL_CONFIGS` is a JSON string that maps Oval contract addresses to their specific configurations. Each entry in this JSON object should have the following format:

```json
{
  "<Oval_Contract_Address>": {
    "unlockerKey": "<Unlocker_Private_Key>", // Optional: Use either this or gckmsKeyId, not both.
    "gckmsKeyId": "<GCKMS_Key_ID>", // Optional: Use either this or unlockerKey, not both.
    "refundAddress": "<Refund_Address>",
    "refundPercent": <Refund_Percentage>
  }
}
```

- `Oval_Contract_Address`: The Ethereum address of the Oval instance.
- `Unlocker_Private_Key`: The private key of the wallet permitted to unlock prices in the specified Oval contract.
- `GCKMS_Key_ID`: The GCKMS key ID of the wallet permitted to unlock prices in the specified Oval contract.
- `Refund_Address`: The Ethereum address where refunds will be sent.
- `Refund_Percentage`: The percentage of the OEV kickback to send to the refund address.

`OVAL_CONFIGS_SHARED` is a JSON string that specifies the shared unlocker configurations for all Oval contracts. Each entry in this JSON object should have the following format:

```json
[
  {
    "unlockerKey": "<Unlocker_Private_Key>", // Optional: Use either this or gckmsKeyId, not both.
    "gckmsKeyId": "<GCKMS_Key_ID>", // Optional: Use either this or unlockerKey, not both.
  },...
]
```

Note: If an Oval instance has an instance specific configuration, it will take precedence over the shared configuration.

### 2. Build & run the Oval Node:

Build the JS with:

```
yarn build
```

Lastly, run the Oval Node with:

```
yarn start
```

You should see associated logs produced. At this point, the Oval Node is ready to receive RPC payloads and create Oval `unlockLatestValue` transactions to run OEV auctions.

### 3. Running the Oval Node in Docker

The Oval Node can also be built into a Docker container. To do this, install Docker and then run the following to build the container:

```
docker build -t oval-node .
```

You can run the Docker container with the following:

```
docker run --init --name oval-node --env-file ./.env --network host oval-node
```

## License

All code in this repository is licensed under BUSL-1.1 unless specified differently in the file. Individual exceptions to this license can be made by Risk Labs, which holds the rights to this software and design. If you are interested in using the code or designs in a derivative work, feel free to reach out to licensing@risklabs.foundation.

