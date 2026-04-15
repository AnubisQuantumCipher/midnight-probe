import { describe, expect, it } from 'vitest';

import { validateMidnightOuterTx } from '../src/polkadot-factory.js';
import { validateTransaction } from '../src/submit-strategy.js';
import { makeFakeApi, makeFixtureTxHex } from './helpers.js';

describe('submit strategy and validation', () => {
  it('validates and submits through raw-rpc', async () => {
    const report = await validateTransaction(
      {
        kind: 'deploy',
        finalizedTxHex: makeFixtureTxHex(),
      },
      {
        network: 'preprod',
        api: makeFakeApi(),
        strategy: 'raw-rpc',
        submit: true,
      },
    );

    expect(report.validation.every((entry) => entry.outcome === 'accepted')).toBe(true);
    expect(report.submit.outcome).toBe('accepted');
    expect(report.submit.txHash).toBe('0xraw');
  });

  it('classifies panic and rejection responses', async () => {
    const api = makeFakeApi({
      call: {
        taggedTransactionQueue: {
          async validateTransaction(source: string) {
            if (source === 'External') {
              throw new Error('wasm trap: unreachable instruction executed');
            }
            throw new Error('1010: Invalid Transaction: Custom error: 170');
          },
        },
      },
    });

    const results = await validateMidnightOuterTx('0xfeed', api);

    expect(results[0]?.outcome).toBe('panic');
    expect(results[1]?.outcome).toBe('rejected');
  });

  it('supports wallet adapter submission without bundling a wallet sdk', async () => {
    const report = await validateTransaction(
      {
        kind: 'deploy',
        finalizedTxHex: makeFixtureTxHex(),
      },
      {
        network: 'preprod',
        api: makeFakeApi(),
        strategy: 'wallet-sdk',
        submit: true,
        walletAdapter: {
          async submitTransaction() {
            return {
              txHash: '0xwallet',
              detail: 'wallet adapter accepted',
            };
          },
        },
      },
    );

    expect(report.submit.outcome).toBe('accepted');
    expect(report.submit.txHash).toBe('0xwallet');
  });

  it('fails fast when metadata submission never reaches a terminal status', async () => {
    const stalledApi = makeFakeApi({
      tx: {
        midnight: {
          sendMnTransaction(innerTxHex: string) {
            return {
              toHex: () => `0xfeed${innerTxHex.slice(2, 14)}`,
              async send() {
                return () => {};
              },
            };
          },
        },
      },
    });

    const outcome = await Promise.race([
      validateTransaction(
        {
          kind: 'deploy',
          finalizedTxHex: makeFixtureTxHex(),
        },
        {
          network: 'preprod',
          api: stalledApi,
          strategy: 'metadata-extrinsic',
          submit: true,
          submitTimeoutMs: 10,
        },
      ).then((report) => ({ kind: 'report' as const, report })),
      new Promise<{ kind: 'timeout' }>((resolve) => setTimeout(() => resolve({ kind: 'timeout' }), 50)),
    ]);

    expect(outcome.kind).toBe('report');
    if (outcome.kind === 'report') {
      expect(outcome.report.submit.outcome).toBe('error');
      expect(outcome.report.submit.detail).toContain('timed out');
    }
  });
});
