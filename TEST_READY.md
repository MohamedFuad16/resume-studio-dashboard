# Test Ready Checklist & Command Info

## Test Execution Command
To compile all LaTeX templates and run the E2E test suite, execute the following command from the project root:

```bash
python3 tests/run_tests.py
```

## Feature Checklist & Coverage Mapping

The test suite covers the following features across Tiers 1-4 (66 test cases in total):

| Feature / Rule | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Combined) | Tier 4 (Real-World) |
|---|:---:|:---:|:---:|:---:|
| **LaTeX Compilation** | ✅ Yes (5 tests) | N/A | ✅ Yes (5 tests) | N/A |
| **Page Limits** | ✅ Yes (5 tests) | N/A | ✅ Yes (5 tests) | ✅ Yes (4 tests) |
| **Typography/Font Choice** | ✅ Yes (5 tests) | ✅ Yes (5 tests) | ✅ Yes (4 tests) | ✅ Yes (4 tests) |
| **No Slanted CJK Spans** | ✅ Yes (5 tests) | ✅ Yes (5 tests) | ✅ Yes (1 test) | ✅ Yes (4 tests) |
| **Banned Translations** | ✅ Yes (5 tests) | ✅ Yes (2 tests) | ✅ Yes (1 test) | ✅ Yes (4 tests) |
| **Personal Info Validation** | ✅ Yes (5 tests) | ✅ Yes (8 tests) | N/A | ✅ Yes (5 tests) |
| **Photo Box Layout Bounds** | N/A | ✅ Yes (1 test) | N/A | ✅ Yes (1 test) |
| **Experience & Project Audits**| N/A | ✅ Yes (5 tests) | N/A | ✅ Yes (4 tests) |

## Coverage Breakdown
- **Tier 1 (Feature Coverage)**: 30 tests (Compilation, Page count, Font choice, Slanted text check, Translation parentheses check, Personal info fields)
- **Tier 2 (Boundary & Corner Cases)**: 26 tests (CJK-only font/slant checks, phone hyphenation format constraints, DOB year/month/day components presence, email case sensitivity, full-width vs half-width parentheses, photo box coordinate enclosure, experience & project specific content checks)
- **Tier 3 (Cross-Feature Combinations)**: 5 tests (Composite verification of compilation + page count + font styles, English resume safety check)
- **Tier 4 (Real-World Application Scenarios)**: 5 tests (Detailed layout and content audits for ja_01, ja_02, ja_03, ja_04, and cross-template profile consistency audit)
- **Total Test Cases**: 66 tests (exceeds the 60 test suite requirement)
