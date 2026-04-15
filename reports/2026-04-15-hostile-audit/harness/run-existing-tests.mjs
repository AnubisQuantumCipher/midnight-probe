import { writeFile } from 'node:fs/promises';
import { runRegisteredTests } from '../../../node_modules/vitest/index.js';

await import('../../../test/util.test.ts');
await import('../../../test/runtime-probe.test.ts');
await import('../../../test/tx-inspector.test.ts');
await import('../../../test/submit-strategy.test.ts');
await import('../../../test/prepare-hook-and-matrix.test.ts');
await import('../../../test/chain-canary.test.ts');
await import('../../../test/compatibility.test.ts');
await import('../../../test/cli.test.ts');

const result = await runRegisteredTests();
await writeFile(new URL('../results/existing-tests.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (result.failed > 0) {
  process.exitCode = 1;
}
