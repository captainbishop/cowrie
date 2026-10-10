const hre = require("hardhat");
const fs = require("fs");

// Seeds a reliable demo: funds your vault, flags a scam address, enables 10% auto-save.
async function main() {
  const d = JSON.parse(fs.readFileSync("deployments.json", "utf8"));
  const vault = await hre.ethers.getContractAt("PolicyVault", d.PolicyVault);
  const scam = await hre.ethers.getContractAt("ScamRegistry", d.ScamRegistry);

  const ONE = 1_000_000n; // 1 cUSD (6 decimals)

  let tx = await vault.mintAndDeposit(500n * ONE);
  await tx.wait();
  console.log("Minted 500 cUSD into your vault balance");

  const SCAM = "0x000000000000000000000000000000000000dEaD";
  tx = await scam.setFlag(SCAM, true);
  await tx.wait();
  console.log("Flagged demo scam address:", SCAM);

  tx = await vault.setAutosave(1000); // 10.00%
  await tx.wait();
  console.log("Auto-save set to 10%");

  console.log("\nSeed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
