#!/usr/bin/env bash

# Master validation runner for the Part-1A HMS project.
# Runs every check, records results, and exits non-zero if any check fails.

set -o pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT" || exit 1

TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
LOG_DIR="evidence/harness-results"
LOG_FILE="$LOG_DIR/master-runner-$TIMESTAMP.log"

mkdir -p "$LOG_DIR"

declare -a CHECK_NAMES=()
declare -a CHECK_RESULTS=()

echo "HMS Part-1A Master Harness Run" | tee "$LOG_FILE"
echo "Started: $(date)" | tee -a "$LOG_FILE"
echo "Project: $PROJECT_ROOT" | tee -a "$LOG_FILE"
echo "==================================================" | tee -a "$LOG_FILE"

run_check() {
    local name="$1"
    shift

    echo "" | tee -a "$LOG_FILE"
    echo ">>> $name" | tee -a "$LOG_FILE"
    echo "Command: $*" | tee -a "$LOG_FILE"

    "$@" 2>&1 | tee -a "$LOG_FILE"
    local status=${PIPESTATUS[0]}

    if [ "$status" -eq 0 ]; then
        echo "RESULT: PASS" | tee -a "$LOG_FILE"
        CHECK_RESULTS+=("PASS")
    else
        echo "RESULT: FAIL (exit code: $status)" | tee -a "$LOG_FILE"
        CHECK_RESULTS+=("FAIL")
    fi

    CHECK_NAMES+=("$name")
}

run_check "Application tests" npm test
run_check "ESLint" npm run lint
run_check "Semgrep security scan" npm run security
run_check "Frontend production build" npm run build
run_check "Harness unit tests" node --test .harness/*.test.js .harness/fixtures/*.test.js
run_check "Harness preflight" npm run harness:preflight
run_check "Performance benchmark" npm run harness:benchmark

echo "" | tee -a "$LOG_FILE"
echo "==================================================" | tee -a "$LOG_FILE"
echo "MASTER HARNESS SUMMARY" | tee -a "$LOG_FILE"

FAILURES=0

for i in "${!CHECK_NAMES[@]}"; do
    printf '%-30s %s\n' "${CHECK_NAMES[$i]}" "${CHECK_RESULTS[$i]}" | tee -a "$LOG_FILE"

    if [ "${CHECK_RESULTS[$i]}" = "FAIL" ]; then
        FAILURES=$((FAILURES + 1))
    fi
done

echo "" | tee -a "$LOG_FILE"
echo "Completed: $(date)" | tee -a "$LOG_FILE"
echo "Total checks: ${#CHECK_NAMES[@]}" | tee -a "$LOG_FILE"
echo "Passed: $((${#CHECK_NAMES[@]} - FAILURES))" | tee -a "$LOG_FILE"
echo "Failed: $FAILURES" | tee -a "$LOG_FILE"
echo "Full report: $LOG_FILE" | tee -a "$LOG_FILE"

if [ "$FAILURES" -gt 0 ]; then
    exit 1
fi

exit 0
