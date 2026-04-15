import { writeFile } from 'node:fs/promises';
import { inspectTransaction } from '../../../src/tx-inspector.js';
import { normalizeHex } from '../../../src/util.js';

const cases = [];
for (let digits = 1; digits <= 15; digits += 2) {
  const raw = `0x${'1'.repeat(digits)}`;
  const normalized = normalizeHex(raw);
  const inspection = await inspectTransaction({ kind: 'generic', finalizedTxHex: normalized });
  cases.push({
    digits,
    raw,
    normalized,
    serializedBytes: inspection.serializedBytes,
  });
}
const result = {
  oddLengthCasesAccepted: cases.length,
  cases,
  note: 'All sampled odd-length hex inputs were accepted; serialized byte length truncates toward floor(digits/2).',
};
await writeFile(new URL('../results/hex-boundary-sweep.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
