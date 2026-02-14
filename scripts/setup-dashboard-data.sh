#!/bin/bash

echo "🚀 Setting up dashboard data for YieldProp MVP"
echo "================================================"
echo ""

# Check if deployment exists
if [ ! -d "deployments" ] || [ -z "$(ls -A deployments/sepolia-*.json 2>/dev/null)" ]; then
    echo "❌ No deployment found!"
    echo "Please run: npx hardhat run scripts/deploy.ts --network sepolia"
    exit 1
fi

echo "✅ Deployment found"
echo ""

# Run the seed script
echo "🌱 Seeding test data..."
npx hardhat run scripts/seed-test-data.ts --network sepolia

if [ $? -eq 0 ]; then
    echo ""
    echo "================================================"
    echo "✅ Dashboard data setup complete!"
    echo "================================================"
    echo ""
    echo "Next steps:"
    echo "1. cd dashboard"
    echo "2. npm run dev"
    echo "3. Open http://localhost:3000"
    echo "4. Connect your wallet to Sepolia testnet"
    echo ""
else
    echo ""
    echo "❌ Seeding failed. Please check the error above."
    exit 1
fi
