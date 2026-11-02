---
"@eclesia/atomone-indexer": patch
---

Index gov messages sent under the `/cosmos.gov.*` type URLs (AtomOne v4) as well as `/atomone.gov.*`. Previously proposals, deposits and votes submitted with the cosmos type URLs (e.g. proposal 22 at height 11070233) were silently skipped.
