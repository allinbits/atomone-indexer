# Contributing to the AtomOne indexer

## Development setup

```bash
pnpm install
pnpm lint
pnpm build
```

`pnpm install` uses the pnpm version pinned in `packageManager`. `pnpm build` type-checks first (`tsc --noEmit`), then bundles with tsdown and copies the SQL files into `dist/`.

## Releasing: Changesets

Versioning, the changelog and the release tag are driven by [Changesets](https://github.com/changesets/changesets). Don't edit `CHANGELOG.md` or bump the version in `package.json` by hand.

This package is **not published to npm** — it ships as a container image on ghcr.io — so the release step tags the commit rather than publishing a package.

### Adding a changeset to your PR

Any PR that changes what the indexer does should carry one. PRs that only touch CI or contributor docs don't need one.

```bash
pnpm changeset
```

Pick the bump, describe the change, and commit the file it writes under `.changeset/`.

### How a release happens

The `Release` workflow runs on every push to `main`:

1. **With changesets pending**, it opens or updates a **"chore: version packages"** PR that consumes them, bumps the version and writes `CHANGELOG.md`.
2. **When that PR is merged**, the same workflow finds nothing pending, tags the commit (`@eclesia/atomone-indexer@<version>`) and creates the GitHub release.
3. It then builds and pushes the container image, tagged both `latest` and with the released version.

That last step is part of the release workflow on purpose: a tag pushed with `GITHUB_TOKEN` doesn't start a workflow of its own, so a tag-triggered image build would never fire. `docker.yml` still builds on pushes to `main` and on manual `v*` tags as before.

### Useful local commands

```bash
# add a changeset interactively
pnpm changeset

# see what is pending and what version it implies
pnpm changeset:status
```
