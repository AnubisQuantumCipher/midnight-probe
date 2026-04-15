import { writeFile } from 'node:fs/promises';
import { runChainCanary } from '../../../src/chain-canary.js';

const api = {
  registry: { signedExtensions: ['CheckNonZeroSender', 'CheckSpecVersion', 'CheckTxVersion', 'CheckGenesis', 'CheckMortality', 'CheckNonce', 'CheckWeight', 'CheckCallFilter', 'CheckThrottle', 'UnexpectedExtension'] },
  tx: {
    midnight: {
      sendMnTransaction(innerTxHex) {
        return { toHex: () => `0xfeed${innerTxHex.slice(2)}` };
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
    chain: {
      async getHeader() { return { number: { toNumber: () => 1 } }; },
      async getBlockHash(number) { return { toString: () => `0xblock${number}` }; },
      async getBlock() {
        return {
          block: {
            extrinsics: [{
              hash: { toHex: () => '0xmatch' },
              method: {
                section: 'midnight',
                method: 'sendMnTransaction',
                args: [{ toHex: () => '0x1234' }],
              },
            }],
          },
        };
      },
    },
  },
  async disconnect() { return undefined; },
};

const result = await runChainCanary({ network: 'preprod', txHash: '0xmatch', api });
const summary = {
  runtimeSignedExtensions: result.validation.signedExtensions.runtimeSignedExtensions,
  injectedSignedExtensions: result.validation.signedExtensions.injectedSignedExtensions,
  unknownSignedExtensions: result.validation.signedExtensions.unknownSignedExtensions,
  unexpectedPresentInRuntime: result.validation.signedExtensions.runtimeSignedExtensions.includes('UnexpectedExtension'),
  note: 'runChainCanary reports unknownSignedExtensions as [] even when runtimeSignedExtensions contains an unexpected entry.',
};
await writeFile(new URL('../results/chain-canary-signed-ext.json', import.meta.url), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
