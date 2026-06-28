#!/usr/bin/env python3
import os
import sys
import subprocess
import unittest

def compile_pdfs():
    print("=======================================")
    print("▶ Running build_all.sh to compile PDFs...")
    print("=======================================")
    try:
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        # Execute build_all.sh in the project root
        res = subprocess.run(["./build_all.sh"], cwd=project_root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        print(res.stdout)
        if res.returncode != 0:
            print("Warning: build_all.sh returned a non-zero exit code.")
    except Exception as e:
        print(f"Error executing build_all.sh: {e}")
        sys.exit(1)

def run_suite():
    # Load test_resumes module
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    try:
        from test_resumes import TestResumes
        from test_adversarial import TestAdversarialResumes
    except ImportError as e:
        print(f"Error importing test modules: {e}")
        return 1
    
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TestResumes)
    adv_suite = loader.loadTestsFromTestCase(TestAdversarialResumes)
    
    # Group tests by Tier
    tiers = {
        "Tier 1 (Feature Coverage)": [],
        "Tier 2 (Boundary & Corner Cases)": [],
        "Tier 3 (Cross-Feature Combinations)": [],
        "Tier 4 (Real-World Application Scenarios)": [],
        "Tier 5 (Adversarial Coverage Hardening)": [],
        "Other": []
    }
    
    all_tests = list(suite) + list(adv_suite)
    for test in all_tests:
        name = test._testMethodName
        if "tier1" in name:
            tiers["Tier 1 (Feature Coverage)"].append(test)
        elif "tier2" in name:
            tiers["Tier 2 (Boundary & Corner Cases)"].append(test)
        elif "tier3" in name:
            tiers["Tier 3 (Cross-Feature Combinations)"].append(test)
        elif "tier4" in name:
            tiers["Tier 4 (Real-World Application Scenarios)"].append(test)
        elif "adv" in name:
            tiers["Tier 5 (Adversarial Coverage Hardening)"].append(test)
        else:
            tiers["Other"].append(test)
            
    total_passed = 0
    total_failed = 0
    total_errors = 0
    failed_tests_info = []

    print("\n=======================================")
    print("           E2E TEST RUNNER             ")
    print("=======================================")

    for tier_name, tests in tiers.items():
        if not tests:
            continue
        print(f"\n--- {tier_name} ({len(tests)} tests) ---")
        for test in tests:
            # Create a single test suite for running this test
            single_suite = unittest.TestSuite([test])
            runner = unittest.TextTestRunner(stream=open(os.devnull, 'w'), resultclass=unittest.TextTestResult)
            result = runner.run(single_suite)
            
            # Get test details
            doc = test._testMethodDoc or ""
            doc = doc.strip().split("\n")[0]
            status = "✓ PASS"
            
            if result.errors:
                status = "✗ ERROR"
                total_errors += 1
                # Grab the last non-empty line of the error message for brief reporting
                err_msg = [line for line in result.errors[0][1].split("\n") if line.strip()][-1]
                failed_tests_info.append((test._testMethodName, "ERROR", err_msg))
                print(f"  {status: <8} | {test._testMethodName: <45} | {doc}")
                print(f"      [Exception]: {err_msg}")
            elif result.failures:
                status = "✗ FAIL"
                total_failed += 1
                fail_msg = [line for line in result.failures[0][1].split("\n") if line.strip()][-1]
                failed_tests_info.append((test._testMethodName, "FAIL", fail_msg))
                print(f"  {status: <8} | {test._testMethodName: <45} | {doc}")
                print(f"      [Failure]: {fail_msg}")
            else:
                total_passed += 1
                print(f"  {status: <8} | {test._testMethodName: <45} | {doc}")
                
    total_tests = total_passed + total_failed + total_errors
    print("\n=======================================")
    print("             TEST SUMMARY              ")
    print("=======================================")
    print(f"  Total Run: {total_tests}")
    print(f"  Passed:    {total_passed}")
    print(f"  Failed:    {total_failed}")
    print(f"  Errors:    {total_errors}")
    print("=======================================")
    
    if failed_tests_info:
        print("\nFailed/Error Test Details:")
        for name, status, msg in failed_tests_info:
            print(f"  - {name} ({status}): {msg}")
            
    return 1 if (total_failed + total_errors > 0) else 0

if __name__ == "__main__":
    compile_pdfs()
    exit_code = run_suite()
    sys.exit(exit_code)
