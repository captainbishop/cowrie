const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const dep = JSON.parse(fs.readFileSync("deployments.json", "utf8"));

  console.log("Deployer:", deployer.address);
  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance (MON):", hre.ethers.formatEther(bal));
  if (bal === 0n) throw new Error("This wallet has no MON for gas. Fund it first.");

  const Ajo = await hre.ethers.getContractFactory("AjoCircle");
  const ajo = await Ajo.deploy(dep.MockUSD, deployer.address);
  await ajo.waitForDeployment();
  const addr = await ajo.getAddress();
  console.log("AjoCircle:", addr);

  dep.AjoCircle = addr;
  fs.writeFileSync("deployments.json", JSON.stringify(dep, null, 2));
  console.log("Added AjoCircle to deployments.json");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});