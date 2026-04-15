# Hardening evidence index

Report:
- `reports/2026-04-15-midnight-probe-hardening-closeout.md`

## RED evidence
- `reports/2026-04-15-hostile-audit/results/red-existing-tests-before-hardening.json`
- `reports/2026-04-15-hostile-audit/results/matrix-preinstall-env-leak.json`
- `reports/2026-04-15-hostile-audit/results/metadata-submit-hang.json`
- `reports/2026-04-15-hostile-audit/results/odd-hex-truncation.json`
- `reports/2026-04-15-hostile-audit/results/compatibility-malformed-report.json`

## GREEN evidence
- `reports/2026-04-15-hostile-audit/results/green-existing-tests-after-hardening.json`
- `reports/2026-04-15-hostile-audit/results/hex-guard-check.json`
- `reports/2026-04-15-hostile-audit/results/metadata-timeout-check.json`
- `reports/2026-04-15-hostile-audit/results/matrix-hardening-check.json`
- `reports/2026-04-15-hostile-audit/results/compatibility-parse-guard.json`
- `reports/2026-04-15-hostile-audit/results/mutation-checks-after-hardening.json`

## Source files changed
- `src/util.ts`
- `src/polkadot-factory.ts`
- `src/submit-strategy.ts`
- `src/chain-canary.ts`
- `src/compatibility.ts`
- `src/matrix-runner.ts`
- `src/types.ts`

## Tests changed
- `test/util.test.ts`
- `test/submit-strategy.test.ts`
- `test/compatibility.test.ts`
- `test/prepare-hook-and-matrix.test.ts`

## Local commands used in this hardening tranche
- `node --experimental-strip-types reports/2026-04-15-hostile-audit/harness/run-existing-tests.mjs`
- `node --experimental-strip-types reports/2026-04-15-hostile-audit/harness/hex-guard-check.mjs`
- `node --experimental-strip-types reports/2026-04-15-hostile-audit/harness/metadata-timeout-check.mjs`
- `AUDIT_SECRET=should-not-leak node --experimental-strip-types reports/2026-04-15-hostile-audit/harness/matrix-hardening-check.mjs`
- `node --experimental-strip-types reports/2026-04-15-hostile-audit/harness/compatibility-parse-guard.mjs`
- mutation rechecks recorded in `results/mutation-checks-after-hardening.json`

## Release-boundary note
- No keychain access was used.
- No npm publish, GitHub release, or any other external release action was performed.
- That restraint was intentional because the original authorized hostile-audit boundary prohibited third-party endpoints and real external systems.
