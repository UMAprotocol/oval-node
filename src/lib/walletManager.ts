import { JsonRpcProvider, Wallet, getAddress } from "ethers";
import { Logger, OvalDiscovery } from "./";
import { env } from "./env";
import { retrieveGckmsKey } from "./gckms";
import { isMochaTest } from "./helpers";
import { OvalConfigs, OvalConfigsShared } from "./types";
import { PermissionProxy__factory } from "../contract-types";

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
    public getWallet(address: string, targetBlock: number, transactionId: string): Wallet {
        if (!this.provider) {
            throw new Error("Provider is not initialized");
        }
        const checkSummedAddress = getAddress(address);
        const wallet = this.wallets[checkSummedAddress];
        if (!wallet) {
            return this.getSharedWallet(address, targetBlock, transactionId);
        }
        return wallet.connect(this.provider);
    }

    // Get a shared wallet for a given Oval instance and target block
    private getSharedWallet(ovalInstance: string, targetBlock: number, transactionId: string): Wallet {
        if (!this.provider) {
            throw new Error("Provider is not initialized");
        }
        if (!this.ovalDiscovery.isOval(ovalInstance)) {
            throw new Error(`Oval instance ${ovalInstance} is not found`);
        }

        let selectedWallet: Wallet | undefined;

        // Check if a wallet has already been assigned to this Oval instance
        for (const [walletPubKey, instanceUsage] of this.sharedWalletUsage.entries()) {
            for (const [_, record] of instanceUsage.entries()) {
                if (record.ovalInstances && record.ovalInstances.has(ovalInstance)) {
                    selectedWallet = this.sharedWallets.get(walletPubKey)!.connect(this.provider!);
                }
            }
        }

        // If no wallet has been assigned, find the least used wallet
        if (!selectedWallet) {
            selectedWallet = this.findLeastUsedWallet(transactionId);
        }

        // Update the usage of the selected wallet
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

    // Initialize regular wallets
    private async initializeWallets(configs: OvalConfigs): Promise<void> {
        for (const [address, config] of Object.entries(configs)) {
            this.wallets[getAddress(address)] = await this.createWallet(config);
        }
    }

    // Initialize shared wallets
    private async initializeSharedWallets(configs: OvalConfigsShared): Promise<void> {
        for (const config of configs) {
            const wallet = await this.createWallet(config);
            if (wallet) {
                const walletPubKey = await wallet.getAddress();

                // Check if the wallet is a sender in the PermissionProxy contract.
                const isSender = await PermissionProxy__factory.connect(env.permissionProxyAddress, this.provider!).senders(wallet.address);
                if (!isSender) {
                    throw new Error(`Wallet ${wallet.address} is not a sender in the PermissionProxy contract.`);
                }

                this.sharedWallets.set(walletPubKey, wallet);
            }
        }
    }

    // Create a wallet based on configuration
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

    // Find the least used wallet to avoid nonce collisions
    private findLeastUsedWallet(transactionId: string): Wallet | undefined {
        let selectedWallet: Wallet | undefined;
        const totalUsage = new Map<string, {
            totalCount: number;
            ovalInstances: Set<string>;
        }>();

        // Initialize total usage counts for each wallet
        this.sharedWallets.forEach((wallet) => {
            totalUsage.set(wallet.address, { totalCount: 0, ovalInstances: new Set() });
        });

        // Sum usage counts for each wallet and collect all Oval instances
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
            // If the wallet has been used in less Oval instances or the same number of instances but less total usage, select it
            if (instanceCount < minInstances || (instanceCount === minInstances && usage.totalCount < minUsage)) {
                minInstances = instanceCount;
                minUsage = usage.totalCount;
                selectedWallet = this.sharedWallets.get(walletPubKey);
            }
        });

        // Log an error if a wallet is reused across multiple Oval instances
        if (minInstances !== Infinity && minInstances !== 0) {
            Logger.error(transactionId, `Public key ${selectedWallet?.address} is reused in multiple Oval instances because no free wallets are available.`);
        }

        return selectedWallet;
    }

    // Update the usage statistics for a wallet
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

    // Cleanup old usage records that are no longer relevant
    private cleanupOldRecords(currentBlock: number): void {
        this.sharedWalletUsage.forEach((instanceUsage, ovalInstance) => {
            instanceUsage.forEach((_, blockNumber) => {
                // Delete record older than current block as they are no longer relevant
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