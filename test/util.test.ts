import { describe, expect, it } from 'vitest';

import { normalizeHex } from '../src/util.js';

describe('util hex normalization', () => {
  it('rejects odd-length hex strings instead of truncating them silently', () => {
    let message = '';
    try {
      normalizeHex('0x123');
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('even-length');
  });
});
