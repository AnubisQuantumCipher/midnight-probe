import { Buffer } from 'node:buffer';

import { Transaction } from '@midnight-ntwrk/ledger-v8';

import { inspectTransaction, validateTransaction } from '../src/index.js';

const finalizedTxHex = `0x${Buffer.from(Transaction.fromParts('preprod').mockProve().serialize()).toString('hex')}`;

const inspection = await inspectTransaction({
  kind: 'deploy',
  finalizedTxHex,
  label: 'mock-proven-deploy',
});

console.log(`serialized bytes: ${inspection.serializedBytes}`);
console.log(`fits in block: ${inspection.fitsInBlock}`);

const validation = await validateTransaction(
  {
    kind: 'deploy',
    finalizedTxHex,
  },
  {
    network: 'preprod',
  },
);

console.log(validation.validation.map((entry) => `${entry.source}:${entry.outcome}`).join(', '));
