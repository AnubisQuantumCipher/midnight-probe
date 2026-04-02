import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import type { MidnightConnectionOptions, MidnightNetwork, ProbeInput, ProbeKind, ProbeOutcome } from './types.js';

export const ATTRIBUTION_BANNER = 'Built by AnubisQuantumCipher — creator of ZirOS';
export const ZIROS_REPOSITORY_URL = 'https://github.com/AnubisQuantumCipher/ziros-attestation';
export const PREPARE_HOOK_FILENAME = 'midnight-probe.prepare.mjs';
export const DEFAULT_NETWORK: MidnightNetwork = 'preprod';
export const DEFAULT_COMPATIBILITY_REPORT_PATH = resolve('./compatibility-report.json');

export const DEFAULT_RPC_URLS: Record<Exclude<MidnightNetwork, 'custom'>, string> = {
  preprod: 'wss://rpc.preprod.midnight.network/',
  preview: 'wss://rpc.preview.midnight.network/',
  mainnet: 'wss://rpc.midnight.network/',
};

export interface ParsedArgs {
  positionals: string[];
  flags: Map<string, string[]>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string[]>();

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      positionals.push(value);
      continue;
    }

    const trimmed = value.slice(2);
    const [flag, inlineValue] = trimmed.split('=', 2);
    if (inlineValue != null) {
      flags.set(flag, [...(flags.get(flag) ?? []), inlineValue]);
      continue;
    }

    const next = argv[index + 1];
    if (next != null && !next.startsWith('--')) {
      flags.set(flag, [...(flags.get(flag) ?? []), next]);
      index += 1;
    } else {
      flags.set(flag, [...(flags.get(flag) ?? []), 'true']);
    }
  }

  return { positionals, flags };
}

export function optionalFlag(flags: Map<string, string[]>, name: string): string | undefined {
  return flags.get(name)?.at(-1);
}

export function hasFlag(flags: Map<string, string[]>, name: string): boolean {
  return flags.has(name);
}

export function splitCsvFlag(flags: Map<string, string[]>, name: string): string[] {
  const raw = optionalFlag(flags, name);
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function resolveNetwork(options: MidnightConnectionOptions): MidnightNetwork {
  if (options.network && options.network !== 'custom') {
    return options.network;
  }
  if (options.rpcUrl) {
    return 'custom';
  }
  return DEFAULT_NETWORK;
}

export function resolveRpcUrl(options: MidnightConnectionOptions): string {
  if (options.rpcUrl) {
    if (options.rpcUrl.startsWith('ws://') || options.rpcUrl.startsWith('wss://')) {
      return options.rpcUrl;
    }
    if (options.rpcUrl.startsWith('http://')) {
      return `ws://${options.rpcUrl.slice('http://'.length)}`;
    }
    if (options.rpcUrl.startsWith('https://')) {
      return `wss://${options.rpcUrl.slice('https://'.length)}`;
    }
    return options.rpcUrl;
  }

  const network = resolveNetwork(options);
  if (network === 'custom') {
    throw new Error('A custom network requires --rpc-url.');
  }
  return DEFAULT_RPC_URLS[network];
}

export function normalizeHex(value: string): `0x${string}` {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]+$/.test(prefixed)) {
    throw new Error(`Expected a hex value, received ${value}.`);
  }
  return prefixed.toLowerCase() as `0x${string}`;
}

export function normalizeProbeInput(
  input: ProbeInput | string,
  fallbackKind: ProbeKind = 'generic',
): ProbeInput {
  if (typeof input === 'string') {
    return {
      kind: fallbackKind,
      finalizedTxHex: normalizeHex(input),
    };
  }

  const normalized: ProbeInput = {
    kind: input.kind ?? fallbackKind,
    label: input.label,
    metadata: input.metadata,
  };

  if (input.finalizedTxHex) {
    normalized.finalizedTxHex = normalizeHex(input.finalizedTxHex);
  }
  if (input.innerTxHex) {
    normalized.innerTxHex = normalizeHex(input.innerTxHex);
  }

  if (!normalized.finalizedTxHex && !normalized.innerTxHex) {
    throw new Error('Probe input must include finalizedTxHex or innerTxHex.');
  }

  return normalized;
}

export function resolveInputTransactionHex(input: ProbeInput): `0x${string}` {
  const candidate = input.finalizedTxHex ?? input.innerTxHex;
  if (!candidate) {
    throw new Error('Probe input did not contain a transaction hex payload.');
  }
  return normalizeHex(candidate);
}

export function unknownToString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value == null) {
    return '';
  }
  return String(value);
}

export function normalizeCodec(value: unknown): unknown {
  if (value == null) {
    return null;
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeCodec(entry));
  }
  if (typeof value === 'object') {
    const maybeCodec = value as {
      toJSON?: () => unknown;
      toHuman?: () => unknown;
      toHex?: () => string;
      toString?: () => string;
    };
    if (typeof maybeCodec.toJSON === 'function') {
      return maybeCodec.toJSON();
    }
    if (typeof maybeCodec.toHuman === 'function') {
      return maybeCodec.toHuman();
    }
    if (typeof maybeCodec.toHex === 'function') {
      return maybeCodec.toHex();
    }
    if (typeof maybeCodec.toString === 'function') {
      return maybeCodec.toString();
    }
  }
  return String(value);
}

export function errorRecord(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const candidate = error as Error & { code?: unknown; data?: unknown };
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
      code: candidate.code ?? null,
      data: candidate.data ?? null,
    };
  }
  return { message: String(error) };
}

export function classifyOutcome(error: unknown): ProbeOutcome {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (/panic/i.test(message) || /wasm trap/i.test(message) || /unreachable instruction/i.test(message)) {
    return 'panic';
  }
  if (
    /invalid transaction/i.test(message) ||
    /custom error/i.test(message) ||
    /transaction became invalid/i.test(message) ||
    /rejected/i.test(message)
  ) {
    return 'rejected';
  }
  return 'error';
}

export function safeJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, inner) => {
      if (typeof inner === 'bigint') {
        return inner.toString();
      }
      return inner;
    },
    2,
  );
}

export async function readTextFile(pathname: string): Promise<string> {
  return readFile(pathname, 'utf-8');
}

export async function writeTextFile(pathname: string, contents: string): Promise<void> {
  await mkdir(dirname(pathname), { recursive: true });
  await writeFile(pathname, contents, 'utf-8');
}

export async function writeJsonFile(pathname: string, value: unknown): Promise<void> {
  await writeTextFile(pathname, `${safeJson(value)}\n`);
}
