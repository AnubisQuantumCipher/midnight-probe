# midnight-probe v1.0.2 release execution report

Date: 2026-04-15
Workspace: `/Users/sicarii/work/audits/midnight-probe-20260415T124122Z`
Release target version: `1.0.2`
Git tag: `v1.0.2`
Repository: `https://github.com/AnubisQuantumCipher/midnight-probe`

## Summary

Release status: success.

Succeeded:
- local hardening tranche completed
- package version bumped from `1.0.1` to `1.0.2`
- real dependency install succeeded
- real TypeScript build succeeded
- real Vitest suite passed: 21/21
- npm pack dry-run confirmed `dist/` ships in the tarball
- dev-tooling audit cleaned to `0` vulnerabilities after updating `vitest` to `4.1.4`
- GitHub main branch updated
- Git tag `v1.0.2` pushed
- GitHub release `v1.0.2` created
- release tarball `midnight-probe-1.0.2.tgz` uploaded to GitHub release
- npm package `midnight-probe@1.0.2` published successfully
- npm `latest` dist-tag now points to `1.0.2`
- evidence bundle zip created and uploaded to the GitHub release

## Exact outcomes

### Build and test
Commands succeeded:
- `npm install`
- `npm install --save-dev vitest@4.1.4`
- `npm run build`
- `npm test`
- `npm audit --json`
- `npm pack --dry-run --json`

Observed results:
- tests passed: `21/21`
- audit vulnerabilities after update: `0`
- tarball now includes `dist/` and package entrypoints required for a usable npm release

Evidence:
- `reports/2026-04-15-hostile-audit/results/npm-audit-after-vitest-update.json`
- `reports/2026-04-15-hostile-audit/results/npm-pack-dry-run-release-1.0.2.json`

### GitHub release
Release page:
- `https://github.com/AnubisQuantumCipher/midnight-probe/releases/tag/v1.0.2`

Release assets:
- `https://github.com/AnubisQuantumCipher/midnight-probe/releases/download/v1.0.2/midnight-probe-1.0.2.tgz`
- `https://github.com/AnubisQuantumCipher/midnight-probe/releases/download/v1.0.2/midnight-probe-v1.0.2-evidence-bundle.zip`

### npm publication
Observed successful publish:
- `npm publish` returned `+ midnight-probe@1.0.2`

Registry verification after publish:
- `npm view midnight-probe version maintainers --json` returned version `1.0.2`
- `npm dist-tag ls midnight-probe` returned `latest: 1.0.2`

Evidence:
- `reports/2026-04-15-hostile-audit/results/npm-publish-attempt-with-valid-token.txt`
- `reports/2026-04-15-hostile-audit/results/npm-view-after-publish.json`
- `reports/2026-04-15-hostile-audit/results/npm-dist-tags.txt`

### Evidence bundle
Local bundle filename:
- `midnight-probe-v1.0.2-evidence-bundle.zip`

GitHub release asset:
- `https://github.com/AnubisQuantumCipher/midnight-probe/releases/download/v1.0.2/midnight-probe-v1.0.2-evidence-bundle.zip`

Bundle contract:
- contains the current `reports/` tree from this release session
- includes hostile-audit, hardening, release, and npm publication evidence
- current final SHA-256: `517d63838d66d6c3b6add5b9a23c02d3c75fc43d31050bbfe99c0bd783ffcc77`
- current final bundle contains `50` archived entries

## Commands executed

Git/GitHub:
- `git push -u origin release/local-hardening-20260415`
- `git checkout main`
- `git merge --ff-only release/local-hardening-20260415`
- `git push origin main`
- `git tag -a v1.0.2 -m "midnight-probe v1.0.2"`
- `git push origin v1.0.2`
- `gh release create v1.0.2 midnight-probe-1.0.2.tgz --title v1.0.2 --notes-file reports/2026-04-15-v1.0.2-release-notes.md`
- `gh release edit v1.0.2 --notes-file reports/2026-04-15-v1.0.2-release-notes.md`
- `gh release upload v1.0.2 midnight-probe-v1.0.2-evidence-bundle.zip --clobber`

Package/build:
- `npm install`
- `npm install --save-dev vitest@4.1.4`
- `npm run build`
- `npm test`
- `npm pack --dry-run --json`
- `npm pack`
- `npm publish --dry-run`
- `npm publish`
- `npm view midnight-probe version maintainers --json`
- `npm dist-tag ls midnight-probe`

Evidence packaging:
- `zip -r midnight-probe-v1.0.2-evidence-bundle.zip reports`
- `unzip -l midnight-probe-v1.0.2-evidence-bundle.zip`
- `shasum -a 256 midnight-probe-v1.0.2-evidence-bundle.zip`

## Strongest honest conclusion

The v1.0.2 release is now fully executed across both GitHub and npm.

Release closure achieved:
- GitHub release: complete
- npm registry publication: complete
- evidence bundle: complete
