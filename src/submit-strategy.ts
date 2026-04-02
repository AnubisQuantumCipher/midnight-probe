import type { ApiPromise } from '@polkadot/api';

import {
  assertSupportedMidnightSignedExtensions,
  buildMidnightOuterTx,
  createMidnightApi,
  submitMidnightOuterTx,
  validateMidnightOuterTx,
} from './polkadot-factory.js';
import type {
  MidnightConnectionOptions,
  ProbeInput,
  ProbeSubmitResult,
  SubmitStrategyId,
  TransactionValidationReport,
  ValidationSource,
  WalletSubmitAdapter,
} from './types.js';
import {
  classifyOutcome,
  errorRecord,
  normalizeProbeInput,
  resolveInputTransactionHex,
  resolveNetwork,
  resolveRpcUrl,
} from './util.js';

async function submitWithMetadataStrategy(innerTxHex: string, api: ApiPromise): Promise<ProbeSubmitResult> {
  try {
    const txHash = await new Promise<string>((resolve, reject) => {
      let unsubscribe: (() => void) | undefined;
      let settled = false;

      api.tx.midnight
        .sendMnTransaction(innerTxHex)
        .send((result) => {
          if (settled) {
            return;
          }
          if (result.status.isInvalid) {
            settled = true;
            unsubscribe?.();
            reject(new Error(`Transaction became invalid: ${result.status.toString()}`));
            return;
          }
          if (result.status.isInBlock || result.status.isFinalized) {
            settled = true;
            unsubscribe?.();
            resolve(result.txHash.toString());
          }
        })
        .then((handle) => {
          unsubscribe = handle;
        })
        .catch(reject);
    });

    return {
      strategy: 'metadata-extrinsic',
      outcome: 'accepted',
      txHash,
      detail: `Metadata submit accepted transaction ${txHash}.`,
    };
  } catch (error) {
    return {
      strategy: 'metadata-extrinsic',
      outcome: classifyOutcome(error),
      txHash: null,
      detail: error instanceof Error ? error.message : String(error),
      raw: errorRecord(error),
    };
  }
}

async function submitWithRawRpcStrategy(outerTxHex: string, api: ApiPromise): Promise<ProbeSubmitResult> {
  try {
    const txHash = await submitMidnightOuterTx(outerTxHex, api);
    return {
      strategy: 'raw-rpc',
      outcome: 'accepted',
      txHash,
      detail: `Raw RPC submit accepted transaction ${txHash}.`,
    };
  } catch (error) {
    return {
      strategy: 'raw-rpc',
      outcome: classifyOutcome(error),
      txHash: null,
      detail: error instanceof Error ? error.message : String(error),
      raw: errorRecord(error),
    };
  }
}

async function submitWithWalletAdapter(
  adapter: WalletSubmitAdapter,
  request: Parameters<WalletSubmitAdapter['submitTransaction']>[0],
): Promise<ProbeSubmitResult> {
  try {
    const result = await adapter.submitTransaction(request);
    return {
      strategy: 'wallet-sdk',
      outcome: 'accepted',
      txHash: result.txHash ?? null,
      detail: result.detail ?? 'Wallet adapter accepted the transaction.',
      raw: result.raw,
    };
  } catch (error) {
    return {
      strategy: 'wallet-sdk',
      outcome: classifyOutcome(error),
      txHash: null,
      detail: error instanceof Error ? error.message : String(error),
      raw: errorRecord(error),
    };
  }
}

export async function validateTransaction(
  input: ProbeInput | string,
  options: MidnightConnectionOptions & {
    api?: ApiPromise;
    strategy?: SubmitStrategyId;
    submit?: boolean;
    sources?: ValidationSource[];
    walletAdapter?: WalletSubmitAdapter;
  } = {},
): Promise<TransactionValidationReport> {
  const normalizedInput = normalizeProbeInput(input);
  const innerTxHex = resolveInputTransactionHex(normalizedInput);
  const api = options.api ?? (await createMidnightApi(options));
  const ownsApi = options.api == null;
  const strategy = options.strategy ?? 'metadata-extrinsic';

  try {
    const signedExtensions = assertSupportedMidnightSignedExtensions(api);
    const outerTxHex = buildMidnightOuterTx(innerTxHex, api);
    const validation = await validateMidnightOuterTx(outerTxHex, api, options.sources);

    let submit: ProbeSubmitResult = {
      strategy,
      outcome: 'skipped',
      txHash: null,
      detail: 'Submission skipped.',
    };

    if (options.submit) {
      switch (strategy) {
        case 'metadata-extrinsic':
          submit = await submitWithMetadataStrategy(innerTxHex, api);
          break;
        case 'raw-rpc':
          submit = await submitWithRawRpcStrategy(outerTxHex, api);
          break;
        case 'wallet-sdk':
          if (!options.walletAdapter) {
            submit = {
              strategy,
              outcome: 'error',
              txHash: null,
              detail: 'Wallet adapter strategy requires a user-provided wallet adapter.',
            };
          } else {
            submit = await submitWithWalletAdapter(options.walletAdapter, {
              api,
              network: resolveNetwork(options),
              rpcUrl: resolveRpcUrl(options),
              input: normalizedInput,
              innerTxHex,
              outerTxHex,
            });
          }
          break;
      }
    }

    return {
      observedAt: new Date().toISOString(),
      network: resolveNetwork(options),
      rpcUrl: resolveRpcUrl(options),
      input: normalizedInput,
      strategy,
      outerTxHex,
      signedExtensions,
      validation,
      submit,
    };
  } finally {
    if (ownsApi) {
      await api.disconnect();
    }
  }
}
