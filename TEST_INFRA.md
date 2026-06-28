# Test Strategy Document: Japanese Resume Redesign E2E Testing

## Test Philosophy
The testing strategy is designed around **opaque-box**, **requirement-driven** testing. The test suite does not depend on the implementation details (e.g. specific LaTeX commands, packages, or macro names used in the templates). Instead, it operates directly on the generated artifact (compiled PDFs) and validates compliance with visual, typographic, structural, and linguistic requirements.

## Methodology
- **Category-Partition**: Identifying features, inputs, and environment configurations, partitioning them into testable categories, and testing representatives of each.
- **Boundary Value Analysis (BVA)**: Applying tests on boundary conditions such as exact page limits, photo box layout coordinates, and font selection boundaries.
- **Pairwise Combinatorial Testing**: Verifying cross-feature combinations to ensure compile, layout, font, and translation rules do not clash under composite scenarios.
- **Real-World Workload Testing**: Running validations against real-world user resumes across multiple layout variants (Tier 4).

## Feature Inventory
- **LaTeX compilation**: Ensuring each `.tex` template successfully compiles into a valid, non-empty PDF using `tectonic`.
- **Page limits**: Checking that `ja_01_shokumu_modern` is strictly 2 pages, and all other templates (`ja_02`, `ja_03`, `ja_04`) are strictly 1 page.
- **Typography rules**: Enforcing Gothic font families for `ja_01`, `ja_03`, and `ja_04`, and Mincho font families for `ja_02`. Ensuring no slanted/italicized Japanese (CJK) text spans are present.
- **Translation restrictions**: Preventing parenthetical English translations of proper names (e.g., University/Company/Project names).
- **Personal Info validation**: Confirming accurate personal details, including name, phone number format, email format, DOB structure, experiences, and projects.

## Test Architecture
- **Runner**: Python `unittest` framework runner.
- **Extractor**: PyMuPDF (`fitz`) library to extract text, fonts, character styles, and drawings from compiled PDF files.
- **Exit Codes**: The test execution returns exit code `0` if all tests pass, and `1` if any test fails, integrating directly with modern CI/CD or build validation scripts.

## Directory Layout
```
/Users/mfuad16/Documents/Resume/
├── TEST_INFRA.md       # This test strategy document
├── TEST_READY.md       # Verification command and checklist
├── build_all.sh        # Tectonic compilation script
├── ja/                 # Japanese Resume LaTeX templates
├── output/             # Output directory for compiled PDFs
└── tests/
    ├── run_tests.py    # Test runner executing compilation and tests
    └── test_resumes.py # Main E2E test suite (60 test cases)
```

## Real-World Application Scenarios (Tier 4)
We define realistic candidate profile configurations to verify layout integrity, alignment, text flow, and completeness of content across the entire resume:
- Full-scale cross-template validation of name, address, DOB, phone, and email across all 4 templates.
- Section audits for Work Experience (Altius Link, Hotel SUI Akasaka, Japan Airlines) checking text correctness and hierarchy.
- Section audits for Projects (Tutor-System, TokaiHub, WebDrop, Codex Account Switcher) verifying details and links/attributes.
- Structural audit of layout boundaries and dimensions to prevent text overflow or page spills.

## Coverage Thresholds
- **Tier 1 (Feature Coverage)**: >= 25 test cases
- **Tier 2 (Boundary & Corner Cases)**: >= 25 test cases
- **Tier 3 (Cross-Feature Combinations)**: >= 5 test cases
- **Tier 4 (Real-World Application Scenarios)**: >= 5 test cases
- **Total Suite Coverage**: >= 60 test cases
