# midnight-probe

Runtime diagnostics, live SDK matrix testing, and transaction validation for the Midnight Network. Find the working chain and SDK combination before you burn time or DUST.

Built by [AnubisQuantumCipher](https://github.com/AnubisQuantumCipher) — creator of [ZirOS](https://github.com/AnubisQuantumCipher/ziros-attestation), the zero-knowledge operating system.

## Why This Exists

On March 31, 2026, Midnight mainnet launched. On April 1, 2026, preprod drifted hard enough that deploy workflows started failing with `1010: Custom error: 170`, new signed extensions appeared, and `validateTransaction` panicked on traffic that should have been diagnosable.

No public toolkit existed for quickly answering the questions every Midnight developer needed answered:

- What runtime is this chain actually running?
- Does my SDK understand the signed extensions the chain now expects?
- Is `validateTransaction` rejecting my tx, or is it panicking inside the runtime?
- Which SDK version family is currently viable against this network?
- Does this transaction fit inside Midnight's block limits before I burn DUST?

`midnight-probe` is the public diagnostic layer. It does not ship ZirOS internals, proof-server integration, wallet profiles, or contract IP.

Give the community the stethoscope. Keep the surgery.

## Why The Matrix Matters

The matrix runner is the feature that sets `midnight-probe` apart.

It tests public Midnight SDK version families against a live chain automatically. Instead of manually pinning packages, reinstalling dependencies, retrying deploys, and guessing which combination broke, `midnight-probe` runs the combinations for you and selects the first one that actually passes.

That matters because Midnight drift is not theoretical. When preprod stabilizes, when signed extensions change, or when the SDK moves again, the matrix gives developers a reusable way to find the working combination without manual trial and error.

That turns a blocker into infrastructure.

## What It Does

- Fingerprints a live Midnight runtime: spec version, tx version, ledger version, signed extensions, paused calls, throttle data.
- Validates a prepared transaction through Midnight's validator across `External`, `Local`, and `InBlock`.
- Submits via `metadata-extrinsic` or `raw-rpc`, with `wallet-sdk` available only through a user-provided adapter.
- Inspects finalized transaction bytes with `@midnight-ntwrk/ledger-v8` and computes the 5-dimensional Midnight cost profile.
- Runs a live compatibility matrix by cloning a contract workspace, pinning public Midnight package families, invoking a clean user-owned prepare hook, and selecting the first passing matrix.
- Replays a known-good canary transaction hash to tell whether the network is sick or your contract is.

## What It Does Not Do

- It does not prove circuits. Use ZirOS or your own proof pipeline for that.
- It does not compile Compact contracts for you.
- It does not manage keys, wallet profiles, or operator credentials.
- It does not contain ZirOS source code.
- It does not bundle private attestation logic, proof servers, or wallet automation.

## Install

```bash
npm install midnight-probe
```

## Quick Start

Run the matrix first when the network is drifting:

```bash
npx midnight-probe matrix --contract ./my-contract --network preprod --out ./compatibility-report.json
```

That report tells you which SDK family worked, which ones failed, and what runtime fingerprint the decision was made against.

Fingerprint a live chain:

```bash
npx midnight-probe fingerprint --network preprod
```

Test a prepared deploy transaction from a file:

```bash
npx midnight-probe test-deploy --tx-file ./tx.hex --network preprod
```

Test a contract workspace through a clean user-owned prepare hook:

```bash
npx midnight-probe test-call --contract ./my-contract --network preprod
```

Run the version matrix:

```bash
npx midnight-probe matrix --contract ./my-contract --network preprod --out ./compatibility-report.json
```

Replay a known-good tx hash as a chain canary:

```bash
npx midnight-probe canary --network preprod --tx-hash 0xabc123...
```

## Prepare Hook Contract

`midnight-probe` does not compile, prove, or balance transactions itself. If you want `--contract <dir>` support, your workspace must expose a hook file, typically:

```text
<contract-dir>/midnight-probe.prepare.mjs
```

That hook must export an async default function:

```js
export default async function prepare({ mode, network, contractDir, env }) {
  return {
    kind: mode,
    finalizedTxHex: '0x...',
    label: `${network}:${mode}`,
    metadata: { contractDir },
  };
}
```

The returned object is the only supported bridge from `midnight-probe` into your contract workspace. The hook owns all proving, compilation, or wallet-specific logic if your project needs it.

## CLI

### `fingerprint`

```bash
npx midnight-probe fingerprint --network preprod
npx midnight-probe fingerprint --rpc-url wss://rpc.preprod.midnight.network/ --json
```

### `test-deploy`

```bash
npx midnight-probe test-deploy --tx-file ./tx.hex --network preprod
npx midnight-probe test-deploy --contract ./my-contract --strategy raw-rpc --submit
```

### `test-call`

```bash
npx midnight-probe test-call --contract ./my-contract --hook ./custom.prepare.mjs
```

### `canary`

```bash
npx midnight-probe canary --network preprod --tx-hash 0x...
npx midnight-probe canary --network preprod --tx-hash 0x... --submit-duplicate --strategy raw-rpc
```

### `matrix`

```bash
npx midnight-probe matrix --contract ./my-contract --network preprod
npx midnight-probe matrix --contract ./my-contract --matrices v4-stable,v4-pre,v3-compat --out ./compatibility-report.json
```

This command is the core differentiator. It tests SDK families against the live network, records what happened for each attempt, and returns the first working combination so you do not have to debug version drift manually.

## Programmatic API

```ts
import {
  createMidnightApi,
  inspectTransaction,
  probeRuntime,
  runChainCanary,
  runCompatibilityMatrix,
  validateTransaction,
} from 'midnight-probe';
```

Exported public types include:

- `RuntimeFingerprint`
- `ProbeInput`
- `TransactionInspection`
- `ProbeValidationResult`
- `SubmitStrategyId`
- `CompatibilityReport`
- `CompatibilitySelection`
- `WalletSubmitAdapter`

## Optional On-Chain Registry

The repo includes an optional Compact contract at [contracts/MidnightProbeRegistry.compact](./contracts/MidnightProbeRegistry.compact). It records high-level chain health results on-chain if you choose to deploy it later.

That contract is included as source and documentation only in v1. The npm package does not deploy it, does not write to it by default, and does not assume any public dashboard exists yet.

## Examples

- [examples/basic-fingerprint.ts](./examples/basic-fingerprint.ts)
- [examples/test-deploy.ts](./examples/test-deploy.ts)
- [examples/version-matrix.ts](./examples/version-matrix.ts)
- [examples/example-contract/midnight-probe.prepare.mjs](./examples/example-contract/midnight-probe.prepare.mjs)

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT.
