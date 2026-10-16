const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  const dep = JSON.parse(fs.readFileSync("deployments.json", "utf8"));
  const token = await ethers.getContractAt("MockUSD", dep.MockUSD);
  const ajo = await ethers.getContractAt("AjoCircle", dep.AjoCircle);
  const keys = JSON.parse(fs.readFileSync(".demo-wallets.json", "utf8"));
  const members = [deployer, ...keys.map((k) => new ethers.Wallet(k, ethers.provider))];
  const names = ["You (deployer)", "Wallet A", "Wallet B"];

  const id = await ajo.circleCount();
  const c = await ajo.getCircle(id);
  if (Number(c.status) !== 3) {
    console.log("The circle is not Completed yet (status " + Number(c.status) + "). Settle the last round first.");
    return;
  }

  for (let i = 0; i < members.length; i++) {
    const left = await ajo.depositOf(id, members[i].address);
    const strikes = await ajo.strikes(id, members[i].address);
    if (left > 0n) {
      await (await ajo.connect(members[i]).withdrawDeposit(id)).wait();
      console.log(`${names[i]} withdrew ${ethers.formatUnits(left, 6)} cUSD (strikes: ${strikes})`);
    } else {
      console.log(`${names[i]} had no deposit left (strikes: ${strikes})`);
    }
  }

  console.log("Final cUSD balances:");
  for (let i = 0; i < members.length; i++) {
    console.log(`  ${names[i]}: ${ethers.formatUnits(await token.balanceOf(members[i].address), 6)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});