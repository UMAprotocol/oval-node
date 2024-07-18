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
    walletPubKey: string;
    count: number;
};

// WalletManager class to handle wallet operations.
export class WalletManager {
    private static instance: WalletManager;
    private ovalDiscovery: OvalDiscovery;
    private wallets: Record<string, Wallet> = {};
    private sharedWallets: Map<string, Wallet> = new Map();
    private sharedWalletUsage: Map<string, Map<number, WalletUsed>> = new Map();
    private provider: JsonRpcProvider;

    private constructor(provider: JsonRpcProvider) {
        this.provider = provider;
        this.ovalDiscovery = OvalDiscovery.getInstance();
        this.setupCleanupInterval();
    }

    // Singleton pattern to get an instance of WalletManager
    public static getInstance(provider: JsonRpcProvider): WalletManager {
        if (!WalletManager.instance) {
            WalletManager.instance = new WalletManager(provider);
        }
        return WalletManager.instance;
    }

    // Initialize wallets with configurations
    public async initialize(ovalConfigs: OvalConfigs, sharedConfigs?: OvalConfigsShared): Promise<void> {
        await this.initializeWallets(ovalConfigs);
        if (sharedConfigs) {
            await this.initializeSharedWallets(sharedConfigs);
        }
    }

    // Get a wallet for a given address
    public getWallet(address: string, targetBlock: number): Wallet {
        const checkSummedAddress = getAddress(address);
        const wallet = this.wallets[checkSummedAddress];
        if (!wallet) {
            return this.getSharedWallet(address, targetBlock);
        }
        return wallet.connect(this.provider);
    }


    // Get a shared wallet for a given Oval instance and target block
    private getSharedWallet(ovalInstance: string, targetBlock: number): Wallet {
        if (!this.ovalDiscovery.isOval(ovalInstance)) {
            throw new Error(`Oval instance ${ovalInstance} is not found`);
        }

        // Check if a wallet has already been assigned to this Oval instance
        const instanceUsage = this.sharedWalletUsage.get(ovalInstance);
        if (instanceUsage) {
            const [_, usage] = instanceUsage.entries().next().value;
            return this.sharedWallets.get(usage.walletPubKey)!.connect(this.provider);
        }

        // If no wallet has been assigned, find the least used wallet
        const selectedWallet = this.findLeastUsedWallet();
        if (selectedWallet) {
            this.updateWalletUsage(ovalInstance, selectedWallet, targetBlock);
            return selectedWallet.connect(this.provider);
        }

        throw new Error(`No available shared wallets for Oval instance ${ovalInstance} at block ${targetBlock}`);
    }

    // Private helper methods
    private setupCleanupInterval(): void {
        if (isMochaTest()) return;
        setInterval(async () => {
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
                this.sharedWalletUsage.set(walletPubKey, new Map());
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
        const usageCount = new Map<string, number>();

        // Initialize usage counts for each wallet
        this.sharedWallets.forEach((_, walletPubKey) => {
            usageCount.set(walletPubKey, 0);
        });

        // Sum usage counts for each wallet
        this.sharedWalletUsage.forEach((instanceUsage) => {
            instanceUsage.forEach((record) => {
                const count = usageCount.get(record.walletPubKey) || 0;
                usageCount.set(record.walletPubKey, count + record.count);
            });
        });

        // Find the wallet with the least usage
        let minUsage = Infinity;
        usageCount.forEach((count, walletPubKey) => {
            if (count < minUsage) {
                minUsage = count;
                selectedWallet = this.sharedWallets.get(walletPubKey);
            }
        });

        return selectedWallet;
    }

    private async updateWalletUsage(ovalInstance: string, wallet: Wallet, targetBlock: number): Promise<void> {
        const walletPubKey = await wallet.getAddress();
        const instanceUsage = this.sharedWalletUsage.get(ovalInstance) || new Map();
        const existingRecord = instanceUsage.get(targetBlock);

        if (existingRecord) {
            existingRecord.count += 1;
        } else {
            instanceUsage.set(targetBlock, { walletPubKey, count: 1 });
        }

        this.sharedWalletUsage.set(ovalInstance, instanceUsage);
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