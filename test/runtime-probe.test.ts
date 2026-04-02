import { describe, expect, it } from 'vitest';

import { describeMidnightSignedExtensions } from '../src/polkadot-factory.js';
import { probeRuntime } from '../src/runtime-probe.js';
import { makeFakeApi, makeSignedExtensions } from './helpers.js';

describe('runtime probe', () => {
  it('describes injected and unknown signed extensions', () => {
    const api = makeFakeApi({
      registry: {
        signedExtensions: [...makeSignedExtensions(), 'UnexpectedExtension'],
      },
    });

    const status = describeMidnightSignedExtensions(api);

    expect(status.injectedSignedExtensions).toContain('CheckThrottle');
    expect(status.unknownSignedExtensions).toContain('UnexpectedExtension');
  });

  it('builds a runtime fingerprint from api state', async () => {
    const result = await probeRuntime({
      network: 'preprod',
      api: makeFakeApi(),
    });

    expect(result.network).toBe('preprod');
    expect(result.specVersion).toBe('22000');
    expect(result.transactionVersion).toBe('2');
    expect(result.signedExtensions).toContain('CheckCallFilter');
    expect(result.rawLedgerVersion).toBe('0x183d382e302e32');
  });
});
