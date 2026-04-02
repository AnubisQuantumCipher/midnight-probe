import { Buffer } from 'node:buffer';
import { Transaction } from '@midnight-ntwrk/ledger-v8';

export default async function prepare({ mode, network, contractDir }) {
  const tx = Transaction.fromParts(network === 'custom' ? 'preprod' : network).mockProve();
  return {
    kind: mode,
    finalizedTxHex: `0x${Buffer.from(tx.serialize()).toString('hex')}`,
    label: `${mode}:${network}`,
    metadata: {
      contractDir,
      example: true
    }
  };
}
