import { writeFile } from 'node:fs/promises';
import { validateTransaction } from '../../../src/submit-strategy.js';

const api = {
  registry: { signedExtensions: ['CheckNonZeroSender', 'CheckSpecVersion', 'CheckTxVersion', 'CheckGenesis', 'CheckMortality', 'CheckNonce', 'CheckWeight', 'CheckCallFilter', 'CheckThrottle'] },
  tx: {
    midnight: {
      sendMnTransaction(innerTxHex) {
        return {
          toHex: () => `0xfeed${innerTxHex.slice(2)}`,
          async send(_callback) {
            return () => {};
          },
        };
      },
    },
  },
  call: {
    taggedTransactionQueue: {
      validateTransaction: async (source) => ({
        toString: () => `${source}:accepted`,
        toHuman: () => ({ source, outcome: 'accepted' }),
        toJSON: () => ({ source, outcome: 'accepted' }),
      }),
    },
  },
  rpc: {
    chain: { getBlockHash: async () => ({ toString: () => '0xbest' }) },
    author: { submitExtrinsic: async () => ({ toString: () => '0xraw' }) },
  },
  async disconnect() { return undefined; },
};

const startedAt = Date.now();
const outcome = await Promise.race([
  validateTransaction({ kind: 'deploy', finalizedTxHex: '0x1234' }, { network: 'preprod', api, strategy: 'metadata-extrinsic', submit: true })
    .then(() => ({ settled: true }))
    .catch((error) => ({ settled: true, error: error instanceof Error ? error.message : String(error) })),
  new Promise((resolve) => setTimeout(() => resolve({ settled: false, timeoutMs: Date.now() - startedAt }), 300)),
]);
await writeFile(new URL('../results/metadata-submit-hang.json', import.meta.url), `${JSON.stringify(outcome, null, 2)}\n`);
console.log(JSON.stringify(outcome, null, 2));
