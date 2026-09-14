#!/bin/bash
#
# Compare performance across optimization branches using standardized benchmarks
#
# Usage: ./compare-perf-branches.sh [runs]
#

set -e

MODELING_DIR="/home/john/pkg/OpenJSCAD.org/packages/modeling"
BENCHMARK_RUNNER="/home/john/src/jscadui/apps/jscad-web/run-benchmarks.cjs"

BASE_COMMIT="93d5df5d"
BRANCHES=(
  "origin/pr/upstream-perf-polygontree"
  "origin/pr/upstream-perf-splitpolygon"
  "origin/pr/upstream-perf-flatten"
  "origin/pr/upstream-perf-object-pooling"
  "origin/pr/upstream-perf-extrude"
)

# Key benchmarks that stress boolean operations
BENCHMARKS="sphere-union,swiss-cheese,chainmail,menger-intersect,sphere-cloud"

RUNS="${1:-3}"
RESULTS_DIR="$MODELING_DIR/bench/results"
mkdir -p "$RESULTS_DIR"

cd "$MODELING_DIR"

# Save current state
ORIGINAL_REF=$(git rev-parse HEAD)
echo "Saving current state: $ORIGINAL_REF"

cleanup() {
  echo ""
  echo "Restoring original state..."
  git checkout -f -q "$ORIGINAL_REF" 2>/dev/null || true
}
trap cleanup EXIT

run_benchmarks() {
  local name="$1"
  local outfile="$RESULTS_DIR/${name}.txt"

  echo "=== $name ===" > "$outfile"

  # Run each key benchmark
  for bench in ${BENCHMARKS//,/ }; do
    result=$(node "$BENCHMARK_RUNNER" "$bench" "$RUNS" "$MODELING_DIR" 2>&1 | grep "benchmark-" | awk '{print $2}')
    echo "$bench $result" >> "$outfile"
  done
}

echo "============================================================"
echo "Performance Comparison: Base vs Optimization Branches"
echo "============================================================"
echo ""
echo "Modeling dir: $MODELING_DIR"
echo "Base commit:  $BASE_COMMIT"
echo "Runs:         $RUNS"
echo "Benchmarks:   $BENCHMARKS"
echo ""

# Run on base commit
echo "------------------------------------------------------------"
echo "[1/$((${#BRANCHES[@]}+1))] BASE: $BASE_COMMIT"
echo "------------------------------------------------------------"
git checkout -f -q "$BASE_COMMIT"
run_benchmarks "base"
cat "$RESULTS_DIR/base.txt"
echo ""

# Run on each optimization branch
i=2
for branch in "${BRANCHES[@]}"; do
  short_name=$(echo "$branch" | sed 's|origin/pr/upstream-perf-||')
  echo "------------------------------------------------------------"
  echo "[$i/$((${#BRANCHES[@]}+1))] $short_name"
  echo "------------------------------------------------------------"
  git checkout -f -q "$branch"
  run_benchmarks "$short_name"
  cat "$RESULTS_DIR/${short_name}.txt"
  echo ""
  ((i++))
done

echo "============================================================"
echo "COMPARISON TABLE"
echo "============================================================"
echo ""

# Print header
printf "%-16s" "Benchmark"
printf "%10s" "base"
for branch in "${BRANCHES[@]}"; do
  short=$(echo "$branch" | sed 's|origin/pr/upstream-perf-||')
  printf "%10s" "$short"
done
echo ""
printf "%-16s" "--------"
printf "%10s" "----"
for branch in "${BRANCHES[@]}"; do
  printf "%10s" "----"
done
echo ""

# Print data rows
for bench in ${BENCHMARKS//,/ }; do
  printf "%-16s" "$bench"
  # Base time
  base_time=$(grep "^$bench " "$RESULTS_DIR/base.txt" | awk '{print $2}')
  printf "%10s" "$base_time"

  # Branch times
  for branch in "${BRANCHES[@]}"; do
    short=$(echo "$branch" | sed 's|origin/pr/upstream-perf-||')
    time=$(grep "^$bench " "$RESULTS_DIR/${short}.txt" | awk '{print $2}')
    printf "%10s" "$time"
  done
  echo ""
done

echo ""
echo "Times in milliseconds (lower is better)"
echo "Results saved to: $RESULTS_DIR/"
