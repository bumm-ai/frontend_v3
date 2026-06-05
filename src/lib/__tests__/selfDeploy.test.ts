import { describe, expect, it } from 'vitest';
import { Keypair } from '@solana/web3.js';
import {
  base64ToBytes,
  buildSelfDeployPlan,
  selfDeployAccountSizes,
  walletCanSelfDeploy,
} from '@/lib/selfDeploy';

describe('walletCanSelfDeploy', () => {
  it('requires a connected wallet with signAllTransactions', () => {
    expect(walletCanSelfDeploy(null)).toBe(false);
    expect(walletCanSelfDeploy({ publicKey: null })).toBe(false);
    expect(walletCanSelfDeploy({ publicKey: Keypair.generate().publicKey })).toBe(false);
    expect(
      walletCanSelfDeploy({
        publicKey: Keypair.generate().publicKey,
        signAllTransactions: async (t) => t,
      }),
    ).toBe(true);
  });
});

describe('base64ToBytes', () => {
  it('round-trips a base64 payload', () => {
    const b64 = btoa(String.fromCharCode(0x7f, 0x45, 0x4c, 0x46)); // \x7fELF
    expect([...base64ToBytes(b64)]).toEqual([0x7f, 0x45, 0x4c, 0x46]);
  });
});

describe('selfDeployAccountSizes', () => {
  it('buffer = 37 + len, program = 36', () => {
    const { bufferSize, programSize } = selfDeployAccountSizes(1000);
    expect(bufferSize).toBe(1037);
    expect(programSize).toBe(36);
  });
});

describe('buildSelfDeployPlan', () => {
  const payer = Keypair.generate();
  const programKeypair = Keypair.generate();
  const bufferKeypair = Keypair.generate();
  const programBytes = new Uint8Array(2500).fill(7);
  const blockhash = '11111111111111111111111111111111'; // 32-byte base58

  const plan = buildSelfDeployPlan({
    payer: payer.publicKey,
    programKeypair,
    bufferKeypair,
    programBytes,
    bufferLamports: 7_000_000,
    programLamports: 1_000_000,
    recentBlockhash: blockhash,
  });

  it('orders create → writes → deploy', () => {
    expect(plan.writes).toHaveLength(3); // 2500 / 1011 = 3 chunks
    expect(plan.ordered).toHaveLength(5); // 1 create + 3 writes + 1 deploy
    expect(plan.ordered[0]).toBe(plan.create);
    expect(plan.ordered[4]).toBe(plan.deploy);
  });

  it('create has createAccount + initializeBuffer and is co-signed by the buffer key', () => {
    expect(plan.create.instructions).toHaveLength(2);
    expect(plan.create.feePayer?.equals(payer.publicKey)).toBe(true);
    expect(plan.create.recentBlockhash).toBe(blockhash);
    const sig = plan.create.signatures.find((s) =>
      s.publicKey.equals(bufferKeypair.publicKey),
    );
    expect(sig?.signature).not.toBeNull(); // buffer keypair partial-signed
  });

  it('deploy has createAccount(program) + deploy and is co-signed by the program key', () => {
    expect(plan.deploy.instructions).toHaveLength(2);
    const sig = plan.deploy.signatures.find((s) =>
      s.publicKey.equals(programKeypair.publicKey),
    );
    expect(sig?.signature).not.toBeNull(); // program keypair partial-signed
    // The wallet (payer) signature slot exists but is still empty until the wallet signs.
    const payerSig = plan.deploy.signatures.find((s) => s.publicKey.equals(payer.publicKey));
    expect(payerSig?.signature).toBeNull();
  });

  it('every write tx is fee-paid by the user and carries the blockhash', () => {
    for (const w of plan.writes) {
      expect(w.instructions).toHaveLength(1);
      expect(w.feePayer?.equals(payer.publicKey)).toBe(true);
      expect(w.recentBlockhash).toBe(blockhash);
    }
  });

  it('defaults maxDataLen to 2x the program size', () => {
    // DeployWithMaxDataLen data = [2,0,0,0] + u64(maxDataLen). Bytes 4..12 = LE u64.
    const deployIx = plan.deploy.instructions[1];
    const dv = new DataView(
      deployIx.data.buffer,
      deployIx.data.byteOffset,
      deployIx.data.byteLength,
    );
    expect(Number(dv.getBigUint64(4, true))).toBe(2500 * 2);
  });
});
