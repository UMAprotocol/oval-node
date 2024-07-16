import { expect } from 'chai';
import sinon from 'sinon';
import { WalletManager } from '../src/lib/walletManager';
import { JsonRpcProvider, Wallet } from 'ethers';
import "../src/lib/express-extensions";
import * as gckms from '../src/lib/gckms';

// Mock the necessary dependencies
const mockProvider = new JsonRpcProvider();
const mockWallet = new Wallet('0x0123456789012345678901234567890123456789012345678901234567890123');

const getRandomAddressAndKey = () => {
    const wallet = Wallet.createRandom();
    return {
        address: wallet.address,
        privateKey: wallet.privateKey,
    };
};
describe('WalletManager Tests', () => {
    beforeEach(() => {
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
        const gckmsRandom = getRandomAddressAndKey();
        const unlockerRandom = getRandomAddressAndKey();
        const refundRandom = getRandomAddressAndKey().address;
        const oval1 = getRandomAddressAndKey().address;
        const oval2 = getRandomAddressAndKey().address;
        const ovalConfigs = {
            [oval1]: { unlockerKey: unlockerRandom.privateKey, refundAddress: refundRandom, refundPercent: 10 },
            [oval2]: { gckmsKeyId: 'gckmsKeyId456', refundAddress: refundRandom, refundPercent: 20 },
        };
        sinon.stub(gckms, 'retrieveGckmsKey').resolves(gckmsRandom.privateKey);
        const walletManager = WalletManager.getInstance(mockProvider);
        await walletManager.initialize(ovalConfigs);

        const walletRandom = walletManager.getWallet(oval1);
        expect(walletRandom?.privateKey).to.equal(unlockerRandom.privateKey);

        const walletGckms = walletManager.getWallet(oval2);
        expect(walletGckms?.privateKey).to.equal(gckmsRandom.privateKey);
    });

    it('should initialize with valid ovalConfigs and sharedConfigs', async () => {
        const gckmsRandom = getRandomAddressAndKey();
        const unlockerRandom = getRandomAddressAndKey();
        const refundRandom = getRandomAddressAndKey().address;
        const oval1 = getRandomAddressAndKey().address;
        const oval2 = getRandomAddressAndKey().address;
        const ovalConfigs = {};
        const sharedConfigs = [
            { unlockerKey: unlockerRandom.privateKey, refundAddress: refundRandom, refundPercent: 10 },
            { gckmsKeyId: 'gckmsKeyId456', refundAddress: refundRandom, refundPercent: 20 },
        ];
        sinon.stub(gckms, 'retrieveGckmsKey').resolves(gckmsRandom.privateKey);
        const walletManager = WalletManager.getInstance(mockProvider);
        await walletManager.initialize(ovalConfigs, sharedConfigs);

    });



});