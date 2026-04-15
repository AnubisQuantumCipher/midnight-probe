import { writeFile } from 'node:fs/promises';
import { validateTransaction } from '../../../src/submit-strategy.js';

const api = {
  registry: { signedExtensions: ['CheckNonZeroSender', 'CheckSpecVersion', 'CheckTxVersion', 'CheckGenesis', 'CheckMortality', 'CheckNonce', 'CheckWeight', 'CheckCallFilter', 'CheckThrottle'] },
  tx: {
    midnight: {
      sendMnTransaction(innerTxHex) {
        return {
          toHex: () => `0xfeed${innerTxHex.slice(2)}`,
          async send() {
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
const report = await validateTransaction(
  { kind: 'deploy', finalizedTxHex: '0x1234' },
  { network: 'preprod', api, strategy: 'metadata-extrinsic', submit: true, submitTimeoutMs: 10 },
);

const result = {
  elapsedMs: Date.now() - startedAt,
  outcome: report.submit.outcome,
  detail: report.submit.detail,
};
await writeFile(new URL('../results/metadata-timeout-check.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
