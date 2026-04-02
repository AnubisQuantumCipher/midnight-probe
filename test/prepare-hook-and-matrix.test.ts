import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { prepareMatrixWorkspace, rewritePackageJsonForMatrix } from '../src/matrix-runner.js';
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
    };

    expect(applied['@midnight-ntwrk/ledger-v8']).toBe('npm:@midnight-ntwrk/ledger-v7@7.0.0');
    expect(rewritten.dependencies['@midnight-ntwrk/midnight-js-types']).toBe('3.0.0');
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
});
