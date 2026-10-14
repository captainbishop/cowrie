const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const MockUSD = await hre.ethers.getContractFactory("MockUSD");
  const usd = await MockUSD.deploy();
  await usd.waitForDeployment();
  const usdAddr = await usd.getAddress();
  console.log("MockUSD (cUSD):", usdAddr);

  const ScamRegistry = await hre.ethers.getContractFactory("ScamRegistry");
  const scam = await ScamRegistry.deploy();
  await scam.waitForDeployment();
  const scamAddr = await scam.getAddress();
  console.log("ScamRegistry:  ", scamAddr);

  const PolicyVault = await hre.ethers.getContractFactory("PolicyVault");
  const vault = await PolicyVault.deploy(usdAddr, scamAddr);
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log("PolicyVault:   ", vaultAddr);

  const out = {
    network: "monadTestnet",
    chainId: 10143,
    MockUSD: usdAddr,
    ScamRegistry: scamAddr,
    PolicyVault: vaultAddr,
    deployer: deployer.address,
  };
  fs.writeFileSync("deployments.json", JSON.stringify(out, null, 2));
  console.log("\nSaved deployments.json");

  try {
    require("./syncenv").syncEnv();
  } catch (e) {
    console.warn("Could not auto-update web/.env.local:", e.message);
    console.warn("You can run it yourself with: npm run syncenv");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
