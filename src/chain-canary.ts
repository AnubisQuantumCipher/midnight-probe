import type { ApiPromise } from '@polkadot/api';

import { buildMidnightOuterTx, createMidnightApi, submitMidnightOuterTx, validateMidnightOuterTx } from './polkadot-factory.js';
import type {
  MidnightConnectionOptions,
  SubmitStrategyId,
  TransactionValidationReport,
  ValidationSource,
} from './types.js';
import { classifyOutcome, errorRecord, resolveNetwork, resolveRpcUrl } from './util.js';

function matchesHash(candidate: string, target: string): boolean {
  return candidate.toLowerCase() === target.toLowerCase();
}

async function findMidnightExtrinsicByHash(
  api: ApiPromise,
  txHash: string,
  searchDepth: number,
): Promise<{
  blockNumber: number;
  blockHash: string;
  extrinsicIndex: number;
  innerTxHex: string;
  outerTxHex: string;
}> {
  const head = await api.rpc.chain.getHeader();
  const latest = head.number.toNumber();

  for (let number = latest; number >= Math.max(0, latest - searchDepth); number -= 1) {
    const blockHash = await api.rpc.chain.getBlockHash(number);
    const signedBlock = await api.rpc.chain.getBlock(blockHash);

    for (const [extrinsicIndex, extrinsic] of signedBlock.block.extrinsics.entries()) {
      const candidateHash = extrinsic.hash.toHex();
      if (!matchesHash(candidateHash, txHash)) {
        continue;
      }
      if (extrinsic.method.section !== 'midnight' || extrinsic.method.method !== 'sendMnTransaction') {
        throw new Error(`Transaction ${txHash} was found, but it is not midnight.sendMnTransaction.`);
      }
      const innerTxHex = extrinsic.method.args[0].toHex();
      return {
        blockNumber: number,
        blockHash: blockHash.toString(),
        extrinsicIndex,
        innerTxHex,
        outerTxHex: buildMidnightOuterTx(innerTxHex, api),
      };
    }
  }

  throw new Error(`Unable to find transaction ${txHash} within the last ${searchDepth} blocks.`);
}

async function submitDuplicate(
  strategy: SubmitStrategyId,
  innerTxHex: string,
  outerTxHex: string,
  api: ApiPromise,
) {
  if (strategy === 'metadata-extrinsic') {
    try {
      const txHash = await new Promise<string>((resolve, reject) => {
        let unsubscribe: (() => void) | undefined;
        api.tx.midnight
          .sendMnTransaction(innerTxHex)
          .send((result) => {
            if (result.status.isInvalid) {
              unsubscribe?.();
              reject(new Error(`Transaction became invalid: ${result.status.toString()}`));
              return;
            }
            if (result.status.isInBlock || result.status.isFinalized) {
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
        strategy,
        outcome: 'accepted' as const,
        txHash,
        detail: `Duplicate canary submit accepted transaction ${txHash}.`,
      };
    } catch (error) {
      return {
        strategy,
        outcome: classifyOutcome(error),
        txHash: null,
        detail: error instanceof Error ? error.message : String(error),
        raw: errorRecord(error),
      };
    }
  }

  try {
    const txHash = await submitMidnightOuterTx(outerTxHex, api);
    return {
      strategy,
      outcome: 'accepted' as const,
      txHash,
      detail: `Duplicate canary submit accepted transaction ${txHash}.`,
    };
  } catch (error) {
    return {
      strategy,
      outcome: classifyOutcome(error),
      txHash: null,
      detail: error instanceof Error ? error.message : String(error),
      raw: errorRecord(error),
    };
  }
}

export async function runChainCanary(
  options: MidnightConnectionOptions & {
    api?: ApiPromise;
    txHash: string;
    searchDepth?: number;
    sources?: ValidationSource[];
    submitDuplicate?: boolean;
    submitStrategy?: Exclude<SubmitStrategyId, 'wallet-sdk'>;
  },
): Promise<{
  observedAt: string;
  network: ReturnType<typeof resolveNetwork>;
  rpcUrl: string;
  searchDepth: number;
  lookup: {
    txHash: string;
    blockNumber: number;
    blockHash: string;
    extrinsicIndex: number;
  };
  validation: TransactionValidationReport;
}> {
  const api = options.api ?? (await createMidnightApi(options));
  const ownsApi = options.api == null;
  const searchDepth = options.searchDepth ?? 120;

  try {
    const found = await findMidnightExtrinsicByHash(api, options.txHash, searchDepth);
    const validation = await validateMidnightOuterTx(found.outerTxHex, api, options.sources);
    const submit =
      options.submitDuplicate
        ? await submitDuplicate(options.submitStrategy ?? 'raw-rpc', found.innerTxHex, found.outerTxHex, api)
        : {
            strategy: options.submitStrategy ?? 'raw-rpc',
            outcome: 'skipped' as const,
            txHash: null,
            detail: 'Duplicate submission disabled.',
          };

    return {
      observedAt: new Date().toISOString(),
      network: resolveNetwork(options),
      rpcUrl: resolveRpcUrl(options),
      searchDepth,
      lookup: {
        txHash: options.txHash,
        blockNumber: found.blockNumber,
        blockHash: found.blockHash,
        extrinsicIndex: found.extrinsicIndex,
      },
      validation: {
        observedAt: new Date().toISOString(),
        network: resolveNetwork(options),
        rpcUrl: resolveRpcUrl(options),
        input: {
          kind: 'generic',
          innerTxHex: found.innerTxHex,
          label: `canary:${options.txHash}`,
        },
        strategy: options.submitStrategy ?? 'raw-rpc',
        outerTxHex: found.outerTxHex,
        signedExtensions: {
          runtimeSignedExtensions: [...api.registry.signedExtensions],
          injectedSignedExtensions: ['CheckCallFilter', 'CheckThrottle'],
          unknownSignedExtensions: [],
        },
        validation,
        submit,
      },
    };
  } finally {
    if (ownsApi) {
      await api.disconnect();
    }
  }
}
