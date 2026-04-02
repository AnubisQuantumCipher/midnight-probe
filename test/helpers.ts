import { Buffer } from 'node:buffer';

import { Transaction } from '@midnight-ntwrk/ledger-v8';

export function makeFixtureTxHex(): `0x${string}` {
  return `0x${Buffer.from(Transaction.fromParts('preprod').mockProve().serialize()).toString('hex')}`;
}

export function makeSignedExtensions() {
  return [
    'CheckNonZeroSender',
    'CheckSpecVersion',
    'CheckTxVersion',
    'CheckGenesis',
    'CheckMortality',
    'CheckNonce',
    'CheckWeight',
    'CheckCallFilter',
    'CheckThrottle',
  ];
}

export function makeFakeApi(overrides: Record<string, unknown> = {}): any {
  const api = {
    registry: {
      signedExtensions: makeSignedExtensions(),
    },
    runtimeVersion: {
      specVersion: { toString: () => '22000' },
      transactionVersion: { toString: () => '2' },
    },
    call: {
      midnightRuntimeApi: {
        getLedgerVersion: async () => ({
          toHex: () => '0x183d382e302e32',
        }),
        getTransactionCost: async () => ({
          toJSON: () => ({ ok: '153320000001' }),
        }),
      },
      taggedTransactionQueue: {
        validateTransaction: async (source: string) => ({
          toString: () => `${source}:accepted`,
          toHuman: () => ({ source, outcome: 'accepted' }),
          toJSON: () => ({ source, outcome: 'accepted' }),
        }),
      },
    },
    query: {
      midnight: {
        configurableTransactionSizeWeight: async () => ({
          toJSON: () => ({ refTime: '20000000000', proofSize: '0' }),
        }),
      },
      txPause: {
        pausedCalls: {
          entries: async () => [],
        },
      },
      throttle: {
        accountUsage: {
          entries: async () => [],
        },
      },
    },
    tx: {
      midnight: {
        sendMnTransaction(innerTxHex: string) {
          return {
            toHex: () => `0xfeed${innerTxHex.slice(2, 14)}`,
            async send(callback: (result: any) => void) {
              callback({
                status: {
                  isInvalid: false,
                  isInBlock: true,
                  isFinalized: false,
                  toString: () => 'InBlock',
                },
                txHash: {
                  toString: () => '0xsubmitted',
                },
              });
              return () => {};
            },
          };
        },
      },
    },
    rpc: {
      chain: {
        getBlockHash: async () => ({
          toString: () => '0xbest',
        }),
        getHeader: async () => ({
          number: {
            toNumber: () => 10,
          },
        }),
        getBlock: async () => ({
          block: {
            extrinsics: [],
          },
        }),
      },
      author: {
        submitExtrinsic: async () => ({
          toString: () => '0xraw',
        }),
      },
    },
    async disconnect() {
      return undefined;
    },
  };
  return {
    ...api,
    ...overrides,
  };
}
