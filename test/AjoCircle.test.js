const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const U = 10n ** 6n;
const C = 100n * U; // contribution: 100 cUSD
const PERIOD = 3600;

async function deploy() {
  const [owner, a, b, c, d, outsider] = await ethers.getSigners();
  const token = await (await ethers.getContractFactory("MockUSD")).deploy();
  await token.waitForDeployment();
  const ajo = await (await ethers.getContractFactory("AjoCircle")).deploy(await token.getAddress(), owner.address);
  await ajo.waitForDeployment();
  const members = [a, b, c, d];
  for (const m of [...members, outsider]) {
    await token.mint(m.address, 10000n * U);
    await token.connect(m).approve(await ajo.getAddress(), ethers.MaxUint256);
  }
  return { owner, members, outsider, token, ajo };
}

// Creates circle #1 with 4 members who have all joined.
async function fullCircle(ctx, depositMult = 2n) {
  const { ajo, members } = ctx;
  const now = await time.latest();
  await ajo.connect(members[0]).createCircle("Family Ajo", C, C * depositMult, PERIOD, now + 86400, 4);
  for (const m of members.slice(1)) await ajo.connect(m).join(1);
  return 1n;
}

async function startCircle(ctx, depositMult = 2n) {
  const id = await fullCircle(ctx, depositMult);
  const order = [ctx.members[2], ctx.members[0], ctx.members[3], ctx.members[1]];
  await ctx.ajo.connect(ctx.owner).setOrder(id, order.map((m) => m.address), 12345);
  return { id, order };
}

async function roundEnd(ctx, id, round) {
  return Number(await ctx.ajo.roundEnd(id, round));
}

describe("AjoCircle", () => {
  it("runs a full circle: every round pays the right person and deposits come back", async () => {
    const ctx = await loadFixture(deploy);
    const { ajo, token, members } = ctx;
    const { id, order } = await startCircle(ctx);

    for (let r = 1; r <= 4; r++) {
      for (const m of members) await ajo.connect(m).contribute(id);
      const collector = order[r - 1];
      const before = await token.balanceOf(collector.address);
      await time.increaseTo(await roundEnd(ctx, id, r));
      expect(await ajo.isDue(id)).to.equal(true);
      await ajo.settleRound(id);
      const after = await token.balanceOf(collector.address);
      expect(after - before).to.equal(4n * C);
    }

    expect(Number((await ajo.getCircle(id)).status)).to.equal(3); // Completed

    for (const m of members) {
      const before = await token.balanceOf(m.address);
      await ajo.connect(m).withdrawDeposit(id);
      expect((await token.balanceOf(m.address)) - before).to.equal(2n * C);
    }
  });

  it("covers a missed payment from the deposit and gives the member a strike", async () => {
    const ctx = await loadFixture(deploy);
    const { ajo, token, members } = ctx;
    const { id, order } = await startCircle(ctx);

    // members[3] does not pay
    for (const m of members.slice(0, 3)) await ajo.connect(m).contribute(id);

    const collector = order[0];
    const before = await token.balanceOf(collector.address);
    await time.increaseTo(await roundEnd(ctx, id, 1));
    await ajo.settleRound(id);
    expect((await token.balanceOf(collector.address)) - before).to.equal(4n * C);

    expect(await ajo.strikes(id, members[3].address)).to.equal(1);
    expect(await ajo.depositOf(id, members[3].address)).to.equal(C); // 2C minus C taken
  });

  it("only the drawer can set the order, and the order must be valid", async () => {
    const ctx = await loadFixture(deploy);
    const { ajo, members, outsider, owner } = ctx;
    const id = await fullCircle(ctx);
    const addrs = members.map((m) => m.address);

    await expect(ajo.connect(outsider).setOrder(id, addrs, 1)).to.be.revertedWith("not drawer");
    await expect(ajo.connect(owner).setOrder(id, [addrs[0], addrs[0], addrs[1], addrs[2]], 1)).to.be.revertedWith("duplicate");
    await expect(ajo.connect(owner).setOrder(id, [outsider.address, addrs[1], addrs[2], addrs[3]], 1)).to.be.revertedWith("not a member");
    await expect(ajo.connect(owner).setOrder(id, addrs.slice(0, 3), 1)).to.be.revertedWith("bad order length");
  });

  it("enforces the payment rules", async () => {
    const ctx = await loadFixture(deploy);
    const { ajo, members, outsider } = ctx;
    const { id } = await startCircle(ctx);

    await expect(ajo.connect(outsider).contribute(id)).to.be.revertedWith("not a member");
    await ajo.connect(members[0]).contribute(id);
    await expect(ajo.connect(members[0]).contribute(id)).to.be.revertedWith("already paid");
    await expect(ajo.settleRound(id)).to.be.revertedWith("round not over");

    await time.increaseTo(await roundEnd(ctx, id, 1));
    await expect(ajo.connect(members[1]).contribute(id)).to.be.revertedWith("round ended");
  });

  it("rejects bad circle settings", async () => {
    const ctx = await loadFixture(deploy);
    const { ajo, members } = ctx;
    const now = await time.latest();
    const a = ajo.connect(members[0]);
    await expect(a.createCircle("x", C, C - 1n, PERIOD, now + 1000, 4)).to.be.revertedWith("deposit<contribution");
    await expect(a.createCircle("x", 0, C, PERIOD, now + 1000, 4)).to.be.revertedWith("contribution=0");
    await expect(a.createCircle("x", C, C, 10, now + 1000, 4)).to.be.revertedWith("period too short");
    await expect(a.createCircle("x", C, C, PERIOD, now + 1000, 1)).to.be.revertedWith("bad size");
    await expect(a.createCircle("x", C, C, PERIOD, now - 1, 4)).to.be.revertedWith("deadline passed");
  });

  it("does not let anyone withdraw a deposit while the circle is running", async () => {
    const ctx = await loadFixture(deploy);
    const { ajo, members } = ctx;
    const { id } = await startCircle(ctx);
    await expect(ajo.connect(members[0]).withdrawDeposit(id)).to.be.revertedWith("circle still running");
  });

  it("cancels a circle that never filled and returns the deposit", async () => {
    const ctx = await loadFixture(deploy);
    const { ajo, token, members } = ctx;
    const now = await time.latest();
    await ajo.connect(members[0]).createCircle("Lonely", C, 2n * C, PERIOD, now + 1000, 4);

    await expect(ajo.cancel(1)).to.be.revertedWith("too early");
    await time.increase(2000);
    await ajo.cancel(1);
    expect(Number((await ajo.getCircle(1)).status)).to.equal(4); // Cancelled

    const before = await token.balanceOf(members[0].address);
    await ajo.connect(members[0]).withdrawDeposit(1);
    expect((await token.balanceOf(members[0].address)) - before).to.equal(2n * C);
  });
});