const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  const keys = JSON.parse(fs.readFileSync(".demo-wallets.json", "utf8"));
  for (const k of keys) {
    const w = new ethers.Wallet(k, ethers.provider);
    await (await deployer.sendTransaction({ to: w.address, value: ethers.parseEther("0.05") })).wait();
    console.log("Sent 0.05 MON to", w.address);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});