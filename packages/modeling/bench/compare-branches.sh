#!/bin/bash
#
# Compare performance across optimization branches
# Usage: ./compare-branches.sh
#

set -e

BASE_COMMIT="93d5df5d"
BRANCHES=(
  "origin/pr/upstream-perf-polygontree"
  "origin/pr/upstream-perf-splitpolygon"
  "origin/pr/upstream-perf-flatten"
  "origin/pr/upstream-perf-object-pooling"
  "origin/pr/upstream-perf-extrude"
)

RESULTS_DIR="bench/results"
BENCH_BACKUP="/tmp/jscad-bench-$$"
mkdir -p "$RESULTS_DIR"

# Save current state
ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || git rev-parse HEAD)
echo "Saving current state: $ORIGINAL_BRANCH"

# Backup bench scripts (they may not exist in base commit)
echo "Backing up bench scripts to $BENCH_BACKUP"
cp -r bench "$BENCH_BACKUP"

cleanup() {
  echo ""
  echo "Restoring original state: $ORIGINAL_BRANCH"
  git checkout -f -q "$ORIGINAL_BRANCH" 2>/dev/null || git checkout -f -q -
  # Restore bench scripts
  cp -r "$BENCH_BACKUP"/* bench/ 2>/dev/null || true
  rm -rf "$BENCH_BACKUP"
}
trap cleanup EXIT

checkout_and_restore() {
  local ref="$1"
  # Remove bench scripts but keep results
  rm -f bench/*.js bench/*.sh 2>/dev/null || true
  git checkout -f -q "$ref"
  # Restore bench scripts
  mkdir -p bench
  cp "$BENCH_BACKUP"/*.js "$BENCH_BACKUP"/*.sh bench/ 2>/dev/null || true
}

run_benchmarks() {
  local name="$1"
  local outfile="$RESULTS_DIR/${name}.txt"

  echo "Running benchmarks for: $name"
  echo "=== $name ===" > "$outfile"
  echo "" >> "$outfile"

  # Run boolean benchmarks (most affected by optimizations)
  echo "--- booleans.bench.js ---" >> "$outfile"
  node bench/booleans.bench.js 2>&1 >> "$outfile"

  echo "" >> "$outfile"
  echo "--- splitPolygon.bench.js ---" >> "$outfile"
  node --expose-gc bench/splitPolygon.bench.js 2>&1 >> "$outfile"

  echo "  -> Saved to $outfile"
}

echo "============================================================"
echo "Performance Comparison: Base vs Optimization Branches"
echo "============================================================"
echo ""
echo "Base commit: $BASE_COMMIT"
echo "Branches to test: ${#BRANCHES[@]}"
echo ""

# Run on base commit
echo "------------------------------------------------------------"
echo "[1/$((${#BRANCHES[@]}+1))] Checking out BASE: $BASE_COMMIT"
echo "------------------------------------------------------------"
checkout_and_restore "$BASE_COMMIT"
run_benchmarks "base"
echo ""

# Run on each optimization branch
i=2
for branch in "${BRANCHES[@]}"; do
  short_name=$(echo "$branch" | sed 's|origin/pr/upstream-perf-||')
  echo "------------------------------------------------------------"
  echo "[$i/$((${#BRANCHES[@]}+1))] Checking out: $short_name"
  echo "------------------------------------------------------------"
  checkout_and_restore "$branch"
  run_benchmarks "$short_name"
  echo ""
  ((i++))
done

echo "============================================================"
echo "All benchmarks complete. Results in $RESULTS_DIR/"
echo "============================================================"
echo ""

# Generate comparison summary
echo "Generating comparison summary..."
echo ""
echo "=== COMPARISON SUMMARY ===" | tee "$RESULTS_DIR/summary.txt"
echo "" | tee -a "$RESULTS_DIR/summary.txt"

# Extract key metrics from each result file
for result in "$RESULTS_DIR"/*.txt; do
  name=$(basename "$result" .txt)
  [[ "$name" == "summary" ]] && continue

  echo "--- $name ---" | tee -a "$RESULTS_DIR/summary.txt"

  # Extract torus(32) union time (good stress test metric)
  torus_time=$(grep "union: torus(32)" "$result" | awk '{print $4}')
  if [[ -n "$torus_time" ]]; then
    echo "  union torus(32)+torus(32): ${torus_time} ms/op" | tee -a "$RESULTS_DIR/summary.txt"
  fi

  # Extract spanning split time
  spanning_time=$(grep "spanning split.*quad" "$result" | awk '{print $6}')
  if [[ -n "$spanning_time" ]]; then
    echo "  spanning split (quad):     ${spanning_time} µs/op" | tee -a "$RESULTS_DIR/summary.txt"
  fi

  echo "" | tee -a "$RESULTS_DIR/summary.txt"
done

echo "Done! See $RESULTS_DIR/summary.txt for quick comparison."
