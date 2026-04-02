import { describe, expect, it } from 'vitest';

import { runChainCanary } from '../src/chain-canary.js';
import { makeFakeApi } from './helpers.js';

describe('chain canary', () => {
  it('finds a known tx hash and validates the rebuilt outer extrinsic', async () => {
    const api = makeFakeApi({
      rpc: {
        chain: {
          async getHeader() {
            return {
              number: {
                toNumber: () => 5,
              },
            };
          },
          async getBlockHash(number: number) {
            return {
              toString: () => `0xblock${number}`,
            };
          },
          async getBlock() {
            return {
              block: {
                extrinsics: [
                  {
                    hash: {
                      toHex: () => '0xmatch',
                    },
                    method: {
                      section: 'midnight',
                      method: 'sendMnTransaction',
                      args: [
                        {
                          toHex: () => '0x1234',
                        },
                      ],
                    },
                  },
                ],
              },
            };
          },
        },
      },
    });

    const result = await runChainCanary({
      network: 'preprod',
      txHash: '0xmatch',
      api,
    });

    expect(result.lookup.txHash).toBe('0xmatch');
    expect(result.validation.validation).toHaveLength(3);
    expect(result.validation.submit.outcome).toBe('skipped');
  });
});
