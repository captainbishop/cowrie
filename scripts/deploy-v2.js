const hre = require("hardhat");
const fs = require("fs");

// Simulation forwarder for Monad testnet, from `cre workflow supported-chains`.
// When the workflow is deployed on Chainlink's network, swap to the real forwarder with setForwarder.
const MOCK_FORWARDER = "0xB9F79d863261869B234c481D1f9A7af84AeAd192";

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  const dep = JSON.parse(fs.readFileSync("deployments.json", "utf8"));
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer:", deployer.address, "balance", ethers.formatEther(bal), "MON");
  if (bal < ethers.parseEther("1")) throw new Error("Top up the deployer with at least 1 MON first (faucet).");

  const ajo = await (await ethers.getContractFactory("AjoCircleV2")).deploy(dep.MockUSD, ethers.ZeroAddress);
  await ajo.waitForDeployment();
  const ajoAddr = await ajo.getAddress();
  console.log("AjoCircleV2:", ajoAddr);

  const keeper = await (await ethers.getContractFactory("AjoKeeperV2")).deploy(ajoAddr, MOCK_FORWARDER);
  await keeper.waitForDeployment();
  const keeperAddr = await keeper.getAddress();
  console.log("AjoKeeperV2:", keeperAddr);

  await (await ajo.setDrawer(keeperAddr, true)).wait();
  console.log("The keeper is now an authorised drawer.");

  dep.AjoCircleV2 = ajoAddr;
  dep.AjoKeeperV2 = keeperAddr;
  fs.writeFileSync("deployments.json", JSON.stringify(dep, null, 2));
  console.log("Saved to deployments.json. Version 1 is untouched.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
