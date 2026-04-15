import { access, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCompatibilityMatrix } from '../../../src/matrix-runner.js';

const root = await mkdtemp(join(tmpdir(), 'midnight-probe-matrix-check-'));
const reportPath = join(root, 'report.json');
await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'fixture', private: true }, null, 2) + '\n', 'utf-8');

const commands = [];
const report = await runCompatibilityMatrix({
  contractDir: root,
  reportPath,
  matrices: ['v4-stable'],
  runtime: {
    async runCommand(command, args, cwd, env) {
      commands.push({ command, args, cwd, hasSecret: Boolean(env.AUDIT_SECRET), envKeys: Object.keys(env).sort() });
      return '';
    },
    async loadPrepareHook() {
      return { kind: 'deploy', finalizedTxHex: '0x1234' };
    },
    async probeRuntime() {
      return {
        observedAt: new Date().toISOString(),
        network: 'preprod',
        rpcUrl: 'wss://rpc.preprod.midnight.network/',
        specVersion: '22000',
        transactionVersion: '2',
        signedExtensions: ['CheckThrottle'],
        injectedSignedExtensions: ['CheckThrottle'],
        unknownSignedExtensions: [],
        rawLedgerVersion: '0x1',
        configurableTransactionSizeWeight: null,
        pausedCalls: 0,
        throttle: { palletKeys: [], accountUsage: null },
      };
    },
    async inspectTransaction() {
      return {
        observedAt: new Date().toISOString(),
        network: null,
        rpcUrl: null,
        input: { kind: 'deploy', finalizedTxHex: '0x1234' },
        transactionHex: '0x1234',
        serializedBytes: 2,
        deserializationMode: 'signature/proof/binding',
        cost: { readTime: '1', computeTime: '1', blockUsage: '1', bytesWritten: '1', bytesChurned: '1' },
        normalizedCost: null,
        fitsInBlock: true,
        fitFailureReason: null,
        runtimeCost: null,
        runtimeCostError: null,
      };
    },
    async validateTransaction() {
      return {
        observedAt: new Date().toISOString(),
        network: 'preprod',
        rpcUrl: 'wss://rpc.preprod.midnight.network/',
        input: { kind: 'deploy', finalizedTxHex: '0x1234' },
        strategy: 'metadata-extrinsic',
        outerTxHex: '0x5678',
        signedExtensions: { runtimeSignedExtensions: [], injectedSignedExtensions: [], unknownSignedExtensions: [] },
        validation: [{ source: 'External', outcome: 'accepted', detail: 'accepted' }],
        submit: { strategy: 'metadata-extrinsic', outcome: 'skipped', txHash: null, detail: 'skipped' },
      };
    },
  },
});

let workspaceExists = true;
try {
  await access(report.matrices[0].workspaceDir);
} catch {
  workspaceExists = false;
}

const result = {
  installCommand: commands[0],
  workspaceRetained: report.matrices[0].workspaceRetained,
  workspaceExists,
  packageVersionCount: Object.keys(report.matrices[0].packageVersions).length,
};
await writeFile(new URL('../results/matrix-hardening-check.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
