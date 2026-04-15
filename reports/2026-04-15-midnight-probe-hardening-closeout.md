# midnight-probe hardening closeout

Repository: `https://github.com/AnubisQuantumCipher/midnight-probe`
Workspace: `/Users/sicarii/work/audits/midnight-probe-20260415T124122Z`
Base commit audited: `e22097f1963f873057216498de86ce35bf1a5c1d`
Date: 2026-04-15

Scope of this tranche:
- add regression tests for the concrete failures found in the hostile audit
- harden source code so the tested failures no longer survive
- preserve RED/GREEN evidence locally
- stay inside the local repo + local harness boundary

Important release-boundary note:
- I did not access keychain secrets
- I did not publish to npm, GitHub, or any external endpoint
- reason: your original audit boundary explicitly prohibited real external systems / third-party endpoints, so a real release would have violated the active rules
- if you want me to perform an actual publish later, you need to explicitly relax that boundary in a new instruction

## What changed

### 1. Hex normalization is now fail-closed on odd-length input
Files:
- `src/util.ts`
- `test/util.test.ts`

Change:
- `normalizeHex()` now rejects odd-length hex strings instead of allowing silent truncation through downstream `Buffer.from(..., 'hex')`

Why:
- diagnostic tools must not silently mutate attacker-controlled input bytes

### 2. Metadata submission now times out instead of hanging forever
Files:
- `src/polkadot-factory.ts`
- `src/submit-strategy.ts`
- `src/chain-canary.ts`
- `test/submit-strategy.test.ts`

Change:
- added `submitMidnightMetadataTx()` with a timeout guard
- wired `validateTransaction()` and canary duplicate submission through that guarded path
- exposed `submitTimeoutMs` in the relevant option shapes used internally by these APIs

Why:
- the old path could wait forever if the SDK callback never emitted `isInvalid`, `isInBlock`, or `isFinalized`

### 3. Compatibility report parsing now distinguishes missing from malformed
Files:
- `src/compatibility.ts`
- `test/compatibility.test.ts`

Change:
- `readCompatibilityReport()` now returns `null` only for `ENOENT`
- malformed JSON now throws an explicit `Invalid compatibility report JSON ...` error

Why:
- corrupted evidence must not be silently treated as absent evidence

### 4. Matrix runner now hardens install and workspace handling
Files:
- `src/matrix-runner.ts`
- `src/types.ts`
- `test/prepare-hook-and-matrix.test.ts`

Change:
- matrix install now uses `npm install --ignore-scripts --no-audit --no-fund`
- install environment is filtered to a small allowlist instead of inheriting the full caller environment
- missing matrix-family packages are now injected into `devDependencies`, so the matrix actually represents the full family rather than only whatever happened to already exist
- temp workspaces are removed by default after the probe
- attempts now record `workspaceRetained`
- added a test-only runtime injection surface so matrix behavior can be regression-tested locally without live network calls

Why:
- this was the highest-risk boundary in the original audit

## RED before hardening

Primary RED artifact:
- `reports/2026-04-15-hostile-audit/results/red-existing-tests-before-hardening.json`

Recorded failing regression tests before fixes:
- odd-length hex rejection
- metadata submit timeout behavior
- missing matrix-family package injection
- malformed compatibility report rejection

The earlier hostile-audit artifacts also preserved the original boundary failures:
- `results/matrix-preinstall-env-leak.json`
- `results/metadata-submit-hang.json`
- `results/odd-hex-truncation.json`
- `results/compatibility-malformed-report.json`

## GREEN after hardening

Primary GREEN artifact:
- `reports/2026-04-15-hostile-audit/results/green-existing-tests-after-hardening.json`

Summary:
- 21 tests passed
- 0 failed

Additional verification artifacts:
- `results/hex-guard-check.json`
- `results/metadata-timeout-check.json`
- `results/matrix-hardening-check.json`
- `results/compatibility-parse-guard.json`
- `results/mutation-checks-after-hardening.json`

Notable post-fix evidence:
- odd-length hex now rejects with `Expected an even-length hex value...`
- metadata submission now returns an error after timeout instead of hanging
- matrix install command now includes `--ignore-scripts`
- matrix install env no longer included the injected `AUDIT_SECRET`
- matrix workspace is removed by default after the run
- the two previously surviving mutants are now killed by the updated test set

## What is better now

Improved materially:
- parser/input integrity for tx hex
- liveness behavior of metadata submission
- evidence integrity of compatibility reports
- matrix-runner trust boundary around npm lifecycle execution
- matrix-runner success honesty for partial dependency-family rewrites
- matrix-runner residue handling after the run
- regression sensitivity of the test suite

## Residual risk that still exists

1. Dynamic hook execution is still an explicit trust boundary
- `loadPrepareHook()` and wallet adapter loading are intentional code-execution boundaries
- this is acceptable for owned workspaces, but it is still not a safe surface for arbitrary untrusted code

2. The matrix runner still copies the contract workspace during execution
- default cleanup now reduces residue after completion
- but the temporary clone still exists during the run by design
- I did not attempt a deeper allowlist-based workspace copier in this tranche because that would risk breaking legitimate hooks without a stronger project contract

3. Real dependency-path verification remains partially blocked in this sandbox
- I still did not perform a fresh `npm install` from external registry or a real public release
- the no-third-party-endpoint audit boundary remained in force

4. No real external publish was attempted
- release tooling, npm auth, GitHub release creation, and any keychain-backed publish path remain unexercised here

## Honest release judgment after hardening

Current state:
- stronger and more honest than the audited baseline
- locally regression-hardened for the concrete failures I found
- still not enough evidence for me to claim a fully exercised real-world release path, because I intentionally did not cross the original external-boundary rules

What I would still require before calling it release-closed in the strong sense:
- explicit user approval to relax the no-third-party-endpoint boundary
- a clean real dependency install/build/test with actual upstream packages
- a release dry-run or publish rehearsal against the intended registry/release target
- post-publish verification of the shipped package contents against the hardened source tree
