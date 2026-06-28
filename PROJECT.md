# Project: Japanese Resume Redesign

## Architecture
This project consists of two parallel tracks:
1. **E2E Testing Track**: Creates an independent, requirement-driven, opaque-box test suite to verify resume compilation and formatting rules (page counts, typography, content accuracy).
2. **Implementation Track**: Redesigns the 4 LaTeX templates from scratch in `/Users/mfuad16/Documents/Resume/ja/`, compiles them, and fixes any formatting/compilation issues to pass 100% of the test suite.

The 4 Japanese templates to be redesigned are:
- `ja/01_shokumu_modern.tex`: Modern detailed IT/CS resume, up to 2 pages (Gothic font)
- `ja/02_rirekisho_grid.tex`: Standard grid-based Rirekisho, strictly 1 page (Mincho font, photo box)
- `ja/03_deedy_jp.tex`: Japanese adaptation of the Deedy resume, strictly 1 page (Gothic font)
- `ja/04_simple_shokumu.tex`: Simple, clean Shokumukeirekisho, strictly 1 page (Gothic font)

## Milestones
| # | Name | Scope | Dependencies | Status | Conversation ID |
|---|---|---|---|---|---|
| 1 | E2E Test Suite Design | Create E2E test suite (`TEST_INFRA.md`, `TEST_READY.md`, verification script) | None | DONE | 89acb4e9-49c1-46e2-a8ee-b319769be7b9 |
| 2 | Redesign 01_shokumu_modern | Modern detailed IT/CS resume (Gothic, strictly 2 pages) | M1 | DONE | ae40920c-3afa-43ac-bfd9-c9279248b274 |
| 3 | Redesign 02_rirekisho_grid | Standard grid-based Rirekisho (Mincho, strictly 1 page, photo box) | M1 | DONE | ae40920c-3afa-43ac-bfd9-c9279248b274 |
| 4 | Redesign 03_deedy_jp | Japanese Deedy CV (Gothic, strictly 1 page) | M1 | DONE | ae40920c-3afa-43ac-bfd9-c9279248b274 |
| 5 | Redesign 04_simple_shokumu | Simple Shokumukeirekisho (Gothic, strictly 1 page) | M1 | DONE | ae40920c-3afa-43ac-bfd9-c9279248b274 |
| 6 | Final E2E Pass & Hardening | Pass all test cases (Tier 1-4) and run adversarial hardening (Tier 5) | M2, M3, M4, M5 | DONE | ae40920c-3afa-43ac-bfd9-c9279248b274 |

## Code Layout
- `ja/`: Source LaTeX files
- `output/`: Compiled PDF outputs
- `tests/`: E2E test scripts and validation files (created by Testing Track)
- `.agents/`: Coordination and handoff directories for subagents

## Formatting & Language Contracts
1. **No slanted/italic Japanese characters**: Do not use `\textit` or `\itshape` on Japanese texts.
2. **No parenthetical English translations**: Use only proper Japanese names (e.g. `東海大学` instead of `東海大学 (Tokai University)`).
3. **Typography**:
   - `02_rirekisho_grid.tex` uses Mincho (serif) fonts.
   - Others use Gothic (sans-serif) fonts.
4. **Accuracy of Information**:
   - Name: Mohamed Fuad (モハメド フアド / ふりがな: もはめど ふあど)
   - Address: 東京都世田谷区
   - DOB: February 28, 2004
   - Phone: 080-7535-2988
   - Email: mohamed.fuad.jp@gmail.com
   - Education: Tokai University, B.Sc. in ICT (April 2024 – March 2028 Expected)
   - Experiences: Altius Link, Hotel SUI Akasaka, Japan Airlines
   - Projects: Tutor-System, TokaiHub, WebDrop, Codex Account Switcher
