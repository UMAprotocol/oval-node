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
OVAL_ADDRESS=0x420 // The address of the Oval contract you want to target with the Oval Node.
SENDER_PRIVATE_KEY=0x6969 // The private key of the permissioned actor who can call unlockLatestValue on the associated Oval.
AUTH_PRIVATE_KEY=0x6666 // The root private key used to derive searcher specific keys for signing bundles.
REFUND_ADDRESS=0x42069 // The refund address you want to send the OEV kickback to.
PROVIDER_URL=https://mainnet.infura.io/v3/abcdef // Ethereum mainnet RPC provider.
```

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
