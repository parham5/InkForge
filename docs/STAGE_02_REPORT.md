# Stage 02 — English-first localization and compatibility

Status: **PASS**. Completed from checkpoint `525a188`; no later stage started.

## Changes

- Translated user-facing Russian text throughout the UI, help, dynamic messages, generated content, native errors, and native menus. English remains the interface default.
- Set the handwriting Studio default to lowercase `a`, the phrase workflow to English, the default sample text to an English pangram, and suggested cursive pairs to common English pairs (`th`, `he`, `in`, etc.). English pairs now appear on the Latin lowercase shelf.
- Added one English-only required-character progress indicator for A–Z, a–z, 0–9, and common ASCII punctuation. Other alphabets, math, and drawing symbols remain optional and do not contribute to that progress measure.
- Preserved Cyrillic/Ukrainian/math alphabets, handwriting practice corpora, parser aliases, glyph algorithms, database identifiers, and backup compatibility. Cyrillic remains available for capture and remains intact through migration.
- Added two focused Rust regressions for Latin standalone/connected samples and Latin shaping. Kept the existing layout, themes, animation, and controls.

## Verified results

- `node scripts/audit-english.mjs`: PASS; 137 TS/TSX/CSS files audited, zero unclassified Cyrillic UI text, 197 retained glyph/data/parser references classified. Optional handwriting corpora and glyph sets match checkpoint `525a188`.
- `npm run typecheck`: PASS.
- `npm run test:core`: PASS, 66 passed, 0 failed, 1 pre-existing ignored.
- `npm run test:desk`: PASS, 31 passed, 0 failed.
- `node scripts/stage02-runtime.mjs`: PASS under desktop CSP. Verified English capture default and required-progress bar, optional Cyrillic capture, English connected-practice default, captured `a` persistence, English pangram paragraph rendered to vector ink, offline workflow, TTF/SVG/PNG/InkForge JSON exports, 58 command/help examples, legacy IndexedDB v2→v4 migration, Cyrillic document/sample and desk-photo preservation, old/new backup imports, and zero CSP violations/runtime errors/remote HTTP requests.
- `node scripts/stage02-desk-runtime.mjs`: PASS; all four desk steps, WASM photo analysis, JPG export, sandbox parent-DOM/eval/network restrictions, zero remote HTTP requests.
- Independent WASM font build seeded with the complete English required set: PASS. FontTools parsed `test-results/stage02/InkForgeEnglishValidation.ttf`, confirmed every required English mapping and GSUB/GPOS tables (151 cmap entries).
- Installed executable runtime: PASS; cold offline WebView2 launch/reload, English capture/practice defaults, actual capture, WASM font build, sample persistence, English About attribution, no JS errors or remote calls.
- `node scripts/stage02-checks.mjs`: PASS; all 214 Base manifest entries, English HTML default, storage/backup source guards, and CSP source guard. Base was verified unchanged.
- `git diff --check`: PASS.

## Release artifacts

- `npm run app:build`: PASS. WASM, TypeScript/Vite production frontend, Windows x64 Tauri release, and NSIS bundle succeeded. Persistent logs: `test-results/stage02/final-release-build.stdout.log` and `.stderr.log`.
- Executable: `D:/InkForge/App/target/release/InkForge.exe` (9,736,192 bytes).
- Installer: `D:/InkForge/App/target/release/bundle/nsis/InkForge_1.0.0-alpha.1_x64-setup.exe` (3,270,992 bytes, 3.12 MiB).
- Silent installer exit code: 0. Installed path: `D:/InkForge/Stage02EnglishInstallTest/InkForge.exe` (9,736,192 bytes). NSIS updates the embedded bundle-type value in three executable bytes (`UNK` → `NSS`); remaining bytes are identical. SHA-256: release `5CC0B80BC66B94C07FA4C1296AABAD291BD84F77F8701B7F2DA06CC19F6072DD`, installed `F174483A6182F5163702094C43B3C1A56E67A265141F6D8FF497BB20F12C03BE`.
- Installer SHA-256: `EE087BD6B858C744B3C9B16741E06CDA9DDFA687D13F8655F5708E878818A282`.

## Intentional retained references and limits

Cyrillic/Greek glyph literals, practice corpora, legacy command aliases/tokens, and parser compatibility data remain intentionally present. The classifier records 197 such retained references. No mandatory Russian/Ukrainian/Greek samples remain in the English-first Studio. Signing, publishing, and remote repository operations were not performed.

The isolated native launch uses WebView2 CDP and a disposable profile; it verifies the installed executable and runtime without exercising Windows printer hardware. NSIS emitted no installer error; wasm-pack compiled its pinned wasm-bindgen locally after its prebuilt download was unavailable.

## Stage 02 closeout

Starting checkpoint: `525a188`. Source and regression changes are committed after this report update. `Base/` remains unchanged. Stage 02 is ready to close; do not begin another stage without the owner’s next instruction.
