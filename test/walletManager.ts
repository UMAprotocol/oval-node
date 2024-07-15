import { expect } from 'chai';
import sinon from 'sinon';
import { WalletManager } from '../src/lib/walletManager';
import { JsonRpcProvider, Wallet } from 'ethers';
import "../src/lib/express-extensions";

// Mock the necessary dependencies
const mockProvider = new JsonRpcProvider();
const mockWallet = new Wallet('0x0123456789012345678901234567890123456789012345678901234567890123');

describe('WalletManager Tests', () => {
    beforeEach(() => {
        sinon.stub(Wallet, 'createRandom').returns(mockWallet as any);
        sinon.stub(JsonRpcProvider.prototype, 'getBlockNumber').resolves(123); // Example of stubbing a method
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should return a singleton instance', () => {
        const instance1 = WalletManager.getInstance(mockProvider);
        const instance2 = WalletManager.getInstance(mockProvider);
        expect(instance1).to.equal(instance2);
    });

    it('should initialize with valid ovalConfigs', async () => {
        const ovalConfigs = {
            '0x123': { unlockerKey: 'unlockerKey123', refundAddress: '0x123', refundPercent: 10 },
            '0x456': { gckmsKeyId: 'gckmsKeyId456', refundAddress: '0x456', refundPercent: 20 },
        };
        const walletManager = WalletManager.getInstance(mockProvider);
        await walletManager.initialize(ovalConfigs);
        expect(walletManager.getWallet('0x123')).to.equal(mockWallet);
        expect(walletManager.getWallet('0x456')).to.equal(mockWallet);
    });

    it('should handle missing unlockerKey and gckmsKeyId in configs', async () => {
        const invalidConfigs = {
            '0x789': {},
        };
        const walletManager = WalletManager.getInstance(mockProvider);
        // await expect(walletManager.initialize(invalidConfigs as any)).to.be.re
    });

    it('should retrieve a wallet by address and connect to provider', () => {
        const ovalConfigs = {
            '0x123': { unlockerKey: 'unlockerKey123', refundAddress: '0x123', refundPercent: 10 },
        };
        const walletManager = WalletManager.getInstance(mockProvider);
        walletManager.initialize(ovalConfigs);
        const wallet = walletManager.getWallet('0x123');
        expect(wallet).to.equal(mockWallet);
    });

    it('should throw error for invalid address', () => {
        const walletManager = WalletManager.getInstance(mockProvider);
        expect(() => walletManager.getWallet('0x999')).to.throw('No unlocker key or GCKMS key ID found for Oval address 0x999');
    });

});