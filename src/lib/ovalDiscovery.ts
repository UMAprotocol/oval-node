import { EventLog, JsonRpcProvider, getAddress } from "ethers";
import { env } from "./env";
import { EventSearchConfig, paginatedEventQuery } from "./events";

import { StandardCoinbaseFactory } from "../contract-types/StandardCoinbaseFactory";
import { StandardCoinbaseFactory__factory } from "../contract-types/factories/StandardCoinbaseFactory__factory";

import { StandardChainlinkFactory } from "../contract-types/StandardChainlinkFactory";
import { StandardChainlinkFactory__factory } from "../contract-types/factories/StandardChainlinkFactory__factory";

import { StandardChronicleFactory } from "../contract-types/StandardChronicleFactory";
import { StandardChronicleFactory__factory } from "../contract-types/factories/StandardChronicleFactory__factory";

import { StandardPythFactory } from "../contract-types/StandardPythFactory";
import { StandardPythFactory__factory } from "../contract-types/factories/StandardPythFactory__factory";
import { FACTORIES_GENESIS_BLOCK } from "./constants";
import { Logger } from "./";

// Singleton class to discover Oval instances
export class OvalDiscovery {
    private static instance: OvalDiscovery;
    private provider: JsonRpcProvider | undefined;
    private standardCoinbaseFactory: StandardCoinbaseFactory;
    private standardChainlinkFactory: StandardChainlinkFactory;
    private standardChronicleFactory: StandardChronicleFactory;
    private standardPythFactory: StandardPythFactory;
    private ovalInstances: Set<string> = new Set();

    private constructor() {
        this.standardCoinbaseFactory = StandardCoinbaseFactory__factory.connect(env.standardCoinbaseFactory);
        this.standardChainlinkFactory = StandardChainlinkFactory__factory.connect(env.standardChainlinkFactory);
        this.standardChronicleFactory = StandardChronicleFactory__factory.connect(env.standardChronicleFactory);
        this.standardPythFactory = StandardPythFactory__factory.connect(env.standardPythFactory);
    }

    // Singleton pattern to get an instance of OvalDiscovery
    public static getInstance(): OvalDiscovery {
        if (!OvalDiscovery.instance) {
            OvalDiscovery.instance = new OvalDiscovery();
        }
        return OvalDiscovery.instance;
    }

    public async initialize(provider: JsonRpcProvider) {
        if (this.provider) return;
        this.provider = provider;
        this.updateInstances(FACTORIES_GENESIS_BLOCK);
    }

    // Updates the list of Oval instances from the factories
    public async updateInstances(fromBlock: number) {
        if (!this.provider) return;
        let lastBlock = fromBlock;

        try {
            lastBlock = await this.provider.getBlockNumber();
            const factories = [
                this.standardCoinbaseFactory,
                this.standardChainlinkFactory,
                this.standardChronicleFactory,
                this.standardPythFactory
            ];

            for (const factory of factories) {
                await this.updateFactoryInstances(factory, fromBlock, lastBlock);
            }
        } catch (error) {
            Logger.error("OvalDiscovery", `Error updating instances: ${error}`);
        }

        // Schedule next update after the current one completes
        setTimeout(() => {
            this.updateInstances(lastBlock);
        }, env.ovalDiscoveryInterval * 1000);
    }

    // Update instances for a specific factory
    private async updateFactoryInstances(factory: any, fromBlock: number, toBlock: number) {
        const searchConfig: EventSearchConfig = {
            fromBlock,
            toBlock,
            maxBlockLookBack: 20000
        };

        try {
            const ovalDeployments = await paginatedEventQuery(
                factory.connect(this.provider!),
                factory.filters.OvalDeployed(undefined, undefined, undefined, undefined, undefined, undefined),
                searchConfig
            );

            ovalDeployments.forEach((ovalDeployment: EventLog) => {
                Logger.debug("OvalDiscovery", `Found Oval deployment: ${ovalDeployment.args[1]}`);
                this.ovalInstances.add(getAddress(ovalDeployment.args[1]));
            });
        } catch (error) {
            Logger.error("OvalDiscovery", `Error querying factory ${factory.address}: ${error}`);
        }
    }

    // Returns all discovered Oval instances
    public getOvalFactoryInstances(): Array<string> {
        return Array.from(this.ovalInstances);
    }

    // Checks if the given address is an Oval instance
    public isOval(address: string): boolean {
        return this.ovalInstances.has(address);
    }
}