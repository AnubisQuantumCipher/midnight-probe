import { Buffer } from 'node:buffer';

import { LedgerParameters, Transaction } from '@midnight-ntwrk/ledger-v8';
import type { ApiPromise } from '@polkadot/api';

import { createMidnightApi } from './polkadot-factory.js';
import type {
  MidnightConnectionOptions,
  NormalizedCostShape,
  ProbeInput,
  SyntheticCostShape,
  TransactionInspection,
} from './types.js';
import { normalizeProbeInput, resolveInputTransactionHex, resolveNetwork, resolveRpcUrl } from './util.js';

const DESERIALIZE_MARKERS = [
  ['signature', 'proof', 'binding'],
  ['signature', 'proof', 'pre-binding'],
  ['signature', 'pre-proof', 'pre-binding'],
  ['signature', 'no-proof', 'no-binding'],
] as const;

function syntheticCostToShape(value: {
  readTime: bigint;
  computeTime: bigint;
  blockUsage: bigint;
  bytesWritten: bigint;
  bytesChurned: bigint;
}): SyntheticCostShape {
  return {
    readTime: value.readTime.toString(),
    computeTime: value.computeTime.toString(),
    blockUsage: value.blockUsage.toString(),
    bytesWritten: value.bytesWritten.toString(),
    bytesChurned: value.bytesChurned.toString(),
  };
}

function normalizedCostToShape(value: {
  readTime: number;
  computeTime: number;
  blockUsage: number;
  bytesWritten: number;
  bytesChurned: number;
}): NormalizedCostShape {
  return {
    readTime: value.readTime,
    computeTime: value.computeTime,
    blockUsage: value.blockUsage,
    bytesWritten: value.bytesWritten,
    bytesChurned: value.bytesChurned,
  };
}

function deserializeProbeTransaction(transactionHex: string): {
  transaction: Transaction<any, any, any>;
  mode: string;
} {
  const bytes = Buffer.from(transactionHex.slice(2), 'hex');

  for (const [signature, proof, binding] of DESERIALIZE_MARKERS) {
    try {
      const transaction = Transaction.deserialize(
        signature as any,
        proof as any,
        binding as any,
        bytes,
      ) as Transaction<any, any, any>;
      return {
        transaction,
        mode: `${signature}/${proof}/${binding}`,
      };
    } catch {
      continue;
    }
  }

  throw new Error('Unable to deserialize probe transaction bytes as a Midnight ledger transaction.');
}

export async function inspectTransaction(
  input: ProbeInput | string,
  options: MidnightConnectionOptions & { api?: ApiPromise } = {},
): Promise<TransactionInspection> {
  const normalizedInput = normalizeProbeInput(input);
  const transactionHex = resolveInputTransactionHex(normalizedInput);
  const { transaction, mode } = deserializeProbeTransaction(transactionHex);
  const params = LedgerParameters.initialParameters();
  const cost = transaction.cost(params);

  let normalizedCost: NormalizedCostShape | null = null;
  let fitsInBlock = true;
  let fitFailureReason: string | null = null;
  try {
    normalizedCost = normalizedCostToShape(params.normalizeFullness(cost));
  } catch (error) {
    fitsInBlock = false;
    fitFailureReason = error instanceof Error ? error.message : String(error);
  }

  let runtimeCost: unknown = null;
  let runtimeCostError: string | null = null;
  if (options.api || options.network || options.rpcUrl) {
    const api = options.api ?? (await createMidnightApi(options));
    const ownsApi = options.api == null;
    try {
      runtimeCost = await api.call.midnightRuntimeApi.getTransactionCost(transactionHex);
    } catch (error) {
      runtimeCostError = error instanceof Error ? error.message : String(error);
    } finally {
      if (ownsApi) {
        await api.disconnect();
      }
    }
  }

  return {
    observedAt: new Date().toISOString(),
    network: options.network || options.rpcUrl ? resolveNetwork(options) : null,
    rpcUrl: options.network || options.rpcUrl ? resolveRpcUrl(options) : null,
    input: normalizedInput,
    transactionHex,
    serializedBytes: transaction.serialize().length,
    deserializationMode: mode,
    cost: syntheticCostToShape(cost),
    normalizedCost,
    fitsInBlock,
    fitFailureReason,
    runtimeCost,
    runtimeCostError,
  };
}
