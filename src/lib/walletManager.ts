import { JsonRpcProvider, Wallet, getAddress } from "ethers";
import { OvalConfigs, OvalConfigsShared } from "./types";
import { retrieveGckmsKey } from "./gckms";
import { env } from "./env";

type WalletConfig = {
    unlockerKey?: string;
    gckmsKeyId?: string;
};

// WalletManager class to handle wallet operations.
export class WalletManager {
    private static instance: WalletManager;
    private wallets: Record<string, Wallet> = {};
    private sharedWallets: Map<string, Wallet> = new Map();
    private walletUsage: Map<Wallet, Map<number, number>> = new Map(); // Track wallet usage per wallet and targetBlock
    private provider: JsonRpcProvider;

    private constructor(provider: JsonRpcProvider) {
        this.provider = provider;
        // this.setupCleanupInterval();
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
    public getWallet(address: string): Wallet {
        const checkSummedAddress = getAddress(address);
        const wallet = this.wallets[checkSummedAddress];
        if (!wallet) {
            throw new Error(`No unlocker key or GCKMS key ID found for Oval address ${address}`);
        }
        return wallet.connect(this.provider);
    }

    // Get a shared wallet for a given Oval instance and target block
    public async getSharedWallet(ovalInstance: string, targetBlock: number, provider: JsonRpcProvider): Promise<Wallet> {
        const key = `${ovalInstance}-${targetBlock}`;

        if (this.sharedWallets.has(key)) {
            return this.sharedWallets.get(key)!.connect(provider);
        }

        const selectedWallet = this.findLeastUsedWallet(targetBlock);
        if (selectedWallet) {
            this.updateWalletUsage(selectedWallet, targetBlock);
            this.sharedWallets.set(key, selectedWallet);
            console.warn(`No available free shared wallets for Oval instance ${ovalInstance} at block ${targetBlock}, allocated least used wallet.`);
            return selectedWallet.connect(provider);
        }

        throw new Error(`No available shared wallets for Oval instance ${ovalInstance} at block ${targetBlock}`);
    }

    // Private helper methods
    private setupCleanupInterval(): void {
        setInterval(async () => {
            const currentBlock = await this.provider.getBlockNumber();
            this.cleanupOldRecords(currentBlock);
        }, 20 * 60 * 1000); // 20 minutes
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
                this.walletUsage.set(wallet, new Map());
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

    private findLeastUsedWallet(targetBlock: number): Wallet | undefined {
        let selectedWallet: Wallet | undefined;
        let minUsageCount = Infinity;

        this.walletUsage.forEach((usageMap, wallet) => {
            const usageCount = usageMap.get(targetBlock) || 0;
            if (usageCount < minUsageCount) {
                minUsageCount = usageCount;
                selectedWallet = wallet;
            }
        });

        return selectedWallet;
    }

    private updateWalletUsage(wallet: Wallet, targetBlock: number): void {
        const usageMap = this.walletUsage.get(wallet) || new Map();
        const usageCount = (usageMap.get(targetBlock) || 0) + 1;
        usageMap.set(targetBlock, usageCount);
        this.walletUsage.set(wallet, usageMap);
    }

    private cleanupOldRecords(currentBlock: number): void {
        this.sharedWallets.forEach((wallet, key) => {
            const [, targetBlockStr] = key.split("-");
            const targetBlock = parseInt(targetBlockStr, 10);
            if (targetBlock < currentBlock - 1) {
                this.sharedWallets.delete(key);
                this.cleanupWalletUsage(wallet, targetBlock);
            }
        });
    }

    private cleanupWalletUsage(wallet: Wallet, targetBlock: number): void {
        const usageMap = this.walletUsage.get(wallet);
        if (usageMap) {
            usageMap.delete(targetBlock);
            if (usageMap.size === 0) {
                this.walletUsage.delete(wallet);
            }
        }
    }
}