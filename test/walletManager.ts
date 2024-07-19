import { expect } from 'chai';
import sinon from 'sinon';
import { WalletManager } from '../src/lib/walletManager';
import { JsonRpcProvider, Wallet } from 'ethers';
import "../src/lib/express-extensions";
import * as gckms from '../src/lib/gckms';
import * as ovalDiscovery from '../src/lib/ovalDiscovery';
import { OvalConfigs, OvalConfigsShared } from '../src/lib/types';


const mockProvider = new JsonRpcProvider();

const getRandomAddressAndKey = () => {
    const wallet = Wallet.createRandom();
    return {
        address: wallet.address,
        privateKey: wallet.privateKey,
    };
};

describe('WalletManager Tests', () => {

    beforeEach(() => {
        const ovalDiscoveryInstance = {
            isOval: sinon.stub().resolves(true),
            findOval: sinon.stub().resolves()
        };
        sinon.stub(ovalDiscovery.OvalDiscovery, 'getInstance').returns(ovalDiscoveryInstance as any);
        // Cleanup old records
        WalletManager.getInstance()['cleanupOldRecords'](Infinity);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should return a singleton instance', () => {
        const instance1 = WalletManager.getInstance();
        const instance2 = WalletManager.getInstance();
        expect(instance1).to.equal(instance2);
    });

    it('should initialize with valid ovalConfigs', async () => {
        const gckmsRandom = getRandomAddressAndKey();
        const unlockerRandom = getRandomAddressAndKey();
        const refundRandom = getRandomAddressAndKey().address;
        const oval1 = getRandomAddressAndKey().address;
        const oval2 = getRandomAddressAndKey().address;
        const ovalConfigs: OvalConfigs = {
            [oval1]: { unlockerKey: unlockerRandom.privateKey, refundAddress: refundRandom, refundPercent: 10 },
            [oval2]: { gckmsKeyId: 'gckmsKeyId456', refundAddress: refundRandom, refundPercent: 20 },
        };
        sinon.stub(gckms, 'retrieveGckmsKey').resolves(gckmsRandom.privateKey);
        const walletManager = WalletManager.getInstance();
        await walletManager.initialize(mockProvider, ovalConfigs);

        const walletRandom = walletManager.getWallet(oval1, 123);
        expect(walletRandom?.privateKey).to.equal(unlockerRandom.privateKey);

        const walletGckms = walletManager.getWallet(oval2, 123);
        expect(walletGckms?.privateKey).to.equal(gckmsRandom.privateKey);
    });

    it('should initialize with valid ovalConfigs and sharedConfigs', async () => {
        const gckmsRandom = getRandomAddressAndKey();
        const unlockerRandom = getRandomAddressAndKey();
        const sharedConfigs: OvalConfigsShared = [
            { unlockerKey: unlockerRandom.privateKey },
            { gckmsKeyId: 'gckmsKeyId456' },
        ];
        sinon.stub(gckms, 'retrieveGckmsKey').resolves(gckmsRandom.privateKey);
        const walletManager = WalletManager.getInstance();
        await walletManager.initialize(mockProvider, {}, sharedConfigs);

        // Check if shared wallets are initialized
        const sharedWallets = Array.from(walletManager['sharedWallets'].values());
        expect(sharedWallets).to.have.lengthOf(2);
    });

    it('should return the same shared wallet for the same ovalInstance', async () => {
        const unlockerRandom = getRandomAddressAndKey();
        const sharedConfigs: OvalConfigsShared = [
            { unlockerKey: unlockerRandom.privateKey },
        ];
        const walletManager = WalletManager.getInstance();

        await walletManager.initialize(mockProvider, {}, sharedConfigs);

        const ovalInstance = 'ovalInstance1';
        const targetBlock = 123;


        const wallet1 = await walletManager['getSharedWallet'](ovalInstance, targetBlock);
        const wallet2 = await walletManager['getSharedWallet'](ovalInstance, targetBlock + 1);

        expect(wallet1.address).to.equal(wallet2.address);
    });

    it('should assign the least used shared wallet when no previous assignment exists', async () => {
        const unlockerRandom1 = getRandomAddressAndKey();
        const unlockerRandom2 = getRandomAddressAndKey();
        const sharedConfigs: OvalConfigsShared = [
            { unlockerKey: unlockerRandom1.privateKey },
            { unlockerKey: unlockerRandom2.privateKey },
        ];
        const walletManager = WalletManager.getInstance();
        await walletManager.initialize(mockProvider, {}, sharedConfigs);

        const ovalInstance1 = 'ovalInstance1';
        const ovalInstance2 = 'ovalInstance2';
        const targetBlock = 123;

        const wallet1 = await walletManager['getSharedWallet'](ovalInstance1, targetBlock);
        const wallet2 = await walletManager['getSharedWallet'](ovalInstance2, targetBlock);

        // As these are the first assignments, wallet1 and wallet2 should be different
        expect(wallet1.address).to.not.equal(wallet2.address);
    });

    it('should cleanup old records correctly', async () => {
        const unlockerRandom = getRandomAddressAndKey();
        const sharedConfigs: OvalConfigsShared = [
            { unlockerKey: unlockerRandom.privateKey },
        ];
        const walletManager = WalletManager.getInstance();
        await walletManager.initialize(mockProvider, {}, sharedConfigs);

        const ovalInstance = 'ovalInstance1';
        const targetBlock = 123;

        await walletManager['getSharedWallet'](ovalInstance, targetBlock);

        walletManager['cleanupOldRecords'](targetBlock + 2);

        const sharedWalletUsage = walletManager['sharedWalletUsage'].get(ovalInstance);
        expect(sharedWalletUsage).to.be.undefined;
    });
});