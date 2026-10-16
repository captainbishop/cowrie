const hre = require("hardhat");
const fs = require("fs");

const U = 10n ** 6n;
const CONTRIBUTION = 10n * U; // 10 cUSD per round
const DEPOSIT = 20n * U; // 20 cUSD security deposit
const PERIOD = 300; // each round lasts 5 minutes
const FILE = ".demo-wallets.json";
const NAMES = ["You (deployer)", "Wallet A", "Wallet B"];

async function main() {
  const { ethers } = hre;
  const provider = ethers.provider;
  const [deployer] = await ethers.getSigners();
  const dep = JSON.parse(fs.readFileSync("deployments.json", "utf8"));
  const token = await ethers.getContractAt("MockUSD", dep.MockUSD);
  const ajo = await ethers.getContractAt("AjoCircle", dep.AjoCircle);

  // Two throwaway test wallets, kept in a git-ignored file.
  let keys;
  if (fs.existsSync(FILE)) {
    keys = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } else {
    keys = [ethers.Wallet.createRandom().privateKey, ethers.Wallet.createRandom().privateKey];
    fs.writeFileSync(FILE, JSON.stringify(keys));
  }
  const wallets = keys.map((k) => new ethers.Wallet(k, provider));
  const members = [deployer, ...wallets];
  const phase = fs.existsSync(".demo-phase") ? fs.readFileSync(".demo-phase", "utf8").trim() : "status";

  if (phase === "setup") {
    for (const w of wallets) {
      if ((await provider.getBalance(w.address)) < ethers.parseEther("0.03")) {
        await (await deployer.sendTransaction({ to: w.address, value: ethers.parseEther("0.05") })).wait();
      }
    }
    console.log("Test wallets funded with gas.");

    for (const m of members) {
      await (await token.mint(m.address, 1000n * U)).wait();
      await (await token.connect(m).approve(dep.AjoCircle, ethers.MaxUint256)).wait();
    }
    console.log("Everyone has test cUSD and has approved the Ajo contract.");

    const block = await provider.getBlock("latest");
    await (await ajo.connect(deployer).createCircle("Demo Ajo", CONTRIBUTION, DEPOSIT, PERIOD, block.timestamp + 3600, 3)).wait();
    const id = await ajo.circleCount();
    for (const w of wallets) await (await ajo.connect(w).join(id)).wait();
    console.log(`Circle #${id} created and full (3 members). Next: run the CRE workflow to draw the order.`);
    return;
  }

  const id = await ajo.circleCount();
  if (id === 0n) throw new Error("No circle yet. Run the setup phase first.");
  const circle = await ajo.getCircle(id);
  const statusNames = ["Open", "Full", "Active", "Completed", "Cancelled"];

  if (phase === "pay") {
    if (Number(circle.status) !== 2) {
      console.log(`Circle #${id} is ${statusNames[Number(circle.status)]}, not Active. Run the CRE workflow first.`);
      return;
    }
    const round = circle.round;
    for (let i = 0; i < members.length; i++) {
      if (!(await ajo.paid(id, round, members[i].address))) {
        await (await ajo.connect(members[i]).contribute(id)).wait();
        console.log(`${NAMES[i]} paid for round ${round}.`);
      }
    }
  }

  // status (also printed after pay)
  const c = await ajo.getCircle(id);
  const order = await ajo.getOrder(id);
  console.log(`\nCircle #${id}: ${statusNames[Number(c.status)]}, round ${c.round}`);
  if (order.length) {
    console.log("Payout order:");
    order.forEach((a, i) => console.log(`  Round ${i + 1}: ${NAMES[members.findIndex((m) => m.address === a)]}`));
    if (Number(c.status) === 2) {
      const end = Number(await ajo.roundEnd(id));
      const now = (await provider.getBlock("latest")).timestamp;
      console.log(end > now ? `Current round ends in ${end - now} seconds.` : "Current round has ended: run the CRE workflow to settle it.");
    }
  }
  console.log("cUSD balances:");
  for (let i = 0; i < members.length; i++) {
    const b = await token.balanceOf(members[i].address);
    console.log(`  ${NAMES[i]}: ${ethers.formatUnits(b, 6)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});