import { writeFile } from 'node:fs/promises';
import { inspectTransaction } from '../../../src/tx-inspector.js';
import { normalizeHex } from '../../../src/util.js';

const accepted = normalizeHex('0x123');
const inspection = await inspectTransaction({ kind: 'generic', finalizedTxHex: accepted });
const result = {
  input: '0x123',
  normalized: accepted,
  serializedBytes: inspection.serializedBytes,
  expectedNibbleCount: 3,
  observedHexByteLength: inspection.serializedBytes,
  note: 'Odd-length hex is accepted and silently truncated by Buffer.from(..., \"hex\").',
};
await writeFile(new URL('../results/odd-hex-truncation.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
