import { LedgerParameters } from '@midnight-ntwrk/ledger-v8';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { inspectTransaction } from '../src/tx-inspector.js';
import { makeFixtureTxHex } from './helpers.js';

describe('tx inspector', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deserializes finalized transaction bytes and computes five-dimensional cost', async () => {
    const inspection = await inspectTransaction({
      kind: 'deploy',
      finalizedTxHex: makeFixtureTxHex(),
    });

    expect(inspection.deserializationMode).toBe('signature/proof/binding');
    expect(inspection.serializedBytes).toBeGreaterThan(0);
    expect(Number(inspection.cost.blockUsage)).toBeGreaterThanOrEqual(0);
    expect(inspection.fitsInBlock).toBe(true);
    expect(inspection.normalizedCost).not.toBeNull();
  });

  it('surfaces a block-fit failure when normalization rejects the tx cost', async () => {
    const params = LedgerParameters.initialParameters();
    const normalizeSpy = vi.spyOn(params, 'normalizeFullness').mockImplementation(() => {
      throw new Error('block limit exceeded');
    });
    vi.spyOn(LedgerParameters, 'initialParameters').mockReturnValue(params);

    const inspection = await inspectTransaction({
      kind: 'deploy',
      finalizedTxHex: makeFixtureTxHex(),
    });

    expect(normalizeSpy).toHaveBeenCalled();
    expect(inspection.fitsInBlock).toBe(false);
    expect(inspection.fitFailureReason).toContain('block limit exceeded');
  });
});
