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

    // Singleton pattern to get an instance of WalletManager
    public static getInstance(): OvalDiscovery {
        if (!OvalDiscovery.instance) {
            OvalDiscovery.instance = new OvalDiscovery();
            OvalDiscovery.instance.findOval(FACTORIES_GENESIS_BLOCK);
        }
        return OvalDiscovery.instance;
    }

    public async initialize(provider: JsonRpcProvider) {
        if (this.provider) return;
        this.provider = provider;
        this.findOval(FACTORIES_GENESIS_BLOCK);
    }

    public async findOval(fromBlock: number) {
        if (!this.provider) return;
        const lastBlock = await this.provider.getBlockNumber();

        const factories = [this.standardCoinbaseFactory, this.standardChainlinkFactory, this.standardChronicleFactory, this.standardPythFactory];

        for (const factory of factories) {
            const searchConfig: EventSearchConfig = {
                fromBlock,
                toBlock: lastBlock,
                maxBlockLookBack: 20000
            };
            const ovalDeployments = await paginatedEventQuery(factory.connect(this.provider), factory.filters.OvalDeployed(undefined, undefined, undefined, undefined, undefined, undefined), searchConfig);

            ovalDeployments.forEach((ovalDeployment: EventLog) => {
                this.ovalInstances.add(getAddress(ovalDeployment.args[1]));
            });
        }

        setTimeout(() => {
            this.findOval(lastBlock);
        }, env.ovalDiscoveryInterval * 1000);
    }

    public getOvalFactoryInstances(): Array<string> {
        return Array.from(this.ovalInstances);
    }

    public isOval(address: string): boolean {
        return this.ovalInstances.has(address);
    }
}