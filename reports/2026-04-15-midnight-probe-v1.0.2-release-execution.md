# midnight-probe v1.0.2 release execution report

Date: 2026-04-15
Workspace: `/Users/sicarii/work/audits/midnight-probe-20260415T124122Z`
Release target version: `1.0.2`
Git tag: `v1.0.2`

## Summary

Release status: partial-success.

Succeeded:
- local release hardening completed
- package version bumped from `1.0.1` to `1.0.2`
- real dependency install succeeded
- real TypeScript build succeeded
- real Vitest suite passed: 21/21
- npm pack dry-run showed `dist/` is now present in the shipped tarball
- GitHub main branch updated
- Git tag `v1.0.2` pushed
- GitHub release `v1.0.2` created
- release tarball `midnight-probe-1.0.2.tgz` uploaded to GitHub release
- evidence bundle zip created locally

Failed:
- npm publish to registry failed with `E404 Not Found - PUT https://registry.npmjs.org/midnight-probe`

## Exact outcomes

### Build and test
- `npm install` succeeded
- `npm run build` succeeded
- `npm test` succeeded
- `npm audit` after upgrading `vitest` to `4.1.4` reported `0` vulnerabilities

Evidence:
- `reports/2026-04-15-hostile-audit/results/npm-audit-after-vitest-update.json`
- `reports/2026-04-15-hostile-audit/results/npm-pack-dry-run-release-1.0.2.json`

### GitHub release
Repository:
- `https://github.com/AnubisQuantumCipher/midnight-probe`

Release:
- `https://github.com/AnubisQuantumCipher/midnight-probe/releases/tag/v1.0.2`

Release asset uploaded:
- `midnight-probe-1.0.2.tgz`

### Evidence bundle
Local zip:
- `midnight-probe-v1.0.2-evidence-bundle.zip`

SHA-256:
- `8eb4592c2246924df4c58f13774af96801dbc83619aae16220ada058ae5817a5`

Contents:
- all current files under `reports/`
- verified with `unzip -l`

### npm publish failure
Attempted command:
- `npm publish`

Observed failure:
- `E404 Not Found - PUT https://registry.npmjs.org/midnight-probe`
- registry says the resource could not be found or the current auth lacks permission

Important context:
- `npm view midnight-probe version` returned `1.0.1`
- `npm view midnight-probe maintainers --json` returned `sicarii <sic.tau@pm.me>`
- local `.npmrc` contains an auth token entry, but `npm whoami` returned `401 Unauthorized`
- so the current npm auth material on this machine is not sufficient for publish closure

Evidence:
- `reports/2026-04-15-hostile-audit/results/npm-publish-attempt.txt`
- `reports/2026-04-15-hostile-audit/results/npm-publish-dry-run.txt`

## Commands executed

Git/GitHub:
- `git push -u origin release/local-hardening-20260415`
- `git checkout main`
- `git merge --ff-only release/local-hardening-20260415`
- `git push origin main`
- `git tag -a v1.0.2 -m "midnight-probe v1.0.2"`
- `git push origin v1.0.2`
- `gh release create v1.0.2 midnight-probe-1.0.2.tgz --title v1.0.2 --notes-file reports/2026-04-15-v1.0.2-release-notes.md`

Package/build:
- `npm install`
- `npm install --save-dev vitest@4.1.4`
- `npm run build`
- `npm test`
- `npm pack --dry-run --json`
- `npm pack`
- `npm publish --dry-run`
- `npm publish`

Evidence packaging:
- `zip -r midnight-probe-v1.0.2-evidence-bundle.zip reports`
- `unzip -l midnight-probe-v1.0.2-evidence-bundle.zip`
- `shasum -a 256 midnight-probe-v1.0.2-evidence-bundle.zip`

## Strongest honest conclusion

I completed the GitHub side of the release and produced the evidence bundle.

I did not complete npm registry publication because the current npm credentials on this machine were not authorized to publish `midnight-probe@1.0.2`.

So the honest closeout is:
- GitHub release: complete
- release evidence bundle: complete
- npm registry publish: blocked by auth/permission
