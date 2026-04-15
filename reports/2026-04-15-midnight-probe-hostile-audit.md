# midnight-probe hostile audit

Repository audited: `https://github.com/AnubisQuantumCipher/midnight-probe`
Audit workspace: `/Users/sicarii/work/audits/midnight-probe-20260415T124122Z`
Commit: `e22097f1963f873057216498de86ce35bf1a5c1d`
Date: 2026-04-15
Authorization boundary: local repo + local hostile fixtures/harnesses only. No live chain, wallets, third-party services, or real targets were touched during adversarial testing.

Supporting evidence and hostile fixtures live under:
- `reports/2026-04-15-hostile-audit/`
- `reports/2026-04-15-hostile-audit/results/`
- `reports/2026-04-15-hostile-audit/harness/`

## 1. Executive verdict

Verdict: partially solid, but overclaimed and operationally unsafe around the matrix runner.

The repo is not pretending to be a prover, and the core diagnostic abstraction is fairly small and readable. That is the good news.

The bad news is that the most marketable feature, the matrix runner, crosses much weaker boundaries than the README suggests. It executes `npm install` lifecycle scripts from the copied contract workspace, inherits the caller environment, copies arbitrary workspace files into temp space, leaves the temp clone on disk, and can report a “selected matrix” even when it only rewrote a tiny subset of the supposed SDK family. That means the strongest differentiator is also the weakest trust boundary.

If you asked me whether `midnight-probe` looks safe to point at an untrusted or only-partially-trusted contract workspace, my answer is no.

## 2. What the program is

From the code itself, `midnight-probe` is a TypeScript CLI/library for Midnight Network diagnostics.

It provides five main behaviors:
- runtime fingerprinting (`probeRuntime`)
- transaction cost/size inspection (`inspectTransaction`)
- transaction validation and optional submission (`validateTransaction`)
- canary replay against a known tx hash (`runChainCanary`)
- compatibility-matrix orchestration over a copied contract workspace (`runCompatibilityMatrix`)

The CLI entrypoint is thin (`bin/cli.ts`), and the real behavior lives in:
- `src/runtime-probe.ts`
- `src/tx-inspector.ts`
- `src/submit-strategy.ts`
- `src/chain-canary.ts`
- `src/matrix-runner.ts`
- `src/prepare-hook.ts`
- `src/compatibility.ts`
- `src/polkadot-factory.ts`

The optional `contracts/MidnightProbeRegistry.compact` contract is documentation/source only in this repo; nothing in the npm package deploys it by default.

## 3. Claimed guarantees

Direct and implied guarantees I extracted from README + code:

Direct claims:
- it fingerprints a live Midnight runtime
- it validates prepared transactions across `External`, `Local`, and `InBlock`
- it can submit through `metadata-extrinsic` or `raw-rpc`
- wallet SDK support is only via a user-provided adapter
- it inspects finalized transaction bytes and computes Midnight cost shape
- the matrix runner clones a contract workspace, pins public Midnight package families, runs a clean user-owned prepare hook, and selects the first passing matrix
- it does not prove circuits, compile contracts, manage keys, or ship ZirOS internals

Implicit claims:
- transaction inspection is faithful to the bytes the user supplied
- matrix results represent a meaningful SDK-family compatibility result
- the matrix workspace copy is isolated enough for safe diagnostics
- compatibility reports are durable enough to trust as evidence artifacts
- passing tests imply at least basic correctness of the public surface

ASVS/WSTG/SSDF/CWE framing applied here:
- ASVS-style requirement grounding says strong words need an explicit evidence layer, not just a green test run
- WSTG says test-family structure matters; here that means static review, negative input checks, local hostile harnesses, and regression artifacts should stay separate
- SSDF says discovery must close with recurrence prevention, not just “found a thing”
- CWE-style naming matters: several failures here are input-validation, unsafe-boundary, and error-handling failures rather than style nits

## 4. What formal verification really covers

Brutal answer: essentially nothing inside this repository.

Exact artifact or property proved:
- none found in this repo

Under what assumptions:
- not applicable; there is no mechanized proof artifact here

Against what model:
- none in-repo

With what exclusions:
- all runtime behavior, dependency behavior, hook execution, npm behavior, RPC behavior, and Midnight chain behavior remain unproved here

Whether the shipped code path is the same path that was proved:
- no proved code path exists in this repo, so this question bottoms out as “not covered”

Whether configuration, build flags, generated code, runtime environment, or external libraries can invalidate the assurance story:
- yes, completely
- this repo depends on `@polkadot/api`, `@midnight-ntwrk/ledger-v8`, Node/V8 semantics, npm behavior, user-owned hook code, and live chain/runtime state
- none of that is formally closed here

Whether there are unproved seams between verified components:
- yes, all of the important seams are unproved because there are no verified components here to begin with
- critical seams include: CLI arg parsing -> hex normalization -> byte decode -> ledger library -> outer extrinsic construction -> validator RPC -> submission strategy -> report persistence

Whether the verification-related claim language is strong, partial, misleading, or overstated:
- the explicit negative claim “it does not prove circuits” is honest and survived review
- any broader trust borrowed from ZirOS/proof language does not transfer to `midnight-probe`
- any reading of the matrix result as “verified compatible SDK family” is overstated; the actual implementation only rewrites dependencies that were already present and can mark success after a partial rewrite

Bottom line:
- this repo is an empirical diagnostic tool, not a formally verified artifact
- if someone tries to market it as proof-carrying or formally verified, that would be false

## 5. Attack surface map

Primary attacker-controlled inputs:
- CLI args (`--network`, `--rpc-url`, `--tx-file`, `--contract`, `--hook`, `--wallet-adapter`, `--out`, `--matrices`, `--strategy`)
- tx hex strings and JSON probe-input files
- contract workspace contents supplied to `--contract`
- prepare hook module contents
- wallet adapter module contents
- existing compatibility-report file contents
- environment variables inherited by the process

Critical trust boundaries:
- local user shell -> `midnight-probe` CLI
- `midnight-probe` -> dynamically imported hook/adapter code (`src/prepare-hook.ts`)
- `midnight-probe` -> copied contract workspace (`src/matrix-runner.ts`)
- matrix runner -> `npm install` lifecycle scripts (`src/matrix-runner.ts:183-185`)
- repo code -> external libraries (`@polkadot/api`, `@midnight-ntwrk/ledger-v8`)
- repo code -> Midnight RPC / runtime when live use is enabled
- report persistence -> future trust decisions (`src/compatibility.ts`)

Trusted computing base (practical, not aspirational):
- Node.js runtime
- V8 / Buffer hex decoding behavior
- npm installer semantics
- `@polkadot/api`
- `@midnight-ntwrk/ledger-v8`
- filesystem semantics for copied workspaces, temp dirs, and dynamic import URLs
- user-owned hook and adapter code
- package-lock integrity if real installs are used

High-risk surfaces:
- matrix runner workspace copy + install + hook execution
- metadata submit path with no timeout
- hex parsing / normalization boundary
- compatibility report read/write error handling

## 6. Adversarial test campaign

I did not stop at source reading. I pushed on the boundaries that matter.

Techniques used:

1. Full repo read + claim extraction
- read every source file, every test file, README, package manifest, lockfile highlights, and optional contract
- built a code-driven claim boundary instead of trusting prose

2. Clean-build attempt under strict local-only boundary
- attempted `npm ci --ignore-scripts --offline && npm run build && npm test`
- result: blocked by missing cached package `why-is-node-running-2.3.0.tgz`
- because the audit boundary excluded fresh third-party fetches, I did not pull from npm registry
- consequence: real dependency build/test evidence is partial; I preserved that gap explicitly

3. Local stubbed execution harness
- created local ESM wrappers and local stub packages so the repo’s TS source and existing tests could be executed without external fetches
- ran the existing 17 tests through a local minimal Vitest-compatible runner
- result: all 17 existing tests passed under local stubs
- artifact: `reports/2026-04-15-hostile-audit/results/existing-tests.json`

4. Hostile negative tests and boundary sweeps
- odd-length hex truncation reproducer
- odd-length hex boundary sweep across multiple lengths
- metadata submit hang reproducer
- malformed compatibility report reproducer
- artifact paths:
  - `results/odd-hex-truncation.json`
  - `results/hex-boundary-sweep.json`
  - `results/metadata-submit-hang.json`
  - `results/compatibility-malformed-report.json`

5. Hostile matrix-workspace fixture
- created a local contract fixture with:
  - a `preinstall` script
  - a secret-like local file
  - a minimal prepare hook
- ran `runCompatibilityMatrix` against it locally
- confirmed lifecycle-script execution, inherited env visibility, secret-file copying, temp-workspace persistence, and “selected matrix” despite only partial package-family rewrite
- artifact: `results/matrix-preinstall-env-leak.json`

6. Mutation-oriented checks
- temporarily mutated the metadata submit path to always fail
- temporarily removed `normalizeHex` validation entirely
- reran the existing tests after each mutation
- both mutations survived: existing tests still passed
- artifact: `results/mutation-checks.json`

7. Static-analysis pass with local custom Semgrep rules
- flagged the `npm install` lifecycle surface and the broad exception swallow in report loading
- artifact: `results/semgrep-results.json`

8. VM/container readiness check
- `vmctl` was not exposed in this shell (`command not found`)
- Docker CLI exists, but no useful local base image for this audit was present beyond `hello-world`, and pulling new images would have crossed the no-third-party-endpoint boundary
- I therefore stayed in the current local sandbox and preserved the tool-readiness gap honestly

Sanitizer/fuzzer note:
- this codebase is TypeScript/Node, so LLVM sanitizer passes were not a realistic in-scope path for the repo code itself
- I still applied the equivalent doctrine: hostile boundary sweeps, reproducible fixtures, deterministic harnesses, and preserved artifacts

## 7. Findings

### Finding 1: Matrix runner executes workspace lifecycle scripts before the declared hook boundary
- Severity: High
- Confidence: High
- Affected files/components:
  - `src/matrix-runner.ts:173-185`
  - `src/prepare-hook.ts`
- How to reproduce:
  1. Run `AUDIT_SECRET=matrix-env-secret node --experimental-strip-types reports/2026-04-15-hostile-audit/harness/matrix-preinstall-env-leak.mjs`
  2. Inspect `reports/2026-04-15-hostile-audit/results/matrix-preinstall-env-leak.json`
  3. Observe that the hostile fixture’s `preinstall` script ran before the prepare hook boundary was meaningful
- Why it matters:
  - the README describes the matrix runner as cloning a workspace, pinning package families, and invoking a clean user-owned prepare hook
  - the actual implementation runs `npm install` without `--ignore-scripts`, so arbitrary package lifecycle code in the copied workspace executes first
  - the runner also passes inherited environment variables into that install process
- Whether it breaks a claimed guarantee:
  - yes
  - it breaks the practical meaning of “clean user-owned prepare hook” as the primary execution boundary
  - it makes the matrix runner unsafe against untrusted workspaces

### Finding 2: Matrix runner copies sensitive files into temp space and leaves the clone behind
- Severity: Medium
- Confidence: High
- Affected files/components:
  - `src/matrix-runner.ts:127-151`
  - `src/matrix-runner.ts:264-266`
- How to reproduce:
  1. Run the hostile matrix harness above
  2. Inspect `workspaceDir` and `copiedSensitive` in `results/matrix-preinstall-env-leak.json`
  3. Observe that `sensitive.txt` was copied into the temp clone and the temp workspace still existed after completion
- Why it matters:
  - the matrix runner copies the whole workspace except a few ignored paths (`node_modules`, `dist`, `.git`)
  - secret files, config fragments, and local data are retained in temp storage instead of being minimized or cleaned up
  - this weakens confidentiality and leaves forensic residue users may not expect from a diagnostic tool
- Whether it breaks a claimed guarantee:
  - partially
  - it contradicts the intuition of an isolated/ephemeral diagnostic workspace

### Finding 3: Matrix selection can succeed after only a partial SDK-family rewrite
- Severity: Medium
- Confidence: High
- Affected files/components:
  - `src/matrix-runner.ts:100-124`
  - `src/matrix-runner.ts:207-220`
- How to reproduce:
  1. Run `AUDIT_SECRET=matrix-env-secret node --experimental-strip-types reports/2026-04-15-hostile-audit/harness/matrix-preinstall-env-leak.mjs`
  2. Inspect `packageVersionsApplied` in `results/matrix-preinstall-env-leak.json`
  3. Observe that the selected matrix was `v4-stable` even though the hostile fixture only had one relevant package rewritten: `@midnight-ntwrk/ledger-v8`
- Why it matters:
  - the README frames matrix selection as testing public Midnight SDK version families
  - the implementation only rewrites packages that already exist in the contract workspace
  - therefore “selected matrix” can mean “the one package that happened to be present did not explode,” not “the SDK family is actually aligned and working”
- Whether it breaks a claimed guarantee:
  - yes, at the claim-language level
  - the family-wide compatibility wording is overstated

### Finding 4: Metadata-extrinsic submission path can hang indefinitely
- Severity: Medium
- Confidence: High
- Affected files/components:
  - `src/submit-strategy.ts:28-56`
  - same bug pattern repeats in `src/chain-canary.ts:56-99`
- How to reproduce:
  1. Run `node --experimental-strip-types reports/2026-04-15-hostile-audit/harness/metadata-submit-hang.mjs`
  2. Inspect `results/metadata-submit-hang.json`
  3. Observe `{ "settled": false, "timeoutMs": 300 }`
- Why it matters:
  - the Promise only resolves on `isInvalid`, `isInBlock`, or `isFinalized`
  - if the callback never emits those terminal states, the diagnostic operation can hang forever
  - a tool meant to diagnose chain drift should not itself become an unbounded wait surface
- Whether it breaks a claimed guarantee:
  - yes, it weakens the practical reliability of `test-deploy` / `test-call` / canary duplicate submission

### Finding 5: Odd-length hex is accepted and silently truncated
- Severity: Medium
- Confidence: High
- Affected files/components:
  - `src/util.ts:103-109`
  - `src/tx-inspector.ts:55-79`
- How to reproduce:
  1. Run `node --experimental-strip-types reports/2026-04-15-hostile-audit/harness/odd-hex-truncation.mjs`
  2. Run `node --experimental-strip-types reports/2026-04-15-hostile-audit/harness/hex-boundary-sweep.mjs`
  3. Inspect `results/odd-hex-truncation.json` and `results/hex-boundary-sweep.json`
- Why it matters:
  - `normalizeHex` checks “hex characters only” but does not require an even nibble count
  - `Buffer.from(hex, 'hex')` truncates odd-length inputs toward floor(n/2)
  - the tool can therefore inspect bytes that are not actually the bytes the user typed
  - in a diagnostic tool, silent input mutation is a correctness failure, not a cosmetic bug
- Whether it breaks a claimed guarantee:
  - yes
  - it undermines faithful transaction inspection and cost reporting for malformed inputs

### Finding 6: Malformed compatibility reports are silently treated as missing
- Severity: Low
- Confidence: High
- Affected files/components:
  - `src/compatibility.ts:17-25`
- How to reproduce:
  1. Run `node --experimental-strip-types reports/2026-04-15-hostile-audit/harness/compatibility-malformed-report.mjs`
  2. Inspect `results/compatibility-malformed-report.json`
  3. Observe `parsedResult: null`
- Why it matters:
  - `readCompatibilityReport` swallows every exception and returns `null`
  - malformed JSON, permission issues, and unexpected read failures all collapse into “no report”
  - this is an evidence-preservation bug: the next write can silently overwrite a corrupted-but-important artifact instead of surfacing the error
- Whether it breaks a claimed guarantee:
  - partially
  - it weakens the durability/trustworthiness of report artifacts

### Finding 7: Existing tests miss critical input-validation and metadata-submit failures
- Severity: Low
- Confidence: High
- Affected files/components:
  - `test/*.ts`
  - especially missing coverage around `normalizeHex` and metadata submission
- How to reproduce:
  1. Inspect `reports/2026-04-15-hostile-audit/results/mutation-checks.json`
  2. Note that two deliberately broken mutants survived with exit code `0`:
     - metadata-extrinsic submit path forced to error
     - `normalizeHex` validation removed entirely
- Why it matters:
  - green tests are currently too easy to satisfy
  - they do not cover the most security-relevant parser/input and metadata-submission failure boundaries
- Whether it breaks a claimed guarantee:
  - it breaks any implied claim that the current tests are a strong correctness backstop

## 8. Failed claims

These claims did not survive hostile challenge as stated:

1. “The matrix runner clones a contract workspace, pins public Midnight package families, invokes a clean user-owned prepare hook, and selects the first passing matrix.”
- Failed / overstated
- actual behavior executes `npm install` lifecycle code before the hook boundary matters, rewrites only already-present dependency names, and can still report a selected matrix

2. “This command tests SDK families against the live network and returns the first working combination.”
- Partial at best
- the implementation can call a matrix “selected” even when only a small subset of the family was present and rewritten

3. The existing passing tests imply strong boundary coverage
- Failed
- mutation survivors show they do not meaningfully protect metadata submission or hex validation boundaries

## 9. Surviving claims

Claims that did survive serious challenge:

1. This repo does not contain formal proving logic for circuits
- confirmed by source inspection
- there is no in-repo mechanized proof artifact to overclaim

2. Wallet support is adapter-based rather than bundled
- confirmed by `src/submit-strategy.ts` and `src/prepare-hook.ts`
- the package does not ship a wallet SDK dependency of its own for submission

3. The repo really is a diagnostic/orchestration layer rather than a full deployment system
- confirmed by code structure and README boundaries
- it fingerprints, validates, inspects, and orchestrates; it does not itself implement a closed proof/deploy pipeline

4. Unsupported signed extensions are rejected on the core builder path
- `buildMidnightOuterTx` calls `assertSupportedMidnightSignedExtensions`
- this boundary looked better than I expected and prevented a weaker false-positive canary scenario I initially tried to induce

## 10. Most dangerous blind spots

The places that still feel risky even without a full exploit chain:

1. Untrusted workspace execution model
- the matrix runner is too trusting of the contract workspace as code, as package metadata, and as ambient environment consumer

2. Overclaim risk around “selected matrix”
- the reported success signal is stronger than the actual evidence generated

3. Thin negative-input coverage
- malformed hex, malformed report state, and nonterminal submission states were not defended well

4. Dependency/runtime gap
- because clean real-dependency execution was blocked under the no-third-party-fetch boundary, there is still an evidence gap around real `@polkadot/api` and real `@midnight-ntwrk/ledger-v8` behavior in this audit run
- that is not a free pass for the code; it is an honest remaining boundary

5. Dynamic import surfaces
- hook and wallet adapter loading are intentionally dynamic, which is fine for owned code, but dangerous if operators start treating this tool as safe against arbitrary repos

## 11. Final judgment

If I were trying to trust `midnight-probe` in a serious environment, what would still worry me?

The matrix runner.

That is the part I would not trust against an untrusted or semi-trusted workspace. It is too easy to read the README and think “diagnostic clone + clean hook + matrix selection.” The actual behavior is much looser: package lifecycle code runs, ambient environment is inherited, local files are copied more broadly than necessary, temp artifacts remain, and success can be declared after only partial dependency-family alignment.

So my bottom line is:
- as a small local diagnostic library, parts of it are reasonable
- as a boundary-safe compatibility oracle, it is not solid yet
- as a formally verified or proof-backed artifact, it is not that at all
- as a tool to point at untrusted workspaces, it is currently fragile and unsafe

## Evidence artifacts

Primary result files:
- `reports/2026-04-15-hostile-audit/results/existing-tests.json`
- `reports/2026-04-15-hostile-audit/results/odd-hex-truncation.json`
- `reports/2026-04-15-hostile-audit/results/hex-boundary-sweep.json`
- `reports/2026-04-15-hostile-audit/results/metadata-submit-hang.json`
- `reports/2026-04-15-hostile-audit/results/matrix-preinstall-env-leak.json`
- `reports/2026-04-15-hostile-audit/results/compatibility-malformed-report.json`
- `reports/2026-04-15-hostile-audit/results/mutation-checks.json`
- `reports/2026-04-15-hostile-audit/results/semgrep-results.json`

Clean-build note:
- real `npm ci --ignore-scripts --offline` failed because the local npm cache did not contain `why-is-node-running-2.3.0.tgz`
- that blocker was preserved instead of bypassed with a live third-party fetch
