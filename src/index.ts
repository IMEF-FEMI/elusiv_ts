// We sign using an external library here because there is no wallet connected. Usually you'd use the solana wallet adapter instead.
import bs58 from "bs58"
import * as ed from "@noble/ed25519"
import { sha512 } from "@noble/hashes/sha512"
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m))
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { Elusiv, SEED_MESSAGE } from '@elusiv/sdk';
import userJson from '../user-keypair.json'

async function main() {
    const secretKeyString = new Uint8Array(userJson);
    const userKp = Keypair.fromSecretKey(secretKeyString);
    // Generate the input seed. Remember, this is almost as important as the private key, so don't log this!
    // (Slice because in Solana's keypair type the first 32 bytes is the privkey and the last 32 is the pubkey)
    const seed = await ed.sign(
        Buffer.from(SEED_MESSAGE, 'utf-8'),
        userKp.secretKey.slice(0, 32),
    );
    const connection = new Connection('https://api.devnet.solana.com')

    const airdropSignature = await connection.requestAirdrop(
        userKp.publicKey,
        LAMPORTS_PER_SOL
    );

    await connection.confirmTransaction(airdropSignature);
    console.log("Airdrop transaction: ",`https://solscan.io/tx/${airdropSignature}?cluster=devnet`);

    // Create the elusiv instance
    const elusiv = await Elusiv.getElusivInstance(seed, userKp.publicKey, connection, 'devnet');

    // Top up our private balance with 1 SOL (= 1_000_000_000 Lamports)
    const topupTxData = await elusiv.buildTopUpTx(LAMPORTS_PER_SOL * 0.5, 'LAMPORTS');
    topupTxData.tx.partialSign(userKp);
    // Send it off
    const topupSig = await elusiv.sendElusivTx(topupTxData);

    // Send half a SOL, privately 😎
    const recipient = new PublicKey("7UjbWK5hxhK9iMd4DQEG4MDfyxSejx8YA3uAor9tjFQF");
    const sendTx = await elusiv.buildSendTx(0.4 * LAMPORTS_PER_SOL, recipient, 'LAMPORTS');
    // No need to sign as we prove ownership of the private funds using a zero knowledge proof
    const sendSig = await elusiv.sendElusivTx(sendTx);

    console.log(`Performed topup with sig ${topupSig.signature} and send with sig ${sendSig.signature}`);
}

main();