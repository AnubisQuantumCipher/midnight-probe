import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { probeRuntime } from './runtime-probe.js';
import { inspectTransaction } from './tx-inspector.js';
import { validateTransaction } from './submit-strategy.js';
import { loadPrepareHook } from './prepare-hook.js';
import {
  readCompatibilityReport,
  withMatrixAttempt,
  withProbe,
  withProfile,
  withSelection,
  writeCompatibilityReport,
} from './compatibility.js';
import type {
  CompatibilityMatrixAttempt,
  CompatibilityMatrixId,
  CompatibilityReport,
  MatrixDefinition,
  MidnightConnectionOptions,
  ProbeKind,
  SubmitStrategyId,
  WalletSubmitAdapter,
} from './types.js';
import { DEFAULT_COMPATIBILITY_REPORT_PATH, normalizeProbeInput, resolveNetwork, safeJson } from './util.js';

const execFileAsync = promisify(execFile);

export const MATRICES: Record<CompatibilityMatrixId, MatrixDefinition> = {
  'v4-stable': {
    compactcVersion: '0.30.0',
    packageVersions: {
      '@midnight-ntwrk/compact-js': '2.5.0',
      '@midnight-ntwrk/compact-runtime': '0.15.0',
      '@midnight-ntwrk/ledger-v8': '8.0.3',
      '@midnight-ntwrk/midnight-js-compact': '4.0.2',
      '@midnight-ntwrk/midnight-js-contracts': '4.0.2',
      '@midnight-ntwrk/midnight-js-http-client-proof-provider': '4.0.2',
      '@midnight-ntwrk/midnight-js-indexer-public-data-provider': '4.0.2',
      '@midnight-ntwrk/midnight-js-level-private-state-provider': '4.0.2',
      '@midnight-ntwrk/midnight-js-network-id': '4.0.2',
      '@midnight-ntwrk/midnight-js-node-zk-config-provider': '4.0.2',
      '@midnight-ntwrk/midnight-js-types': '4.0.2',
      '@midnight-ntwrk/midnight-js-utils': '4.0.2',
      '@midnight-ntwrk/testkit-js': '4.0.2',
    },
  },
  'v4-pre': {
    compactcVersion: '0.30.0',
    packageVersions: {
      '@midnight-ntwrk/compact-js': '2.5.0',
      '@midnight-ntwrk/compact-runtime': '0.15.0',
      '@midnight-ntwrk/ledger-v8': '8.0.3',
      '@midnight-ntwrk/midnight-js-compact': '4.0.2-0-pre.2a895cf0',
      '@midnight-ntwrk/midnight-js-contracts': '4.0.2-0-pre.2a895cf0',
      '@midnight-ntwrk/midnight-js-http-client-proof-provider': '4.0.2-0-pre.2a895cf0',
      '@midnight-ntwrk/midnight-js-indexer-public-data-provider': '4.0.2-0-pre.2a895cf0',
      '@midnight-ntwrk/midnight-js-level-private-state-provider': '4.0.2-0-pre.2a895cf0',
      '@midnight-ntwrk/midnight-js-network-id': '4.0.2-0-pre.2a895cf0',
      '@midnight-ntwrk/midnight-js-node-zk-config-provider': '4.0.2-0-pre.2a895cf0',
      '@midnight-ntwrk/midnight-js-types': '4.0.2-0-pre.2a895cf0',
      '@midnight-ntwrk/midnight-js-utils': '4.0.2-0-pre.2a895cf0',
      '@midnight-ntwrk/testkit-js': '4.0.2-0-pre.2a895cf0',
    },
  },
  'v3-compat': {
    compactcVersion: '0.28.0',
    packageVersions: {
      '@midnight-ntwrk/compact-js': '2.4.0',
      '@midnight-ntwrk/compact-runtime': '0.14.0',
      '@midnight-ntwrk/ledger-v8': 'npm:@midnight-ntwrk/ledger-v7@7.0.0',
      '@midnight-ntwrk/midnight-js-compact': '3.0.0',
      '@midnight-ntwrk/midnight-js-contracts': '3.0.0',
      '@midnight-ntwrk/midnight-js-http-client-proof-provider': '3.0.0',
      '@midnight-ntwrk/midnight-js-indexer-public-data-provider': '3.0.0',
      '@midnight-ntwrk/midnight-js-level-private-state-provider': '3.0.0',
      '@midnight-ntwrk/midnight-js-network-id': '3.0.0',
      '@midnight-ntwrk/midnight-js-node-zk-config-provider': '3.0.0',
      '@midnight-ntwrk/midnight-js-types': '3.0.0',
      '@midnight-ntwrk/midnight-js-utils': '3.0.0',
      '@midnight-ntwrk/testkit-js': '3.0.0',
    },
  },
};

async function runCommand(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<string> {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd,
    env,
    maxBuffer: 20 * 1024 * 1024,
    timeout: 10 * 60_000,
  });
  return `${stdout}${stderr}`;
}

export async function rewritePackageJsonForMatrix(
  packageJsonPath: string,
  matrixId: CompatibilityMatrixId,
): Promise<Record<string, string>> {
  const raw = await readFile(packageJsonPath, 'utf-8');
  const pkg = JSON.parse(raw) as Record<string, unknown>;
  const applied: Record<string, string> = {};
  const matrix = MATRICES[matrixId];

  for (const sectionName of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const) {
    const section = pkg[sectionName];
    if (!section || typeof section !== 'object') {
      continue;
    }
    const record = section as Record<string, string>;
    for (const [name, version] of Object.entries(matrix.packageVersions)) {
      if (name in record) {
        record[name] = version;
        applied[name] = version;
      }
    }
  }

  await writeFile(packageJsonPath, `${safeJson(pkg)}\n`, 'utf-8');
  return applied;
}

export async function prepareMatrixWorkspace(
  contractDir: string,
  matrixId: CompatibilityMatrixId,
): Promise<{
  workspaceDir: string;
  packageVersions: Record<string, string>;
  compactcVersion: string;
}> {
  const workspaceDir = await mkdtemp(join(tmpdir(), `midnight-probe-${matrixId}-`));
  await cp(contractDir, workspaceDir, {
    recursive: true,
    filter(source) {
      return !source.includes('/node_modules') && !source.includes('/dist') && !source.includes('/.git');
    },
  });

  const packageJsonPath = join(workspaceDir, 'package.json');
  const packageVersions = await rewritePackageJsonForMatrix(packageJsonPath, matrixId);
  await rm(join(workspaceDir, 'package-lock.json'), { force: true });

  return {
    workspaceDir,
    packageVersions,
    compactcVersion: MATRICES[matrixId].compactcVersion,
  };
}

export async function runCompatibilityMatrix(
  options: MidnightConnectionOptions & {
    contractDir: string;
    mode?: ProbeKind;
    matrices?: CompatibilityMatrixId[];
    reportPath?: string;
    strategy?: SubmitStrategyId;
    submit?: boolean;
    walletAdapter?: WalletSubmitAdapter;
    installDependencies?: boolean;
    hookPath?: string;
  },
): Promise<CompatibilityReport> {
  const reportPath = resolve(options.reportPath ?? DEFAULT_COMPATIBILITY_REPORT_PATH);
  const matrices = options.matrices ?? ['v4-stable', 'v4-pre', 'v3-compat'];
  const mode = options.mode ?? 'deploy';
  const strategy = options.strategy ?? 'metadata-extrinsic';
  let report = await readCompatibilityReport(reportPath);

  for (const matrixId of matrices) {
    const prepared = await prepareMatrixWorkspace(options.contractDir, matrixId);
    const env = {
      ...process.env,
      ...options.walletAdapter ? { MIDNIGHT_PROBE_WALLET_ADAPTER: 'configured' } : {},
      COMPACTC_VERSION: prepared.compactcVersion,
    };

    let attempt: CompatibilityMatrixAttempt;
    try {
      if (options.installDependencies !== false) {
        await runCommand('npm', ['install', '--no-audit', '--no-fund'], prepared.workspaceDir, env);
      }

      const probeInput = normalizeProbeInput(
        await loadPrepareHook(
          {
            mode,
            network: resolveNetwork(options),
            contractDir: prepared.workspaceDir,
            env,
          },
          options.hookPath ? resolve(prepared.workspaceDir, options.hookPath) : undefined,
        ),
        mode,
      );
      const fingerprint = await probeRuntime(options);
      const inspection = await inspectTransaction(probeInput, options);
      const validation = await validateTransaction(probeInput, {
        ...options,
        strategy,
        submit: options.submit,
        walletAdapter: options.walletAdapter,
      });
      const succeeded =
        validation.validation.every((result) => result.outcome === 'accepted') &&
        (!options.submit || validation.submit.outcome === 'accepted');

      attempt = {
        matrixId,
        workspaceDir: prepared.workspaceDir,
        packageVersions: prepared.packageVersions,
        compactcVersion: prepared.compactcVersion,
        succeeded,
        fingerprint,
        inspection,
        validation,
        note: succeeded ? 'Matrix probe passed.' : 'Matrix probe did not produce a fully accepted validation set.',
      };

      report = withProbe(
        withProfile(report, fingerprint),
        {
          probeId: `matrix:${matrixId}:${mode}`,
          observedAt: new Date().toISOString(),
          matrixId,
          mode,
          inspection,
          validation,
        },
      );

      if (!report.selected && succeeded) {
        report = withSelection(report, {
          matrixId,
          strategy,
          network: resolveNetwork(options),
          selectedAt: new Date().toISOString(),
          runtimeFingerprint: {
            network: fingerprint.network,
            specVersion: fingerprint.specVersion,
            transactionVersion: fingerprint.transactionVersion,
            signedExtensions: fingerprint.signedExtensions,
            rawLedgerVersion: fingerprint.rawLedgerVersion,
          },
        });
      }
    } catch (error) {
      attempt = {
        matrixId,
        workspaceDir: prepared.workspaceDir,
        packageVersions: prepared.packageVersions,
        compactcVersion: prepared.compactcVersion,
        succeeded: false,
        fingerprint: null,
        inspection: null,
        validation: null,
        note: error instanceof Error ? error.message : String(error),
      };
    }

    report = withMatrixAttempt(report, attempt);
    await writeCompatibilityReport(report, reportPath);
  }

  return report ?? {
    generatedAt: new Date().toISOString(),
    profiles: [],
    probes: [],
    matrices: [],
    selected: null,
  };
}
