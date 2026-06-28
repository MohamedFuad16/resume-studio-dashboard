# Test Infrastructure: Resume Editor E2E Testing

This document describes the design, configuration, and execution structure of the E2E test suite for the Resume Editor Web Application.

## Playwright Runner & Configuration

We utilize **Playwright Test** as the core runner for our E2E tests. The runner has been configured to target Chrome via Chromium to check frontend layouts, forms, and backend integrations.

The configuration file is located at `playwright.config.ts` and includes:
- **Test Directory**: `./tests/e2e`
- **Parallelism**: Runs tests in parallel (`fullyParallel: true`)
- **CI Tuning**: Auto-configured retries (2 in CI, 0 locally) and worker counts (1 in CI, system default locally)
- **Base URL**: `http://localhost:5173` (matching the default Vite dev server)
- **Web Server Integration**: Automates starting the server via `npm run dev` and waiting for port 5173 to be responsive before launching the test runs.
- **Artifacts**: Saves traces on first retry and takes screenshots on failure for easier debugging.

## Feature Inventory (R1-R5)

The test suite validates five core functional components:
1. **F1: Form Editor UI + List Operations**: Validates personal information inputs and full CRUD (Create, Read, Update, Delete) + reordering capabilities for lists (Education, Experience, Projects, Skills).
2. **F2: Template & Language Selection**: Validates template picker state transitions for English (Jake's Clean, etc.) and Japanese (Shokumu Modern, Rirekisho Grid, Deedy JP, Simple Shokumu) layouts, language switching logic, active styling, and UI translation localization.
3. **F3: Backend Auto-save & Compile**: Checks that inputs trigger debounced save payloads to `resume.json` on blur and keystroke debounce, triggers tectonic compilation on change, and handles compile failures.
4. **F4: Live Preview & Compile Indicator**: Checks loading states, compilation progress indicator styles/colors, iframe preview updates, and auto-compile toggle logic.
5. **F5: Export Downloads**: Validates download trigger events and payload contents for PDF (`%PDF-`), LaTeX (`\documentclass`), and JSON export formats.

## 4-Tier Test Case Structure

To ensure thorough coverage under all conditions, the tests are organized into four distinct tiers:

### Tier 1: Feature Coverage (25 tests)
- **F1 (5 tests)**: Personal info edit, education CRUD, experience CRUD, projects & skills CRUD, list reordering.
- **F2 (5 tests)**: EN templates selection, JP templates selection, language switcher state, active template selection styling, UI localized labels.
- **F3 (5 tests)**: Auto-save on blur, auto-save debounce delay, compile trigger on change, resume.json payload verification, compile error handling.
- **F4 (5 tests)**: Indicator visibility states, indicator error styles, preview iframe refresh, preview container render bounds, auto-compilation toggle.
- **F5 (5 tests)**: PDF export, LaTeX export, JSON export downloads, PDF magic bytes header check, LaTeX document class structure check.

### Tier 2: Boundary & Corner Cases (25 tests)
- **Inputs (5 tests)**: Empty fields, extremely long inputs (>1000 chars), unicode & emojis, empty list states, rapid click handling.
- **Templates/Languages (5 tests)**: Invalid template key fallback, rapid language toggling, empty fields on toggle, character rendering limits, cross-language templates.
- **Save/Compile APIs (5 tests)**: Save API 500 error, compile API timeout recovery, compile API syntax error parsing, backend file permission errors, offline/network loss simulation.
- **Live Preview (5 tests)**: Rapid typing queuing, loading skeleton fallback, huge PDF payload preview, toggle compile indicator preference, corrupt PDF recovery.
- **Export Downloads (5 tests)**: Export API 500 error display, empty data warning, rapid click throttling, large page exports, JSON schema validation.

### Tier 3: Cross-Feature Combinations (4 tests)
- **Test 1**: Input edit combined with template switch (verifies auto-save & compile chain updates correctly).
- **Test 2**: Language change combined with list CRUD (verifies language parameter is sent and Japanese character payloads are saved correctly).
- **Test 3**: Syntax error combined with template switch (verifies error state is cleared and compiler resolves status on layout changes).
- **Test 4**: Reorder experiences followed by JSON export (verifies array indices in exported JSON match the newly sorted UI ordering).

### Tier 4: Real-World Scenarios (5 tests)
- **Test 1**: Full English Resume workflow (from scratch profile generation to Jake's Clean PDF export).
- **Test 2**: Full Japanese Resume workflow (Japanese input values, Rirekisho Grid selection, compile, PDF + LaTeX exports).
- **Test 3**: Multi-template preview cycle (looping through all 4 templates to verify full compile compatibility across all layout options).
- **Test 4**: Data persistence and recovery (verifies that edits are correctly loaded and populated in the forms upon page refresh).
- **Test 5**: Bilingual data import/export cycle (exporting JSON in one language state, switching languages, and importing the JSON back to verify bidirectional compatibility).
