import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  readCompatibilityReport,
  withMatrixAttempt,
  withProbe,
  withProfile,
  withSelection,
  writeCompatibilityReport,
} from '../src/compatibility.js';

describe('compatibility report persistence', () => {
  it('writes and reads report state', async () => {
    const pathname = join(await mkdtemp(join(tmpdir(), 'midnight-probe-report-')), 'report.json');
    let report = withProfile(null, {
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
    });
    report = withProbe(report, {
      probeId: 'probe',
      observedAt: new Date().toISOString(),
      matrixId: 'current',
      mode: 'deploy',
      inspection: {
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
      },
      validation: {
        observedAt: new Date().toISOString(),
        network: 'preprod',
        rpcUrl: 'wss://rpc.preprod.midnight.network/',
        input: {
          kind: 'deploy',
          finalizedTxHex: '0x1234',
        },
        strategy: 'raw-rpc',
        outerTxHex: '0x5678',
        signedExtensions: {
          runtimeSignedExtensions: [],
          injectedSignedExtensions: [],
          unknownSignedExtensions: [],
        },
        validation: [],
        submit: {
          strategy: 'raw-rpc',
          outcome: 'skipped',
          txHash: null,
          detail: 'skipped',
        },
      },
    });
    report = withMatrixAttempt(report, {
      matrixId: 'v4-stable',
      workspaceDir: '/tmp/workspace',
      packageVersions: {},
      compactcVersion: '0.30.0',
      succeeded: true,
      fingerprint: null,
      inspection: null,
      validation: null,
    });
    report = withSelection(report, {
      matrixId: 'v4-stable',
      strategy: 'raw-rpc',
      network: 'preprod',
      selectedAt: new Date().toISOString(),
      runtimeFingerprint: {
        network: 'preprod',
        specVersion: '22000',
        transactionVersion: '2',
        signedExtensions: [],
        rawLedgerVersion: '0x1',
      },
    });

    await writeCompatibilityReport(report, pathname);
    const reloaded = await readCompatibilityReport(pathname);

    expect(reloaded?.profiles).toHaveLength(1);
    expect(reloaded?.probes).toHaveLength(1);
    expect(reloaded?.matrices).toHaveLength(1);
    expect(reloaded?.selected?.matrixId).toBe('v4-stable');
  });

  it('does not silently treat malformed report JSON as a missing report', async () => {
    const pathname = join(await mkdtemp(join(tmpdir(), 'midnight-probe-report-bad-')), 'report.json');
    await writeFile(pathname, '{not-json\n', 'utf-8');

    let message = '';
    try {
      await readCompatibilityReport(pathname);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('Invalid compatibility report JSON');
  });
});
