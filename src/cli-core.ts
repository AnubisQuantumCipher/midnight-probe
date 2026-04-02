import { writeFile } from 'node:fs/promises';

import { probeRuntime } from './runtime-probe.js';
import { inspectTransaction } from './tx-inspector.js';
import { validateTransaction } from './submit-strategy.js';
import { runChainCanary } from './chain-canary.js';
import { runCompatibilityMatrix } from './matrix-runner.js';
import { loadPrepareHook, loadWalletAdapter, readProbeInputFile } from './prepare-hook.js';
import type { ProbeInput, ProbeKind, SubmitStrategyId } from './types.js';
import {
  ATTRIBUTION_BANNER,
  ZIROS_REPOSITORY_URL,
  hasFlag,
  optionalFlag,
  parseArgs,
  resolveNetwork,
  safeJson,
  splitCsvFlag,
} from './util.js';

interface WritableLike {
  write(chunk: string): void;
}

export interface CliIo {
  stdout: WritableLike;
  stderr: WritableLike;
  env: NodeJS.ProcessEnv;
  cwd: string;
}

export interface CliRuntime {
  probeRuntime: typeof probeRuntime;
  inspectTransaction: typeof inspectTransaction;
  validateTransaction: typeof validateTransaction;
  runChainCanary: typeof runChainCanary;
  runCompatibilityMatrix: typeof runCompatibilityMatrix;
  loadPrepareHook: typeof loadPrepareHook;
  readProbeInputFile: typeof readProbeInputFile;
  loadWalletAdapter: typeof loadWalletAdapter;
}

const DEFAULT_RUNTIME: CliRuntime = {
  probeRuntime,
  inspectTransaction,
  validateTransaction,
  runChainCanary,
  runCompatibilityMatrix,
  loadPrepareHook,
  readProbeInputFile,
  loadWalletAdapter,
};

const HELP = `midnight-probe

Runtime diagnostics, compatibility testing, and transaction validation
for the Midnight Network. Test before you spend DUST.

Commands:
  midnight-probe fingerprint --network preprod [--json]
  midnight-probe test-deploy --tx-file ./tx.hex [--network preprod] [--strategy metadata-extrinsic]
  midnight-probe test-call --contract ./contract-dir [--hook ./midnight-probe.prepare.mjs]
  midnight-probe canary --network preprod --tx-hash 0x...
  midnight-probe matrix --contract ./contract-dir --network preprod

Flags:
  --network <preprod|preview|mainnet>
  --rpc-url <wss://...>
  --json
  --out <path>
`;

function writeBanner(io: CliIo, json: boolean): void {
  const line = `${ATTRIBUTION_BANNER} — ${ZIROS_REPOSITORY_URL}\n`;
  (json ? io.stderr : io.stdout).write(line);
}

function writeHuman(io: CliIo, value: string): void {
  io.stdout.write(`${value}\n`);
}

function writeJson(io: CliIo, value: unknown): void {
  io.stdout.write(`${safeJson(value)}\n`);
}

function resolverProjectHint(project: string | undefined): string {
  return project && project.trim().length > 0 ? project : './my-contract';
}

function writeResolverCta(io: CliIo, network: string | undefined, project: string | undefined): void {
  const resolvedNetwork = network ?? 'preprod';
  writeHuman(
    io,
    `Fix workspace drift with ZirOS: download ZirOS and run \`zkf midnight resolve --network ${resolvedNetwork} --project ${resolverProjectHint(project)}\`.`,
  );
}

function fingerprintNeedsResolverCta(result: {
  signedExtensions: string[];
  injectedSignedExtensions: string[];
  unknownSignedExtensions: string[];
}): boolean {
  if (result.unknownSignedExtensions.length > 0) {
    return true;
  }
  const injected = new Set(result.injectedSignedExtensions);
  return result.signedExtensions.some((extension) => !injected.has(extension));
}

function validationNeedsResolverCta(result: {
  validation: Array<{ outcome: string }>;
  submit: { outcome: string };
}): boolean {
  return (
    result.validation.some((entry) => entry.outcome !== 'accepted') ||
    !['accepted', 'skipped'].includes(result.submit.outcome)
  );
}

async function maybeWriteOutput(pathname: string | undefined, value: unknown): Promise<void> {
  if (!pathname) {
    return;
  }
  await writeFile(pathname, `${safeJson(value)}\n`, 'utf-8');
}

function parseStrategy(value: string | undefined): SubmitStrategyId {
  if (value === 'raw-rpc' || value === 'wallet-sdk') {
    return value;
  }
  return 'metadata-extrinsic';
}

async function resolveProbeInput(
  runtime: CliRuntime,
  kind: ProbeKind,
  io: CliIo,
  flags: Map<string, string[]>,
): Promise<ProbeInput> {
  const txFile = optionalFlag(flags, 'tx-file');
  const contractDir = optionalFlag(flags, 'contract');
  if (txFile && contractDir) {
    throw new Error('Use either --tx-file or --contract, not both.');
  }
  if (txFile) {
    return runtime.readProbeInputFile(txFile, kind);
  }
  if (contractDir) {
    return runtime.loadPrepareHook(
      {
        mode: kind,
        network: resolveNetwork({
          network: optionalFlag(flags, 'network') as Parameters<typeof resolveNetwork>[0]['network'],
          rpcUrl: optionalFlag(flags, 'rpc-url'),
        }),
        contractDir,
        env: io.env,
      },
      optionalFlag(flags, 'hook'),
    );
  }
  throw new Error('Expected --tx-file or --contract.');
}

export async function runCli(
  argv: string[],
  io: CliIo = {
    stdout: process.stdout,
    stderr: process.stderr,
    env: process.env,
    cwd: process.cwd(),
  },
  runtime: CliRuntime = DEFAULT_RUNTIME,
): Promise<number> {
  const { positionals, flags } = parseArgs(argv);
  const command = positionals[0];
  const json = hasFlag(flags, 'json');

  if (!command || command === '--help' || command === 'help' || hasFlag(flags, 'help')) {
    writeBanner(io, json);
    writeHuman(io, HELP);
    return 0;
  }

  writeBanner(io, json);

  try {
    const connection = {
      network: optionalFlag(flags, 'network') as Parameters<typeof resolveNetwork>[0]['network'],
      rpcUrl: optionalFlag(flags, 'rpc-url'),
    };

    switch (command) {
      case 'fingerprint': {
        const result = await runtime.probeRuntime(connection);
        await maybeWriteOutput(optionalFlag(flags, 'out'), result);
        if (json) {
          writeJson(io, result);
        } else {
          writeHuman(io, `Network: ${result.network}`);
          writeHuman(io, `RPC: ${result.rpcUrl}`);
          writeHuman(io, `Spec version: ${result.specVersion}`);
          writeHuman(io, `Transaction version: ${result.transactionVersion}`);
          writeHuman(io, `Ledger version: ${result.rawLedgerVersion ?? 'unknown'}`);
          writeHuman(io, `Signed extensions: ${result.signedExtensions.join(', ')}`);
          if (fingerprintNeedsResolverCta(result)) {
            writeResolverCta(io, result.network, undefined);
          }
        }
        return 0;
      }
      case 'test-deploy':
      case 'test-call': {
        const kind: ProbeKind = command === 'test-deploy' ? 'deploy' : 'call';
        const input = await resolveProbeInput(runtime, kind, io, flags);
        const walletAdapterPath = optionalFlag(flags, 'wallet-adapter');
        const walletAdapter = walletAdapterPath ? await runtime.loadWalletAdapter(walletAdapterPath) : undefined;
        const strategy = parseStrategy(optionalFlag(flags, 'strategy'));
        const inspection = await runtime.inspectTransaction(input, connection);
        const validation = await runtime.validateTransaction(input, {
          ...connection,
          strategy,
          submit: hasFlag(flags, 'submit'),
          walletAdapter,
        });
        const result = { inspection, validation };
        await maybeWriteOutput(optionalFlag(flags, 'out'), result);
        if (json) {
          writeJson(io, result);
        } else {
          writeHuman(io, `Kind: ${kind}`);
          writeHuman(io, `Serialized bytes: ${inspection.serializedBytes}`);
          writeHuman(io, `Fits in block: ${inspection.fitsInBlock}`);
          for (const item of validation.validation) {
            writeHuman(io, `${item.source}: ${item.outcome} — ${item.detail}`);
          }
          writeHuman(io, `Submit: ${validation.submit.outcome} — ${validation.submit.detail}`);
          if (validationNeedsResolverCta(validation)) {
            writeResolverCta(io, connection.network, optionalFlag(flags, 'contract'));
          }
        }
        return 0;
      }
      case 'canary': {
        const txHash = optionalFlag(flags, 'tx-hash');
        if (!txHash) {
          throw new Error('canary requires --tx-hash.');
        }
        const result = await runtime.runChainCanary({
          ...connection,
          txHash,
          searchDepth: Number.parseInt(optionalFlag(flags, 'search-depth') ?? '120', 10),
          submitDuplicate: hasFlag(flags, 'submit-duplicate'),
          submitStrategy:
            parseStrategy(optionalFlag(flags, 'strategy')) === 'wallet-sdk'
              ? 'raw-rpc'
              : (parseStrategy(optionalFlag(flags, 'strategy')) as 'metadata-extrinsic' | 'raw-rpc'),
        });
        await maybeWriteOutput(optionalFlag(flags, 'out'), result);
        if (json) {
          writeJson(io, result);
        } else {
          writeHuman(io, `Found at block ${result.lookup.blockNumber} (${result.lookup.blockHash})`);
          for (const item of result.validation.validation) {
            writeHuman(io, `${item.source}: ${item.outcome} — ${item.detail}`);
          }
          writeHuman(io, `Submit: ${result.validation.submit.outcome} — ${result.validation.submit.detail}`);
        }
        return 0;
      }
      case 'matrix': {
        const contractDir = optionalFlag(flags, 'contract');
        if (!contractDir) {
          throw new Error('matrix requires --contract.');
        }
        const walletAdapterPath = optionalFlag(flags, 'wallet-adapter');
        const walletAdapter = walletAdapterPath ? await runtime.loadWalletAdapter(walletAdapterPath) : undefined;
        const matrices = splitCsvFlag(flags, 'matrices');
        const result = await runtime.runCompatibilityMatrix({
          ...connection,
          contractDir,
          hookPath: optionalFlag(flags, 'hook'),
          reportPath: optionalFlag(flags, 'out'),
          strategy: parseStrategy(optionalFlag(flags, 'strategy')),
          submit: hasFlag(flags, 'submit'),
          walletAdapter,
          matrices: matrices.length > 0 ? (matrices as Parameters<typeof runtime.runCompatibilityMatrix>[0]['matrices']) : undefined,
        });
        if (json) {
          writeJson(io, result);
        } else if (result.selected) {
          writeHuman(io, `Selected matrix: ${result.selected.matrixId}`);
          writeHuman(io, `Strategy: ${result.selected.strategy}`);
          writeHuman(io, `Spec version: ${result.selected.runtimeFingerprint.specVersion}`);
          writeResolverCta(io, connection.network, contractDir);
        } else {
          writeHuman(io, 'No compatible matrix was selected.');
          writeResolverCta(io, connection.network, contractDir);
        }
        return 0;
      }
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}
