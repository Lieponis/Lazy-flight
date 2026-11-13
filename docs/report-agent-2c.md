# Agent 2 report, stage N1: world seed and globally unique names

**Status: BUILT. All universe tests pass here. Pushed to branch `universe-names`, not `main`**, because I could not run the real `npm run check` (no npm here) nor the 6 test files that need Three.js. Actions on the branch is the real check.

## 1. What was built (only `src/universe`, `src/debug.ts`, `debug.html`, tests, docs)
- `WORLD_SEED = 12345` exported from `src/universe` (settings.ts), documented as not to be changed.
- **System name** = word + code, e.g. `Kopipex 2N-83`. Code (`syscode.ts`): one-to-one with the id (sx, sy, sz, index; negative and huge values fine). Alphabet of 17 symbols `23456789DHJMNPRTV` (no vowels, no 0/O/1/I/L). `encodeSystemCode`, `decodeSystemCode`, `systemCodeOfId`, `normalizeSystemCode`. Every system has a code (also pure ones).
- **Pure names**: 4,200 curated names (60 adjectives x 60 nouns, e.g. "Lazy Harbour", plus 600 coined one-word names like "Kopilon", from the old word lists). Rule: each name hashes (seed, name, try number) to a slot in the cube of sectors -19..18 (about 190 ly); the first slot holding a real, unclaimed system is its one owner. A system has a pure name only if it owns one. Lists are in `data/purenames.ts` (Andy-editable). Table built per seed in about 20 ms.
- **Planets**: `"<system name> II"`. Old nickname is now the optional `nickname` field (about 1 planet in 4 has one).
- **Docks**: short `name` unique inside the system (later dock re-rolls from a new stream "dockname" if clashing), plus `fullName` = `"<short>, <planet name>"`, e.g. `Lonely Basin Outpost, Kopipex 2N-83 II`.
- `findSystemByName(seed, text)`: full name, code only (any capitals, hyphen optional), or pure name.
- `nameStats(...)` helper; `/debug.html` shows code, pure vs word+code, full dock names, a search box and a statistics table (section 5).
- Tests: new `tests/universe-names.test.ts` (26 tests); planetlook fingerprint now ignores names.

## 2. Proof that only names changed
- I dumped everything except names (ids, positions, stars, planet types/sizes/colours/orbits, dock ids/kinds/goods/prices, markets, job boards without blurbs) for 5 seeds within 30 ly from the OLD main (commit 8ad4fb5): 9,580,728 bytes. The new code gives exactly the same bytes (`cmp` identical).
- `tests/planetlook.test.ts`: fingerprint now cuts names out. New values `12345 dca87fd6:104508`, `777 523c0b9d:133025`, `4242 fcec8a42:48518` were computed on the OLD code and the new code gives the same (I ran that test body separately; the file itself needs Three.js).
- Job blurbs print dock short names; 11 of 3,260 blurb lines in the sample differ because 3 docks got re-rolled short names (clash fix). Nothing else in jobs changed.

## 3. Numbers (seed 12345; 777 and 4242 are within 0.1 %)
- **Pure share** within 150 ly: 6.9 % (1,063 of 15,388 systems; 1,071 / 15,484 and 1,075 / 15,623 for the other seeds). Beyond about 190 ly there are NO pure names (all word + code). Higher or lower share: change the list size or `PURE_NAME_REGION`.
- **Code length (symbols, hyphen not counted)**: 10 ly 4; 100 ly 5; 300 ly 5; 600 ly 6; 1,000 ly 7; 10,000 ly 9; 1 million ly 14; 1 billion ly 21. Within 150 ly: 99.9 % have 4. Within 300 ly: 4 or 5. The brief aimed for 4 to 6 within about 1,000 ly: I get 6 up to about 640 ly and 7 up to 1,000 ly (the bit-mixing wastes some room). A tighter packing is possible if wanted (suggestion).
- **Name length** within 150 ly: systems 4 to 24 letters (most 12 to 15); longest planet 29; longest dock full name 55. Limits (tested, up to 1 billion ly): system 42, planet 47, dock full name 75 (`MAX_*_NAME_LENGTH` in settings.ts).
- **Collisions**: 0 in the scan of all systems within 150 ly and all planets/docks within 80 ly, for 3 seeds; also 0 for 12 other seeds and 2 text seeds.

## 4. How Andy checks (after the branch is green on Actions and merged)
`/debug.html` (add `?seed=12345`): first row is `Kopipex 2N-83`; the Name kind column shows "word + code" and some "pure name"; planets read `Kopipex 2N-83 II`; docks show full names; type `7H-HH` or `Lazy Harbour` in the search box and press Find; collisions row says 0. `/planets.html` and the star map must look the same except for the names.

## 5. Known issues / not verified
- No real `npm run check` here. Type-check (strict, `src/universe` + `src/debug.ts`) is clean; every test file that does not need Three.js ran with a stand-in runner. Failures there: `audio` (1), `release` (2), `save-transfer` (1), all identical on the old main, so not caused by this work. Could not run: `assets`, `earthlike`, `floatpick`, `lens`, `planetlook` (rest of file), `title`; `audio-session` needs a stand-in feature. The debug page was checked in a real headless browser (no errors).
- Names are longer now: UI, cockpit canvases and phone cards must fit them (N3).
- Job blurbs and the UI use the dock short `name`, which can repeat in different systems; the UI should show `fullName` where it must be unambiguous (suggestion for N3).
- Saves keep working: they store ids, not names. Seeds other than 12345 still generate valid names, only the seed lock (N2) is Agent 4's.

## 6. Notes for the next agents
- N2 (Agent 4): `WORLD_SEED` is exported from `src/universe`. `Dock.fullName`, `StarSystem.code/baseName/isPure`, `Planet.nickname?` are new.
- N3 (Agents 5/3): worst names: 24 letters (system), 47 (planet), 75 (dock full) at any distance up to a billion ly; typical 12 to 27.
