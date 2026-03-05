#!/bin/bash

# run-workflow-cron.sh
# This script continuously triggers the Chainlink CRE workflow.

echo "🟢 Starting YieldProp Chainlink CRE Daemon"

# Default to running every 12 hours (43200 seconds) if not provided
RUN_INTERVAL_SECONDS=${RUN_INTERVAL_SECONDS:-43200}
echo "⏱️ Interval set to: $RUN_INTERVAL_SECONDS seconds."

while true; do
  echo "🚀 [$(date -u)] Triggering yieldprop-workflow..."
  
  # Run the Chainlink CRE execute command
  cre workflow simulate yieldprop-workflow --target staging-settings
  
  # Capture the exit code to monitor failures
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Workflow executed successfully."
  else
    echo "❌ Workflow execution failed with exit code $EXIT_CODE."
    # We don't exit here so the daemon keeps trying on the next interval
  fi
  
  echo "💤 Waiting for $RUN_INTERVAL_SECONDS seconds before next run..."
  sleep $RUN_INTERVAL_SECONDS
done
