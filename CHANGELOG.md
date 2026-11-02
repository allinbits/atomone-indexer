# @eclesia/atomone-indexer

## 2.3.1

### Patch Changes

- [#24](https://github.com/allinbits/atomone-indexer/pull/24) [`60f9d2a`](https://github.com/allinbits/atomone-indexer/commit/60f9d2a77174e6e88ea1acf8966c361d5850552a) Thanks [@clockworkgr](https://github.com/clockworkgr)! - Index gov messages sent under the `/cosmos.gov.*` type URLs (AtomOne v4) as well as `/atomone.gov.*`. Previously proposals, deposits and votes submitted with the cosmos type URLs (e.g. proposal 22 at height 11070233) were silently skipped.

## 2.3.0

### Minor Changes

- [#19](https://github.com/allinbits/atomone-indexer/pull/19) [`e877149`](https://github.com/allinbits/atomone-indexer/commit/e8771494696d1cef9cc32894e887ea062e81bcc1) Thanks [@clockworkgr](https://github.com/clockworkgr)! - Tag releases, GitHub releases and container images as `vX.Y.Z` again. Changesets names its tags after the package (`@eclesia/atomone-indexer@X.Y.Z`) whenever a `pnpm-workspace.yaml` is present, and this repo needs one because pnpm 12 no longer reads settings from the `pnpm` field in `package.json`, so the tag is now created by `scripts/tag-release.mjs` instead.

## 2.2.3

### Patch Changes

- [#17](https://github.com/allinbits/atomone-indexer/pull/17) [`a43b3bf`](https://github.com/allinbits/atomone-indexer/commit/a43b3bf20e4ae0fd93722e1b20fe159becf3c4a8) Thanks [@clockworkgr](https://github.com/clockworkgr)! - Update Docker setup: bump base images to Node 24, install the pnpm version pinned in `packageManager`, and restrict the published package to `dist`.
