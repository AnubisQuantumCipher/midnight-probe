import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { PrepareHookContext, ProbeInput, ProbeKind, WalletSubmitAdapter } from './types.js';
import { PREPARE_HOOK_FILENAME, normalizeProbeInput } from './util.js';

function asProbeInput(value: unknown, fallbackKind: ProbeKind): ProbeInput {
  if (typeof value === 'string') {
    return normalizeProbeInput(value, fallbackKind);
  }
  if (!value || typeof value !== 'object') {
    throw new Error('Prepare hook must return a probe input object or transaction hex string.');
  }
  return normalizeProbeInput(value as ProbeInput, fallbackKind);
}

export async function readProbeInputFile(pathname: string, kind: ProbeKind): Promise<ProbeInput> {
  const raw = await readFile(pathname, 'utf-8');
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    return asProbeInput(JSON.parse(trimmed), kind);
  }
  return asProbeInput(trimmed, kind);
}

export async function loadPrepareHook(
  context: PrepareHookContext,
  hookPath?: string,
): Promise<ProbeInput> {
  const resolved = hookPath
    ? resolve(hookPath)
    : resolve(context.contractDir, PREPARE_HOOK_FILENAME);
  const moduleUrl = `${pathToFileURL(resolved).href}?t=${Date.now()}`;
  const loaded = (await import(moduleUrl)) as { default?: unknown };
  if (typeof loaded.default !== 'function') {
    throw new Error(`Prepare hook ${resolved} must export an async default function.`);
  }
  const result = await loaded.default(context);
  return asProbeInput(result, context.mode);
}

export async function loadWalletAdapter(pathname: string): Promise<WalletSubmitAdapter> {
  const resolved = resolve(pathname);
  const moduleUrl = `${pathToFileURL(resolved).href}?t=${Date.now()}`;
  const loaded = (await import(moduleUrl)) as {
    default?: unknown;
    walletSubmitAdapter?: unknown;
  };
  const candidate = loaded.default ?? loaded.walletSubmitAdapter;
  if (!candidate || typeof candidate !== 'object' || typeof (candidate as WalletSubmitAdapter).submitTransaction !== 'function') {
    throw new Error(`Wallet adapter ${resolved} must expose submitTransaction(request).`);
  }
  return candidate as WalletSubmitAdapter;
}
