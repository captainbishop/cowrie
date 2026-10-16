const hre = require("hardhat");
const fs = require("fs");

// Monad testnet, from your own `cre workflow supported-chains` output.
// The MOCK forwarder is the one CRE simulation uses.
const MOCK_FORWARDER = "0xB9F79d863261869B234c481D1f9A7af84AeAd192";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const dep = JSON.parse(fs.readFileSync("deployments.json", "utf8"));
  if (!dep.AjoCircle) throw new Error("AjoCircle is not in deployments.json. Deploy it first.");

  console.log("Deployer:", deployer.address);
  const ajo = await hre.ethers.getContractAt("AjoCircle", dep.AjoCircle);
  const owner = await ajo.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error("This wallet does not own the AjoCircle contract, so it cannot set the drawer.");
  }

  const Keeper = await hre.ethers.getContractFactory("AjoKeeper");
  const keeper = await Keeper.deploy(dep.AjoCircle, MOCK_FORWARDER);
  await keeper.waitForDeployment();
  const addr = await keeper.getAddress();
  console.log("AjoKeeper:", addr);

  const tx = await ajo.setDrawer(addr);
  await tx.wait();
  console.log("AjoCircle drawer is now the keeper:", await ajo.drawer());

  dep.AjoKeeper = addr;
  dep.MockForwarder = MOCK_FORWARDER;
  fs.writeFileSync("deployments.json", JSON.stringify(dep, null, 2));
  console.log("Saved to deployments.json");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});