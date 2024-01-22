# Oval Contracts

<p align="center">
  <img alt="UMA Logo" src="https://i.imgur.com/fSkkK5M.png" width="440">
</p>

Oval is an MEV capture mechanism that lets protocols reclaim Oracle Extractable Value(OEV) by auctioning oracle updates. It leveraged Flashbot's [MEV-share](https://docs.flashbots.net/flashbots-protect/mev-share) OFA system by running auctions for the right to backrun an oracle update.

For more information on how Oval works and how to integrate with it see the [docs](https://docs.oval.xyz/).

## Repo contents

This repository contains the implementation of the Oval Node. This enables searchers to send standard bundles with the `eth_sendBundle` RPC method to interact with protocols that use Oval. The Node works by pre-pending an `unlockLatestValue` transaction in front of a searchers bundle before forwarding the bundle to Flashbot's MEV-share. This means that searchers dont need to know how Oval works under the hood and can simply send their existing bundles. See the [docs](https://docs.oval.xyz/for-searchers/getting-started) for integration information and details on the bundle pre-pending logic.

## Running the Oval Node

Note in the vast majority of cases there is no need to run your own Oval Node (except for testing). The operator of the Oval node has the ability to submit `unlockLatestValue` transactions and so controls the ability to initiate an auction. For production deployments of Oval please reach out to us on Discord to configure this.

If you do want to run it yourself for testing purposes it can be done either by running the Javascript code directly or by executing it from within a Docker container.

### 0 Prerequisite

Clone the repo, install dependencies. Make sure you have at least Node 16 installed.

```
git clone https://github.com/UMAprotocol/oval-node.git
cd oval-node
yarn
```

### 1. Configuring the environment variables:

Define a `.env` file and define, at minimum, the following(see [here](./src/lib/env.ts) for more settings):

```
OVAL_ADDRESS=0x420 // The address of the oval contract you want to target with the Oval node.
SENDER_PRIVATE_KEY=0x6969 // The private key of the permissioned actor who can call UnlocklatestValue on the associated Oval.
REFUND_ADDRESS=0x42069 // The refund address you want to send the OEV kickback to
```

### 2. Build & run the Oval Node:

Build the JS with:

```
yarn build
```

Lastly, run the Oval node with:

```
yarn start
```

You should see associated logs produced. At this point, the oval node is ready to receive RPC payloads and create Oval `unlockLatestValue` transactions to run OEV auctions.

### 3. Running the Oval node in Docker

The Oval node can also be built into a docker container. To do this, install docker and then run the following to build the container:

```
docker build -t oev-node .
```

You can the Docker container with the following:

```
docker run --init --name oev-node --env-file ./.env --network host oev-node
```
