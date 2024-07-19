import { JsonRpcProvider, Wallet, getAddress } from "ethers";
import { OvalDiscovery } from "./";
import { env } from "./env";
import { retrieveGckmsKey } from "./gckms";
import { isMochaTest } from "./helpers";
import { OvalConfigs, OvalConfigsShared } from "./types";

type WalletConfig = {
    unlockerKey?: string;
    gckmsKeyId?: string;
};

type WalletUsed = {
    count: number;
    walletPubKey: string;
    ovalInstances: Set<string>;
};

// WalletManager class to handle wallet operations.
export class WalletManager {
    private static instance: WalletManager;
    private ovalDiscovery: OvalDiscovery;
    private wallets: Record<string, Wallet> = {};
    private sharedWallets: Map<string, Wallet> = new Map();
    private sharedWalletUsage: Map<string, Map<number, WalletUsed>> = new Map();
    private provider: JsonRpcProvider | undefined;

    private constructor() {
        this.ovalDiscovery = OvalDiscovery.getInstance();
    }

    // Singleton pattern to get an instance of WalletManager
    public static getInstance(): WalletManager {
        if (!WalletManager.instance) {
            WalletManager.instance = new WalletManager();
        }
        return WalletManager.instance;
    }

    // Initialize wallets with configurations
    public async initialize(provider: JsonRpcProvider, ovalConfigs: OvalConfigs, sharedConfigs?: OvalConfigsShared): Promise<void> {
        this.provider = provider;
        await this.initializeWallets(ovalConfigs);
        if (sharedConfigs) {
            await this.initializeSharedWallets(sharedConfigs);
        }
        this.setupCleanupInterval();
    }

    // Get a wallet for a given address
    public getWallet(address: string, targetBlock: number): Wallet {
        if (!this.provider) {
            throw new Error("Provider is not initialized");
        }
        const checkSummedAddress = getAddress(address);
        const wallet = this.wallets[checkSummedAddress];
        if (!wallet) {
            return this.getSharedWallet(address, targetBlock);
        }
        return wallet.connect(this.provider);
    }


    // Get a shared wallet for a given Oval instance and target block
    private getSharedWallet(ovalInstance: string, targetBlock: number): Wallet {
        if (!this.provider) {
            throw new Error("Provider is not initialized");
        }
        if (!this.ovalDiscovery.isOval(ovalInstance)) {
            throw new Error(`Oval instance ${ovalInstance} is not found`);
        }

        // Check if a wallet has already been assigned to this Oval instance
        for (const [walletPubKey, instanceUsage] of this.sharedWalletUsage.entries()) {
            for (const [block, record] of instanceUsage.entries()) {
                if (record.ovalInstances && record.ovalInstances.has(ovalInstance)) {
                    return this.sharedWallets.get(record.walletPubKey)!.connect(this.provider!);
                }
            }
        }

        // If no wallet has been assigned, find the least used wallet
        const selectedWallet = this.findLeastUsedWallet();
        if (selectedWallet) {
            this.updateWalletUsage(ovalInstance, selectedWallet, targetBlock);
            return selectedWallet.connect(this.provider);
        }

        throw new Error(`No available shared wallets for Oval instance ${ovalInstance} at block ${targetBlock}`);
    }

    public isOvalSharedUnlocker(unlockerPublicKey: string): boolean {
        return this.sharedWallets.has(unlockerPublicKey);
    }

    // Private helper methods
    private setupCleanupInterval(): void {
        if (isMochaTest() || !this.provider) return;
        setInterval(async () => {
            if (!this.provider) return;
            const currentBlock = await this.provider.getBlockNumber();
            this.cleanupOldRecords(currentBlock);
        }, env.sharedWalletUsageCleanupInterval * 1000);
    }

    private async initializeWallets(configs: OvalConfigs): Promise<void> {
        for (const [address, config] of Object.entries(configs)) {
            this.wallets[address] = await this.createWallet(config);
        }
    }

    private async initializeSharedWallets(configs: OvalConfigsShared): Promise<void> {
        for (const config of configs) {
            const wallet = await this.createWallet(config);
            if (wallet) {
                const walletPubKey = await wallet.getAddress();
                this.sharedWallets.set(walletPubKey, wallet);
            }
        }
    }

    private async createWallet(config: WalletConfig): Promise<Wallet> {
        if (config.unlockerKey) {
            return new Wallet(config.unlockerKey);
        }
        if (config.gckmsKeyId) {
            const gckmsKey = await retrieveGckmsKey({
                ...JSON.parse(env.gckmsConfig),
                cryptoKeyId: config.gckmsKeyId,
                ciphertextFilename: `${config.gckmsKeyId}.enc`,
            });
            return new Wallet(gckmsKey);
        }
        throw new Error('Invalid wallet configuration');
    }

    private findLeastUsedWallet(): Wallet | undefined {
        let selectedWallet: Wallet | undefined;
        const totalUsage = new Map<string, {
            totalCount: number;
            ovalInstances: Set<string>;
        }>();

        // Initialize total usage counts for each wallet
        this.sharedWallets.forEach((wallet) => {
            totalUsage.set(wallet.address, { totalCount: 0, ovalInstances: new Set() });
        });

        // Sum usage counts for each wallet
        this.sharedWalletUsage.forEach((instanceUsage) => {
            instanceUsage.forEach((record) => {
                const totalInstanceUsage = totalUsage.get(record.walletPubKey)!;
                totalInstanceUsage.totalCount += record.count;
                record.ovalInstances.forEach(instance => totalInstanceUsage.ovalInstances.add(instance));
                totalUsage.set(record.walletPubKey, totalInstanceUsage);
            });
        });

        // Find the wallet with the least usage
        let minInstances = Infinity;
        let minUsage = Infinity;
        totalUsage.forEach((usage, walletPubKey) => {
            const instanceCount = usage.ovalInstances.size;
            if (instanceCount < minInstances || (instanceCount === minInstances && usage.totalCount < minUsage)) {
                minInstances = instanceCount;
                minUsage = usage.totalCount;
                selectedWallet = this.sharedWallets.get(walletPubKey);
            }
        });

        return selectedWallet;
    }

    private async updateWalletUsage(ovalInstance: string, wallet: Wallet, targetBlock: number): Promise<void> {
        const walletPubKey = await wallet.getAddress();
        const instanceUsage = this.sharedWalletUsage.get(walletPubKey) || new Map();
        const existingRecord = instanceUsage.get(targetBlock);

        if (existingRecord) {
            (existingRecord as WalletUsed).count += 1;
            (existingRecord as WalletUsed).ovalInstances.add(ovalInstance);
        } else {
            instanceUsage.set(targetBlock, { walletPubKey, count: 1, ovalInstances: new Set([ovalInstance]) });
        }

        this.sharedWalletUsage.set(walletPubKey, instanceUsage);
    }

    private cleanupOldRecords(currentBlock: number): void {
        this.sharedWalletUsage.forEach((instanceUsage, ovalInstance) => {
            instanceUsage.forEach((_, blockNumber) => {
                if (blockNumber < currentBlock - 1) {
                    instanceUsage.delete(blockNumber);
                }
            });
            if (instanceUsage.size === 0) {
                this.sharedWalletUsage.delete(ovalInstance);
            }
        });
    }
}