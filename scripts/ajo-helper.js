const hre = require("hardhat");
const fs = require("fs");

const U = 10n ** 6n;
const STATUS = ["Open", "Full", "Active", "Completed", "Cancelled"];

async function main() {
  const { ethers } = hre;
  const dep = JSON.parse(fs.readFileSync("deployments.json", "utf8"));
  const token = await ethers.getContractAt("MockUSD", dep.MockUSD);
  const ajo = await ethers.getContractAt("AjoCircleV2", dep.AjoCircleV2);
  const keys = JSON.parse(fs.readFileSync(".demo-wallets.json", "utf8"));
  const wallets = keys.map((k) => new ethers.Wallet(k, ethers.provider));
  const names = ["Wallet A", "Wallet B"];
  const phase = fs.existsSync(".demo-phase") ? fs.readFileSync(".demo-phase", "utf8").trim() : "status";

  const id = await ajo.circleCount();
  if (id === 0n) throw new Error("No circle yet. Create one in the app first.");
  const c = await ajo.getCircle(id);

  if (phase === "join") {
    if (Number(c.status) !== 0) {
      console.log(`Circle #${id} is ${STATUS[Number(c.status)]}, not Open.`);
    } else {
      for (let i = 0; i < wallets.length; i++) {
        const w = wallets[i];
        if (await ajo.isMember(id, w.address)) continue;
        try {
          await (await token.mint(w.address, 1000n * U)).wait();
          await (await token.connect(w).approve(dep.AjoCircleV2, ethers.MaxUint256)).wait();
          await (await ajo.connect(w).join(id)).wait();
          console.log(`${names[i]} joined circle #${id}.`);
        } catch (e) {
          console.log(`${names[i]} could not join: ${e.shortMessage ?? e.message}`);
        }
      }
    }
  }

  if (phase === "pay") {
    if (Number(c.status) !== 2) {
      console.log(`Circle #${id} is ${STATUS[Number(c.status)]}, not Active.`);
    } else {
      for (let i = 0; i < wallets.length; i++) {
        const w = wallets[i];
        if (await ajo.paid(id, c.round, w.address)) continue;
        try {
          await (await ajo.connect(w).contribute(id)).wait();
          console.log(`${names[i]} paid for round ${c.round}.`);
        } catch (e) {
          console.log(`${names[i]} could not pay: ${e.shortMessage ?? e.message}`);
        }
      }
    }
  }

  const s = await ajo.getCircle(id);
  const order = await ajo.getOrder(id);
  console.log(`\nCircle #${id} "${s.name}": ${STATUS[Number(s.status)]}, round ${s.round}, ${s.members.length}/${s.maxMembers} members`);
  const label = (a) => {
    const i = wallets.findIndex((w) => w.address.toLowerCase() === a.toLowerCase());
    return i >= 0 ? names[i] : `the app account (${a.slice(0, 6)}...${a.slice(-4)})`;
  };
  if (order.length) {
    console.log("Payout order:");
    order.forEach((a, i) => console.log(`  Round ${i + 1}: ${label(a)}`));
    if (Number(s.status) === 2) {
      const end = Number(await ajo.roundEnd(id));
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      console.log(end > now ? `Current round ends in ${end - now} seconds.` : "Current round has ended: run the CRE workflow to settle it.");
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
