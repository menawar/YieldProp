/**
 * Mint Mock USDC to an address on Sepolia for testing
 * Usage: npx hardhat run scripts/mint-usdc.ts --network sepolia
 *
 * Env vars:
 *   MOCK_USDC_ADDRESS - Mock USDC contract (default: from deployments/sepolia-*.json)
 *   MINT_AMOUNT      - Amount in USDC, e.g. "10000" (default: 10000)
 *   MINT_TO          - Recipient address (default: 0xaEe2429E13F567BdFb038AcfA82f539197e353b5)
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const DEFAULT_RECIPIENT = "0xaEe2429E13F567BdFb038AcfA82f539197e353b5";
const DEFAULT_AMOUNT = "10000"; // 10,000 USDC

async function main() {
  const recipient = process.env.MINT_TO || DEFAULT_RECIPIENT;
  const amountStr = process.env.MINT_AMOUNT || DEFAULT_AMOUNT;
  const amount = ethers.parseUnits(amountStr, 6); // USDC has 6 decimals

  let mockUsdcAddress = process.env.MOCK_USDC_ADDRESS;
  if (!mockUsdcAddress) {
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    const files = fs.readdirSync(deploymentsDir).filter((f) => f.endsWith(".json"));
    const latest = files.sort().reverse()[0];
    if (latest) {
      const deployment = JSON.parse(
        fs.readFileSync(path.join(deploymentsDir, latest), "utf-8")
      );
      mockUsdcAddress = deployment.MockUSDC || deployment.contracts?.MockUSDC;
    }
  }

  if (!mockUsdcAddress) {
    throw new Error(
      "MOCK_USDC_ADDRESS not set and no deployment found. Set MOCK_USDC_ADDRESS in .env or deploy first."
    );
  }

  const [signer] = await ethers.getSigners();
  console.log("Minting from:", signer.address);
  console.log("Mock USDC at:", mockUsdcAddress);
  console.log("Recipient:", recipient);
  console.log("Amount:", amountStr, "USDC\n");

  const mockUsdc = await ethers.getContractAt("MockERC20", mockUsdcAddress);
  const tx = await mockUsdc.mint(recipient, amount);
  await tx.wait();

  console.log("Done. Tx:", tx.hash);
  const balance = await mockUsdc.balanceOf(recipient);
  console.log("New balance:", ethers.formatUnits(balance, 6), "USDC");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
