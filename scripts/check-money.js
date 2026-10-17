const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const { ethers } = hre;
  const dep = JSON.parse(fs.readFileSync("deployments.json", "utf8"));
  const [me, ike] = fs.readFileSync(".who", "utf8").trim().split(/\s+/);
  if (!ethers.isAddress(me) || !ethers.isAddress(ike)) throw new Error("Put two real addresses in .who, separated by a space.");
  const token = await ethers.getContractAt("MockUSD", dep.MockUSD);
  const vault = await ethers.getContractAt("PolicyVault", dep.PolicyVault);
  const ajo = await ethers.getContractAt("AjoCircle", dep.AjoCircle);
  const f = (v) => ethers.formatUnits(v, 6);
  const STATUS = ["Open", "Full", "Active", "Completed", "Cancelled"];

  for (const [label, a] of [["YOU", me], ["IKE", ike]]) {
    console.log(`${label}: spendable ${f(await vault.spendable(a))} | savings ${f(await vault.savings(a))} | wallet ${f(await token.balanceOf(a))}`);
  }

  const n = Number(await ajo.circleCount());
  console.log(`\nOn-chain circles: ${n}`);
  for (let i = Math.max(1, n - 4); i <= n; i++) {
    const c = await ajo.getCircle(i);
    console.log(`#${i} "${c.name}" ${STATUS[Number(c.status)]}, inviteOnly=${c.inviteOnly}, members ${c.members.length}/${c.maxMembers}, pay ${f(c.contribution)}, deposit ${f(c.deposit)}`);
    console.log(`    created by you: ${c.creator.toLowerCase() === me.toLowerCase()} | your locked deposit: ${f(await ajo.depositOf(i, me))} | Ike member: ${await ajo.isMember(i, ike)}, invited: ${await ajo.isInvited(i, ike)}`);
  }

  const latest = await ethers.provider.getBlockNumber();
  const found = [];
  try {
    for (let to = latest; to > latest - 30000; to -= 1000) {
      const evs = await vault.queryFilter(vault.filters.Sent(me), Math.max(0, to - 999), to);
      for (const e of evs) found.push(e);
    }
  } catch (e) {
    console.log("(could not read all recent sends: " + (e.shortMessage ?? e.message) + ")");
  }
  console.log(`\nRecent sends from you: ${found.length}`);
  for (const e of found.reverse().slice(0, 8)) {
    console.log(`  ${f(e.args.amount)} to ${e.args.to}${e.args.to.toLowerCase() === ike.toLowerCase() ? "  (Ike)" : ""}  tx ${e.transactionHash}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
