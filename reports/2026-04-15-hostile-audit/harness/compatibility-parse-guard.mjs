import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCompatibilityReport } from '../../../src/compatibility.js';

const root = await mkdtemp(join(tmpdir(), 'midnight-probe-compat-check-'));
const reportPath = join(root, 'report.json');
await writeFile(reportPath, '{not-json\n', 'utf-8');

let errorMessage = '';
try {
  await readCompatibilityReport(reportPath);
} catch (error) {
  errorMessage = error instanceof Error ? error.message : String(error);
}

const result = {
  reportPath,
  rejectedMalformedReport: errorMessage.length > 0,
  errorMessage,
};
await writeFile(new URL('../results/compatibility-parse-guard.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
