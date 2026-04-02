import { runCompatibilityMatrix } from '../src/index.js';

const report = await runCompatibilityMatrix({
  network: 'preprod',
  contractDir: new URL('./example-contract', import.meta.url).pathname,
  reportPath: './compatibility-report.json',
});

console.log(`selected matrix: ${report.selected?.matrixId ?? 'none'}`);
