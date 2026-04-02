import type { ApiPromise } from '@polkadot/api';

import { createMidnightApi, describeMidnightSignedExtensions } from './polkadot-factory.js';
import type { MidnightConnectionOptions, RuntimeFingerprint, RuntimeWeightValue } from './types.js';
import { normalizeCodec, resolveNetwork, resolveRpcUrl, unknownToString } from './util.js';

function normalizeWeight(value: unknown): RuntimeWeightValue | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  return {
    refTime: unknownToString(record.refTime ?? 0),
    proofSize: unknownToString(record.proofSize ?? 0),
  };
}

export async function probeRuntime(
  options: MidnightConnectionOptions & { api?: ApiPromise } = {},
): Promise<RuntimeFingerprint> {
  const api = options.api ?? (await createMidnightApi(options));
  const ownsApi = options.api == null;

  try {
    const ledgerVersionCodec =
      'midnightRuntimeApi' in api.call && 'getLedgerVersion' in api.call.midnightRuntimeApi
        ? await api.call.midnightRuntimeApi.getLedgerVersion()
        : null;
    const midnightQueries = (api.query.midnight ?? {}) as Record<string, (() => Promise<unknown>) | undefined>;
    const sizeWeightCodec = midnightQueries.configurableTransactionSizeWeight
      ? await midnightQueries.configurableTransactionSizeWeight()
      : null;
    const pausedCallsCodec =
      'txPause' in api.query && 'pausedCalls' in api.query.txPause
        ? await api.query.txPause.pausedCalls.entries()
        : [];
    let accountUsage: unknown = null;
    try {
      accountUsage =
        'throttle' in api.query && 'accountUsage' in api.query.throttle
          ? normalizeCodec(await api.query.throttle.accountUsage.entries())
          : null;
    } catch {
      accountUsage = null;
    }

    const signedExtensionStatus = describeMidnightSignedExtensions(api);

    return {
      observedAt: new Date().toISOString(),
      network: resolveNetwork(options),
      rpcUrl: resolveRpcUrl(options),
      specVersion: api.runtimeVersion.specVersion.toString(),
      transactionVersion: api.runtimeVersion.transactionVersion.toString(),
      signedExtensions: signedExtensionStatus.runtimeSignedExtensions,
      injectedSignedExtensions: signedExtensionStatus.injectedSignedExtensions,
      unknownSignedExtensions: signedExtensionStatus.unknownSignedExtensions,
      rawLedgerVersion:
        ledgerVersionCodec && typeof ledgerVersionCodec.toHex === 'function'
          ? ledgerVersionCodec.toHex()
          : ledgerVersionCodec
            ? unknownToString(normalizeCodec(ledgerVersionCodec))
            : null,
      configurableTransactionSizeWeight: normalizeWeight(normalizeCodec(sizeWeightCodec)),
      pausedCalls: Array.isArray(pausedCallsCodec) ? pausedCallsCodec.length : 0,
      throttle: {
        palletKeys: Object.keys(api.query.throttle ?? {}),
        accountUsage,
      },
    };
  } finally {
    if (ownsApi) {
      await api.disconnect();
    }
  }
}
