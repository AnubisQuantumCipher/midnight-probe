import { probeRuntime } from '../src/index.js';

const fingerprint = await probeRuntime({
  network: 'preprod',
});

console.log(fingerprint.specVersion);
console.log(fingerprint.signedExtensions.join(', '));
