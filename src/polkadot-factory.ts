import { ApiPromise, WsProvider } from '@polkadot/api';
import type { ApiOptions } from '@polkadot/api/types';
import { findUnknownExtensions } from '@polkadot/types/extrinsic/signedExtensions';
import type { ExtDef } from '@polkadot/types/extrinsic/signedExtensions/types';

import type {
  MidnightConnectionOptions,
  MidnightSignedExtensionStatus,
  ProbeValidationResult,
  ValidationSource,
} from './types.js';
import { classifyOutcome, errorRecord, resolveRpcUrl } from './util.js';

export const MIDNIGHT_ZERO_LENGTH_SIGNED_EXTENSIONS = {
  CheckCallFilter: { extrinsic: {}, payload: {} },
  CheckThrottle: { extrinsic: {}, payload: {} },
} satisfies ExtDef;

const INJECTED_SIGNED_EXTENSION_NAMES = Object.keys(MIDNIGHT_ZERO_LENGTH_SIGNED_EXTENSIONS);
const DEFAULT_SOURCES: ValidationSource[] = ['External', 'Local', 'InBlock'];

export async function createMidnightApi(options: MidnightConnectionOptions = {}): Promise<ApiPromise> {
  const apiOptions: ApiOptions = {
    noInitWarn: true,
    provider: new WsProvider(resolveRpcUrl(options)),
    signedExtensions: MIDNIGHT_ZERO_LENGTH_SIGNED_EXTENSIONS,
  };
  return ApiPromise.create(apiOptions);
}

export async function withMidnightApi<T>(
  options: MidnightConnectionOptions,
  task: (api: ApiPromise) => Promise<T>,
): Promise<T> {
  const api = await createMidnightApi(options);
  try {
    return await task(api);
  } finally {
    await api.disconnect();
  }
}

export function describeMidnightSignedExtensions(api: ApiPromise): MidnightSignedExtensionStatus {
  const runtimeSignedExtensions = [...api.registry.signedExtensions];
  return {
    runtimeSignedExtensions,
    injectedSignedExtensions: [...INJECTED_SIGNED_EXTENSION_NAMES],
    unknownSignedExtensions: findUnknownExtensions(
      runtimeSignedExtensions,
      MIDNIGHT_ZERO_LENGTH_SIGNED_EXTENSIONS,
    ),
  };
}

export function assertSupportedMidnightSignedExtensions(api: ApiPromise): MidnightSignedExtensionStatus {
  const status = describeMidnightSignedExtensions(api);
  if (status.unknownSignedExtensions.length > 0) {
    throw new Error(
      `Midnight runtime advertised unsupported signed extensions: ${status.unknownSignedExtensions.join(', ')}.`,
    );
  }
  return status;
}

export function buildMidnightOuterTx(innerTxHex: string, api: ApiPromise): string {
  assertSupportedMidnightSignedExtensions(api);
  return api.tx.midnight.sendMnTransaction(innerTxHex).toHex();
}

export async function validateMidnightOuterTx(
  outerTxHex: string,
  api: ApiPromise,
  sources: ValidationSource[] = DEFAULT_SOURCES,
): Promise<ProbeValidationResult[]> {
  assertSupportedMidnightSignedExtensions(api);
  const bestHash = await api.rpc.chain.getBlockHash();
  const results: ProbeValidationResult[] = [];

  for (const source of sources) {
    try {
      const validity = await api.call.taggedTransactionQueue.validateTransaction(source, outerTxHex, bestHash);
      results.push({
        source,
        outcome: 'accepted',
        detail: validity.toString(),
        raw: {
          human: validity.toHuman?.() ?? null,
          json: validity.toJSON?.() ?? null,
          text: validity.toString(),
        },
      });
    } catch (error) {
      results.push({
        source,
        outcome: classifyOutcome(error),
        detail: error instanceof Error ? error.message : String(error),
        raw: errorRecord(error),
      });
    }
  }

  return results;
}

export async function submitMidnightOuterTx(outerTxHex: string, api: ApiPromise): Promise<string> {
  assertSupportedMidnightSignedExtensions(api);
  const txHash = await api.rpc.author.submitExtrinsic(outerTxHex);
  return txHash.toString();
}
