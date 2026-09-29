---
"@eclesia/atomone-indexer": minor
---

Tag releases, GitHub releases and container images as `vX.Y.Z` again. Changesets names its tags after the package (`@eclesia/atomone-indexer@X.Y.Z`) whenever a `pnpm-workspace.yaml` is present, and this repo needs one because pnpm 12 no longer reads settings from the `pnpm` field in `package.json`, so the tag is now created by `scripts/tag-release.mjs` instead.
