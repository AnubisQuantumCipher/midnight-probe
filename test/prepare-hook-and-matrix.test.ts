import { access, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { prepareMatrixWorkspace, rewritePackageJsonForMatrix, runCompatibilityMatrix } from '../src/matrix-runner.js';
import { loadPrepareHook } from '../src/prepare-hook.js';

describe('prepare hook and matrix workspace', () => {
  it('loads a user-owned prepare hook', async () => {
    const root = await mkdtemp(join(tmpdir(), 'midnight-probe-hook-'));
    const hookPath = join(root, 'midnight-probe.prepare.mjs');
    await writeFile(
      hookPath,
      `export default async function prepare({ mode }) { return { kind: mode, finalizedTxHex: '0x1234' }; }\n`,
      'utf-8',
    );

    const result = await loadPrepareHook({
      mode: 'deploy',
      network: 'preprod',
      contractDir: root,
      env: process.env,
    });

    expect(result.kind).toBe('deploy');
    expect(result.finalizedTxHex).toBe('0x1234');
  });

  it('rewrites public midnight dependencies for a matrix workspace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'midnight-probe-matrix-'));
    const packageJsonPath = join(root, 'package.json');
    await writeFile(
      packageJsonPath,
      JSON.stringify(
        {
          name: 'fixture',
          dependencies: {
            '@midnight-ntwrk/ledger-v8': '8.0.1',
            '@midnight-ntwrk/midnight-js-types': '4.0.1',
          },
        },
        null,
        2,
      ),
      'utf-8',
    );

    const applied = await rewritePackageJsonForMatrix(packageJsonPath, 'v3-compat');
    const rewritten = JSON.parse(await readFile(packageJsonPath, 'utf-8')) as {
      dependencies: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(applied['@midnight-ntwrk/ledger-v8']).toBe('npm:@midnight-ntwrk/ledger-v7@7.0.0');
    expect(rewritten.dependencies['@midnight-ntwrk/midnight-js-types']).toBe('3.0.0');
    expect(applied['@midnight-ntwrk/midnight-js-contracts']).toBe('3.0.0');
    expect(rewritten.devDependencies?.['@midnight-ntwrk/midnight-js-contracts']).toBe('3.0.0');
  });

  it('copies a contract workspace into an isolated temp dir', async () => {
    const root = await mkdtemp(join(tmpdir(), 'midnight-probe-copy-'));
    await mkdir(join(root, 'node_modules'));
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify(
        {
          name: 'fixture',
          dependencies: {
            '@midnight-ntwrk/ledger-v8': '8.0.3',
          },
        },
        null,
        2,
      ),
      'utf-8',
    );

    const prepared = await prepareMatrixWorkspace(root, 'v4-stable');
    const copiedPackage = JSON.parse(await readFile(join(prepared.workspaceDir, 'package.json'), 'utf-8')) as {
      dependencies: Record<string, string>;
    };

    expect(copiedPackage.dependencies['@midnight-ntwrk/ledger-v8']).toBe('8.0.3');
  });

  it('installs without lifecycle scripts and removes temp workspaces by default', async () => {
    const root = await mkdtemp(join(tmpdir(), 'midnight-probe-run-'));
    const reportPath = join(root, 'report.json');
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify(
        {
          name: 'fixture',
          private: true,
        },
        null,
        2,
      ),
      'utf-8',
    );

    const commands: Array<{ command: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv }> = [];
    const report = await runCompatibilityMatrix({
      contractDir: root,
      reportPath,
      matrices: ['v4-stable'],
      runtime: {
        async runCommand(command, args, cwd, env) {
          commands.push({ command, args, cwd, env });
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
            throttle: {
              palletKeys: [],
              accountUsage: null,
            },
          };
        },
        async inspectTransaction() {
          return {
            observedAt: new Date().toISOString(),
            network: null,
            rpcUrl: null,
            input: {
              kind: 'deploy',
              finalizedTxHex: '0x1234',
            },
            transactionHex: '0x1234',
            serializedBytes: 2,
            deserializationMode: 'signature/proof/binding',
            cost: {
              readTime: '1',
              computeTime: '1',
              blockUsage: '1',
              bytesWritten: '1',
              bytesChurned: '1',
            },
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
            input: {
              kind: 'deploy',
              finalizedTxHex: '0x1234',
            },
            strategy: 'metadata-extrinsic',
            outerTxHex: '0x5678',
            signedExtensions: {
              runtimeSignedExtensions: [],
              injectedSignedExtensions: [],
              unknownSignedExtensions: [],
            },
            validation: [
              {
                source: 'External',
                outcome: 'accepted',
                detail: 'accepted',
              },
            ],
            submit: {
              strategy: 'metadata-extrinsic',
              outcome: 'skipped',
              txHash: null,
              detail: 'skipped',
            },
          };
        },
      },
    });

    expect(commands[0]?.command).toBe('npm');
    expect(commands[0]?.args.includes('--ignore-scripts')).toBe(true);
    expect(report.matrices[0]?.workspaceRetained).toBe(false);

    let exists = true;
    try {
      await access(report.matrices[0]!.workspaceDir);
    } catch {
      exists = false;
    }
    expect(exists).toBe(false);
  });
});
