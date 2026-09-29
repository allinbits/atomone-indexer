# Contributing to the AtomOne indexer

## Development setup

```bash
pnpm install
pnpm lint
pnpm build
```

`pnpm install` uses the pnpm version pinned in `packageManager`. `pnpm build` type-checks first (`tsc --noEmit`), then bundles with tsdown and copies the SQL files into `dist/`.

## Releasing: Changesets

Versioning and the changelog are driven by [Changesets](https://github.com/changesets/changesets). Don't edit `CHANGELOG.md` or bump the version in `package.json` by hand.

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
2. **When that PR is merged**, the same workflow finds nothing pending, tags the commit `v<version>` and creates the GitHub release of the same name from that version's `CHANGELOG.md` section.
3. It then builds and pushes the container image, tagged both `latest` and `v<version>`.

The tag is pushed by `scripts/tag-release.mjs`, not by `changeset tag`, because changesets names its tags after the package (`@eclesia/atomone-indexer@<version>`) whenever a `pnpm-workspace.yaml` is present — and this repo needs one, since pnpm 12 no longer reads settings from the `pnpm` field in `package.json`. The script is a no-op when the current version is already tagged, so ordinary pushes to `main` release nothing.

The image build belongs to the release workflow on purpose. A tag pushed with `GITHUB_TOKEN` doesn't start a workflow of its own, so a tag-triggered image build would never fire — and having `docker.yml` also trigger on pushes to `main` would build the release commit twice. So the release workflow is the single entry point: it calls `docker.yml` on every push to `main`, tagging the image `latest`, plus `v<version>` when that push released one. `docker.yml` still runs on a manual `v*` tag (tagging that image `v<version>` only, leaving `latest` where it is), and can be dispatched by hand.

### Useful local commands

```bash
# add a changeset interactively
pnpm changeset

# see what is pending and what version it implies
pnpm changeset:status
```
