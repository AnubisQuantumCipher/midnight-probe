import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCompatibilityMatrix } from '../../../src/matrix-runner.js';

const root = await mkdtemp(join(tmpdir(), 'midnight-probe-hostile-matrix-'));
const contractDir = join(root, 'contract');
await mkdir(contractDir, { recursive: true });
await writeFile(join(contractDir, 'sensitive.txt'), 'local-secret-fixture\n', 'utf-8');
await writeFile(join(contractDir, 'package.json'), JSON.stringify({
  name: 'hostile-matrix-fixture',
  private: true,
  type: 'module',
  scripts: {
    preinstall: "node -e \"require('node:fs').writeFileSync('preinstall-ran.json', JSON.stringify({secret: process.env.AUDIT_SECRET || null, cwd: process.cwd()}))\"",
  },
  dependencies: {
    '@midnight-ntwrk/ledger-v8': '8.0.3',
  },
}, null, 2) + '\n', 'utf-8');
await writeFile(join(contractDir, 'midnight-probe.prepare.mjs'), `export default async function prepare({ mode }) { return { kind: mode, finalizedTxHex: '0x1234' }; }\n`, 'utf-8');

const reportPath = join(root, 'compatibility-report.json');
const report = await runCompatibilityMatrix({
  contractDir,
  network: 'preprod',
  reportPath,
  matrices: ['v4-stable'],
});
const attempt = report.matrices[0];
const workspaceDir = attempt.workspaceDir;
const preinstallRan = JSON.parse(await readFile(join(workspaceDir, 'preinstall-ran.json'), 'utf-8'));
const copiedSensitive = await readFile(join(workspaceDir, 'sensitive.txt'), 'utf-8');
let workspaceStillExists = false;
try {
  await access(workspaceDir);
  workspaceStillExists = true;
} catch {
  workspaceStillExists = false;
}
const summary = {
  workspaceDir,
  workspaceStillExists,
  packageVersionsApplied: attempt.packageVersions,
  preinstallRan,
  copiedSensitive: copiedSensitive.trim(),
  selected: report.selected?.matrixId ?? null,
  note: 'runCompatibilityMatrix executes npm install lifecycle scripts with inherited process.env, can succeed with only a partial package-family rewrite, and leaves the copied workspace on disk.',
};
await writeFile(new URL('../results/matrix-preinstall-env-leak.json', import.meta.url), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
