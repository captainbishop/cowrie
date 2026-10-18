const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const { ethers } = hre;
  const dep = JSON.parse(fs.readFileSync("deployments.json", "utf8"));
  const token = await ethers.getContractAt("MockUSD", dep.MockUSD);
  const ajo = await ethers.getContractAt("AjoCircle", dep.AjoCircle);
  const keys = JSON.parse(fs.readFileSync(".demo-wallets.json", "utf8"));
  const wallets = keys.map((k) => new ethers.Wallet(k, ethers.provider));
  const names = ["Wallet A", "Wallet B"];
  const id = await ajo.circleCount();
  const c = await ajo.getCircle(id);
  if (Number(c.status) !== 3) {
    console.log("Circle #" + id + " is not Completed yet (status " + Number(c.status) + "). Settle the last round first.");
    return;
  }
  for (let i = 0; i < wallets.length; i++) {
    const left = await ajo.depositOf(id, wallets[i].address);
    const strikes = await ajo.strikes(id, wallets[i].address);
    if (left > 0n) {
      await (await ajo.connect(wallets[i]).withdrawDeposit(id)).wait();
      console.log(`${names[i]} withdrew ${ethers.formatUnits(left, 6)} cUSD (strikes: ${strikes})`);
    } else {
      console.log(`${names[i]} had no deposit left (strikes: ${strikes})`);
    }
  }
  for (let i = 0; i < wallets.length; i++) {
    console.log(`${names[i]} cUSD: ${ethers.formatUnits(await token.balanceOf(wallets[i].address), 6)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
