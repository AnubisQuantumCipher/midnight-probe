import { writeFile } from 'node:fs/promises';
import { normalizeHex } from '../../../src/util.js';

let rejected = false;
let errorMessage = '';
try {
  normalizeHex('0x123');
} catch (error) {
  rejected = true;
  errorMessage = error instanceof Error ? error.message : String(error);
}

const result = {
  input: '0x123',
  rejected,
  errorMessage,
};
await writeFile(new URL('../results/hex-guard-check.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
