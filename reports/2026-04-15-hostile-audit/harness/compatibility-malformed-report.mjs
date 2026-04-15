import { mkdtemp, writeFile as fsWriteFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCompatibilityReport } from '../../../src/compatibility.js';

const root = await mkdtemp(join(tmpdir(), 'midnight-probe-bad-report-'));
const reportPath = join(root, 'report.json');
await fsWriteFile(reportPath, '{not-json\n', 'utf-8');
const result = await readCompatibilityReport(reportPath);
console.log(JSON.stringify({ reportPath, parsedResult: result, note: 'Malformed JSON is silently treated as missing report.' }, null, 2));
