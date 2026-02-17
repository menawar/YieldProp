import { ethers } from "hardhat";

async function main() {
  const USDC_ADDRESS = "0x6cBFD98EFa90681EA824E57E594822e1B893d42e";
  const MINT_AMOUNT = ethers.parseUnits("300000", 6); // 300,000 USDC

  const RECIPIENTS = [
    "0x166e4bDEfFbCB59B96Ef4c2460C42C60daD0e3f1",
    "0xaEe2429E13F567BdFb038AcfA82f539197e353b5",
    "0xc42E04AF0b38c69fF6bA00C62E60d0373C04C994",
  ];

  const usdc = await ethers.getContractAt("MockERC20", USDC_ADDRESS);

  for (const recipient of RECIPIENTS) {
    console.log(`Minting ${ethers.formatUnits(MINT_AMOUNT, 6)} USDC to ${recipient}...`);
    const tx = await usdc.mint(recipient, MINT_AMOUNT);
    await tx.wait();
    const balance = await usdc.balanceOf(recipient);
    console.log(`  ✅ Balance: ${ethers.formatUnits(balance, 6)} USDC`);
  }

  console.log("\n🎉 All minting complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Minting failed:", error);
    process.exit(1);
  });
