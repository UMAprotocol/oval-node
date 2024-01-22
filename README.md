# Oval Contracts
<p align="center">
  <img alt="UMA Logo" src="https://i.imgur.com/fSkkK5M.png" width="440">
</p>

Oval is an MEV capture mechanism that lets protocols reclaim Oracle Extractable Value(OEV) by auctioning oracle updates. It leveraged Flashbot's [MEV-share](https://docs.flashbots.net/flashbots-protect/mev-share) OFA system by running auctions for the right to backrun an oracle update.

For more information on how Oval works and how to integrate with it see the [docs](https://docs.oval.xyz/).

## Repo contents

This repository contains the implementation of the Oval Node. This enables searchers to send standard bundles with the `eth_sendBundle` RPC method to interact with protocols that use Oval. The Node works by pre-pending an `unlockLatestValue` transaction in front of a searchers bundle before forwarding the bundle to Flashbot's MEV-share. This means that searchers dont need to know how Oval works under the hood and can simply send their existing bundles. See The [docs](https://docs.oval.xyz/for-searchers/getting-started) for integration information and details on the bundle pre-pending logic.

## Running the Oval Node
Note in the vast majority of cases there is no need to run your own Oval Node (except for testing). The operator of the Oval node has the ability to submit `unlockLatestValue` transactions and so controls the 
The repository contains a Typescript implementation of the Oval node, as well as a Docker configuration.

```
forge build
```

### Running tests

This repository uses foundry fork tests. You will need to run the fork tests as follows:

```
export RPC_MAINNET=[your ethereum mainnet archive node url]
forge test
```
