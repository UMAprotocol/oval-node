import { JsonRpcProvider, Wallet, getAddress } from "ethers";
import { OvalConfigs, OvalConfigsShared } from "./types";
import { retrieveGckmsKey } from "./gckms";
import { env } from "./env";

type WalletConfig = {
    unlockerKey?: string;
    gckmsKeyId?: string;
};

type WalletUsed = {
    walletPubKey: string;
    targetBlock: number;
    count: number;
}

// WalletManager class to handle wallet operations.
export class WalletManager {
    private static instance: WalletManager;
    private wallets: Record<string, Wallet> = {};
    private sharedWallets: Map<string, Wallet> = new Map();
    private sharedWalletUsage: Map<string, Array<WalletUsed>> = new Map();
    private provider: JsonRpcProvider;

    private constructor(provider: JsonRpcProvider) {
        this.provider = provider;
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
        // Check if a wallet has already been assigned to this Oval instance
        if (this.sharedWalletUsage.has(ovalInstance)) {
            const previousAssignments = this.sharedWalletUsage.get(ovalInstance);
            if (previousAssignments) {
                const existingAssignment = previousAssignments.find(assignment => assignment.walletPubKey);
                if (existingAssignment) {
                    return this.sharedWallets.get(existingAssignment.walletPubKey)!.connect(this.provider);
                }
            }
        }

        // If no wallet has been assigned, find the least used wallet
        const selectedWallet = this.findLeastUsedWallet();
        if (selectedWallet) {
            this.updateWalletUsage(ovalInstance, selectedWallet, targetBlock);
            const selectedWalletPubKey = selectedWallet.address;
            this.sharedWallets.set(selectedWalletPubKey, selectedWallet);
            return selectedWallet.connect(this.provider);
        }

        throw new Error(`No available shared wallets for Oval instance ${ovalInstance} at block ${targetBlock}`);
    }

    // Private helper methods
    private setupCleanupInterval(): void {
        if (typeof global.it === 'function') {
            // Not running in a Mocha test
            return;
        }
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
                this.sharedWalletUsage.set(walletPubKey, []);
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
        const usageCount = new Map<string, number>()

        // Initialize usage counts for each wallet
        this.sharedWallets.forEach((_, walletPubKey) => {
            usageCount.set(walletPubKey, 0);
        });

        // Sum usage counts for each wallet
        this.sharedWalletUsage.forEach((usageRecords, _) => {
            usageRecords.forEach((record) => {
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
        const usageRecords = this.sharedWalletUsage.get(ovalInstance) || [];
        const existingRecord = usageRecords.find(record => record.walletPubKey === walletPubKey && record.targetBlock === targetBlock);

        if (existingRecord) {
            existingRecord.count += 1;
        } else {
            usageRecords.push({ walletPubKey, targetBlock, count: 1 });
        }

        this.sharedWalletUsage.set(ovalInstance, usageRecords);
    }

    private cleanupOldRecords(currentBlock: number): void {
        this.sharedWalletUsage.forEach((usageRecords, walletPubKey) => {
            const filteredRecords = usageRecords.filter(record => record.targetBlock >= currentBlock - 1);
            if (filteredRecords.length === 0) {
                this.sharedWalletUsage.delete(walletPubKey);
            } else {
                this.sharedWalletUsage.set(walletPubKey, filteredRecords);
            }
        });
    }
}