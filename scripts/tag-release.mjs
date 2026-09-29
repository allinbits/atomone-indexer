#!/usr/bin/env node

// Tags the current version as vX.Y.Z and extracts its changelog section.
//
// Changesets would tag `@eclesia/atomone-indexer@X.Y.Z`, because the presence
// of pnpm-workspace.yaml makes it treat this repo as a workspace, and the pnpm
// settings in that file have to stay there: pnpm 12 ignores the `pnpm` field in
// package.json. This repo's tags and container images have always been vX.Y.Z,
// so tagging happens here instead.
//
// Idempotent: if the tag already exists it reports nothing to do, which is the
// case on every push to main that is not a release.

import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

const setOutput = (key, value) => {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
};

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const tag = `v${version}`;

const tagExists = () => {
  try {
    git("rev-parse", "-q", "--verify", `refs/tags/${tag}`);
    return true;
  }
  catch {
    return false;
  }
};

if (tagExists()) {
  console.log(`${tag} already exists, nothing to release`);
  setOutput("released", "false");
  process.exit(0);
}

// This version's section, up to the next heading of the same level.
const changelog = readFileSync("CHANGELOG.md", "utf8");
const heading = new RegExp(`^## ${version.replace(/\./g, "\\.")}$([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, "m");
const section = changelog.match(heading);
const notes = section ? section[1].trim() : `Release ${tag}`;

git("tag", "-a", tag, "-m", tag);
git("push", "origin", tag);
writeFileSync("RELEASE_NOTES.md", `${notes}\n`);

console.log(`Tagged ${tag} and wrote RELEASE_NOTES.md`);
setOutput("released", "true");
setOutput("version", version);
setOutput("tag", tag);
