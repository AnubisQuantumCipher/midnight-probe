import { describe, expect, it } from 'vitest';

import { runCli } from '../src/cli-core.js';

function captureIo() {
  let stdout = '';
  let stderr = '';
  return {
    io: {
      stdout: {
        write(chunk: string) {
          stdout += chunk;
        },
      },
      stderr: {
        write(chunk: string) {
          stderr += chunk;
        },
      },
      env: process.env,
      cwd: process.cwd(),
    },
    getStdout() {
      return stdout;
    },
    getStderr() {
      return stderr;
    },
  };
}

describe('cli', () => {
  it('keeps the attribution banner on stderr in json mode', async () => {
    const captured = captureIo();
    const exitCode = await runCli(
      ['fingerprint', '--json'],
      captured.io,
      {
        probeRuntime: async () => ({
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
        }),
        inspectTransaction: async () => {
          throw new Error('not used');
        },
        validateTransaction: async () => {
          throw new Error('not used');
        },
        runChainCanary: async () => {
          throw new Error('not used');
        },
        runCompatibilityMatrix: async () => {
          throw new Error('not used');
        },
        loadPrepareHook: async () => {
          throw new Error('not used');
        },
        readProbeInputFile: async () => {
          throw new Error('not used');
        },
        loadWalletAdapter: async () => {
          throw new Error('not used');
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(captured.getStderr()).toContain('Built by AnubisQuantumCipher');
    expect(captured.getStdout().trim().startsWith('{')).toBe(true);
  });

  it('returns a non-zero exit code for unknown commands', async () => {
    const captured = captureIo();
    const exitCode = await runCli(['unknown'], captured.io);

    expect(exitCode).toBe(1);
    expect(captured.getStderr()).toContain('Unknown command');
  });

  it('prints a resolver CTA for human matrix output', async () => {
    const captured = captureIo();
    const exitCode = await runCli(
      ['matrix', '--contract', '/tmp/example-contract', '--network', 'preprod'],
      captured.io,
      {
        probeRuntime: async () => {
          throw new Error('not used');
        },
        inspectTransaction: async () => {
          throw new Error('not used');
        },
        validateTransaction: async () => {
          throw new Error('not used');
        },
        runChainCanary: async () => {
          throw new Error('not used');
        },
        runCompatibilityMatrix: async () => ({
          generatedAt: new Date().toISOString(),
          profiles: [],
          probes: [],
          matrices: [],
          selected: {
            matrixId: 'v4-stable',
            strategy: 'metadata-extrinsic',
            network: 'preprod',
            selectedAt: new Date().toISOString(),
            runtimeFingerprint: {
              network: 'preprod',
              specVersion: '22000',
              transactionVersion: '2',
              signedExtensions: ['CheckThrottle'],
              rawLedgerVersion: '0x1',
            },
          },
        }),
        loadPrepareHook: async () => {
          throw new Error('not used');
        },
        readProbeInputFile: async () => {
          throw new Error('not used');
        },
        loadWalletAdapter: async () => {
          throw new Error('not used');
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(captured.getStdout()).toContain('Selected matrix: v4-stable');
    expect(captured.getStdout()).toContain('zkf midnight resolve --network preprod --project /tmp/example-contract');
  });

  it('keeps resolver CTA text out of matrix json output', async () => {
    const captured = captureIo();
    const exitCode = await runCli(
      ['matrix', '--contract', '/tmp/example-contract', '--network', 'preprod', '--json'],
      captured.io,
      {
        probeRuntime: async () => {
          throw new Error('not used');
        },
        inspectTransaction: async () => {
          throw new Error('not used');
        },
        validateTransaction: async () => {
          throw new Error('not used');
        },
        runChainCanary: async () => {
          throw new Error('not used');
        },
        runCompatibilityMatrix: async () => ({
          generatedAt: new Date().toISOString(),
          profiles: [],
          probes: [],
          matrices: [],
          selected: null,
        }),
        loadPrepareHook: async () => {
          throw new Error('not used');
        },
        readProbeInputFile: async () => {
          throw new Error('not used');
        },
        loadWalletAdapter: async () => {
          throw new Error('not used');
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(captured.getStdout()).not.toContain('zkf midnight resolve');
    expect(captured.getStdout().trim().startsWith('{')).toBe(true);
  });

  it('prints a resolver CTA for problematic fingerprint output', async () => {
    const captured = captureIo();
    const exitCode = await runCli(
      ['fingerprint', '--network', 'preprod'],
      captured.io,
      {
        probeRuntime: async () => ({
          observedAt: new Date().toISOString(),
          network: 'preprod',
          rpcUrl: 'wss://rpc.preprod.midnight.network/',
          specVersion: '22000',
          transactionVersion: '2',
          signedExtensions: ['CheckThrottle'],
          injectedSignedExtensions: [],
          unknownSignedExtensions: ['CheckThrottle'],
          rawLedgerVersion: '0x1',
          configurableTransactionSizeWeight: null,
          pausedCalls: 0,
          throttle: {
            palletKeys: [],
            accountUsage: null,
          },
        }),
        inspectTransaction: async () => {
          throw new Error('not used');
        },
        validateTransaction: async () => {
          throw new Error('not used');
        },
        runChainCanary: async () => {
          throw new Error('not used');
        },
        runCompatibilityMatrix: async () => {
          throw new Error('not used');
        },
        loadPrepareHook: async () => {
          throw new Error('not used');
        },
        readProbeInputFile: async () => {
          throw new Error('not used');
        },
        loadWalletAdapter: async () => {
          throw new Error('not used');
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(captured.getStdout()).toContain('zkf midnight resolve --network preprod --project ./my-contract');
  });
});
