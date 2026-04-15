# Local release readiness note

Date: 2026-04-15
Workspace: `/Users/sicarii/work/audits/midnight-probe-20260415T124122Z`
Branch: `release/local-hardening-20260415`

## Current local release judgment

Not release-closed.

Reason 1:
- the hardened source and regression artifacts are in good shape locally
- but the real dependency build path was still blocked earlier by the no-third-party-fetch boundary and the missing offline npm cache entry for `why-is-node-running-2.3.0.tgz`

Reason 2:
- local `npm pack --dry-run --json` shows the package tarball would currently contain only:
  - `LICENSE`
  - `README.md`
  - `contracts/MidnightProbeRegistry.compact`
  - `package.json`
- it does not include `dist/`
- because `package.json` publishes `dist` and the checkout does not currently have a built `dist`, a real npm release from this state would ship an effectively unusable package

Evidence:
- `reports/2026-04-15-hostile-audit/results/npm-pack-dry-run.json`

## Honest next requirement before any real publish

A real release requires all of the following:
- explicit authorization to touch third-party endpoints
- successful real dependency install/build/test with upstream packages
- verified `dist/` contents present in the pack output
- then only after that: npm/GitHub publish steps
