# Evidence index

Audit repo: `/Users/sicarii/work/audits/midnight-probe-20260415T124122Z`
Report: `reports/2026-04-15-midnight-probe-hostile-audit.md`

## Commands run

Clone and baseline inventory:
- `git clone --depth 1 https://github.com/AnubisQuantumCipher/midnight-probe.git /Users/sicarii/work/audits/midnight-probe-20260415T124122Z`
- `date -u +'%Y-%m-%dT%H:%M:%SZ %Z'`
- `uname -a && sw_vers && rustc --version && cargo --version && node --version && npm --version && python3 --version && clang --version | head -n 1 && llvm-symbolizer --version | head -n 1 && afl-fuzz -V 2>&1 | head -n 3 && codeql version`
- `git log --oneline --decorate -n 20`

Clean-build attempt under local-only boundary:
- `rm -rf node_modules dist coverage .vitest`
- `npm ci --ignore-scripts --offline`
- `npm run build`
- `npm test`

Result:
- offline build blocked because npm cache did not contain `why-is-node-running-2.3.0.tgz`

Static analysis / inventory:
- custom `search_files` sweeps over README, source, tests, package manifests, lockfile
- `semgrep --config reports/2026-04-15-hostile-audit/harness/semgrep-rules.yml --json src > reports/2026-04-15-hostile-audit/results/semgrep-results.json`

Stubbed local execution harness:
- `node --experimental-strip-types reports/2026-04-15-hostile-audit/harness/run-existing-tests.mjs`

Hostile harnesses:
- `node --experimental-strip-types reports/2026-04-15-hostile-audit/harness/odd-hex-truncation.mjs`
- `node --experimental-strip-types reports/2026-04-15-hostile-audit/harness/hex-boundary-sweep.mjs`
- `node --experimental-strip-types reports/2026-04-15-hostile-audit/harness/metadata-submit-hang.mjs`
- `AUDIT_SECRET=matrix-env-secret node --experimental-strip-types reports/2026-04-15-hostile-audit/harness/matrix-preinstall-env-leak.mjs`
- `node --experimental-strip-types reports/2026-04-15-hostile-audit/harness/compatibility-malformed-report.mjs > reports/2026-04-15-hostile-audit/results/compatibility-malformed-report.json`

Mutation-oriented checks:
- temporary mutation of `src/submit-strategy.ts` metadata-extrinsic branch -> reran existing tests
- temporary mutation of `src/util.ts` hex validation -> reran existing tests
- both mutants survived

VM / container readiness:
- `command -v vmctl && vmctl --help | head -n 40`
- `vmctl list 2>&1 | head -n 60`
- `vmctl ctr --help | head -n 80`
- `docker --version`
- `docker info 2>&1 | head -n 40`
- `docker images --format '{{.Repository}}:{{.Tag}}' | head -n 40`
- `colima status 2>&1 | head -n 40`

Result:
- `vmctl` not present in this shell
- Docker CLI present, but no useful local image was available for a stricter rerun without crossing the no-third-party-fetch boundary

## Generated artifacts

Harnesses:
- `reports/2026-04-15-hostile-audit/harness/run-existing-tests.mjs`
- `reports/2026-04-15-hostile-audit/harness/odd-hex-truncation.mjs`
- `reports/2026-04-15-hostile-audit/harness/hex-boundary-sweep.mjs`
- `reports/2026-04-15-hostile-audit/harness/metadata-submit-hang.mjs`
- `reports/2026-04-15-hostile-audit/harness/matrix-preinstall-env-leak.mjs`
- `reports/2026-04-15-hostile-audit/harness/compatibility-malformed-report.mjs`
- `reports/2026-04-15-hostile-audit/harness/semgrep-rules.yml`

Results:
- `reports/2026-04-15-hostile-audit/results/existing-tests.json`
- `reports/2026-04-15-hostile-audit/results/odd-hex-truncation.json`
- `reports/2026-04-15-hostile-audit/results/hex-boundary-sweep.json`
- `reports/2026-04-15-hostile-audit/results/metadata-submit-hang.json`
- `reports/2026-04-15-hostile-audit/results/matrix-preinstall-env-leak.json`
- `reports/2026-04-15-hostile-audit/results/compatibility-malformed-report.json`
- `reports/2026-04-15-hostile-audit/results/mutation-checks.json`
- `reports/2026-04-15-hostile-audit/results/semgrep-results.json`

## Scope notes

- No live Midnight RPC, wallet, proof server, or third-party target was touched.
- No fresh npm or Docker image pull was performed.
- All adversarial behavior stayed inside the repo, local stubs, and local hostile fixtures.
