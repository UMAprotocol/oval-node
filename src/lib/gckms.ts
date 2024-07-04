import kms from "@google-cloud/kms";
import { Storage } from "@google-cloud/storage";

export interface KeyConfig {
    projectId: string;
    locationId: string;
    keyRingId: string;
    cryptoKeyId: string;
    ciphertextBucket: string;
    ciphertextFilename: string;
}

const { GCP_STORAGE_CONFIG } = process.env;

// Allows the environment to customize the config that's used to interact with google cloud storage.
// Relevant options can be found here: https://googleapis.dev/nodejs/storage/latest/global.html#StorageOptions.
// Specific fields of interest:
// - timeout: allows the env to set the timeout for all http requests.
// - retryOptions: object that allows the caller to specify how the library retries.
const storageConfig = GCP_STORAGE_CONFIG ? JSON.parse(GCP_STORAGE_CONFIG) : undefined;

// This function takes an array of GCKMS configs that are shaped as follows:
// {
//   projectId: "project-name",
//   locationId: "asia-east2",
//   keyRingId: "Keyring_Test",
//   cryptoKeyId: "keyname",
//   ciphertextBucket: "cipher_bucket",
//   ciphertextFilename: "ciphertext_fname.enc",
// }
//
// It returns a private key that can be used to send transactions.
export async function retrieveGckmsKey(gckmsConfig: KeyConfig): Promise<string> {

    const storage = new Storage(storageConfig);
    const keyMaterialBucket = storage.bucket(gckmsConfig.ciphertextBucket);
    const ciphertextFile = keyMaterialBucket.file(gckmsConfig.ciphertextFilename);

    const contentsBuffer = (await ciphertextFile.download())[0];
    const ciphertext = contentsBuffer.toString("base64");

    // Send the request to decrypt the downloaded file.
    const client = new kms.KeyManagementServiceClient();
    const name = client.cryptoKeyPath(gckmsConfig.projectId, gckmsConfig.locationId, gckmsConfig.keyRingId, gckmsConfig.cryptoKeyId);
    const [result] = await client.decrypt({ name, ciphertext });
    if (!(result.plaintext instanceof Uint8Array)) throw new Error("result.plaintext wrong type");
    return "0x" + Buffer.from(result.plaintext).toString().trim();
}