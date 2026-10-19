const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, mine, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const U = 10n ** 6n;
const C = 100n * U;
const PERIOD = 3600;
const coder = ethers.AbiCoder.defaultAbiCoder();
const report = (action, id, order, seed) =>
  coder.encode(["uint8", "uint256", "address[]", "uint256"], [action, id, order, seed]);

async function deploy() {
  const [owner, a, b, c, stranger, fwd] = await ethers.getSigners();
  const token = await (await ethers.getContractFactory("MockUSD")).deploy();
  const ajo = await (await ethers.getContractFactory("AjoCircleV2")).deploy(await token.getAddress(), owner.address);
  const ajoAddr = await ajo.getAddress();
  for (const m of [a, b, c, stranger]) {
    await token.mint(m.address, 10000n * U);
    await token.connect(m).approve(ajoAddr, ethers.MaxUint256);
  }
  return { owner, a, b, c, stranger, fwd, token, ajo, ajoAddr };
}

async function open(ctx) {
  const now = await time.latest();
  await ctx.ajo.connect(ctx.a).createCircle("Test", C, 2n * C, PERIOD, now + 86400, 3);
  return 1n;
}
async function full(ctx) {
  const id = await open(ctx);
  await ctx.ajo.connect(ctx.b).join(id);
  await ctx.ajo.connect(ctx.c).join(id);
  return id;
}
const addrs = (ctx) => [ctx.a.address, ctx.b.address, ctx.c.address];
async function active(ctx) {
  const id = await full(ctx);
  await ctx.ajo.connect(ctx.owner).setOrder(id, addrs(ctx), 7);
  return id;
}

describe("AjoCircleV2", () => {
  it("runs a full circle: three rounds paid out, deposits returned", async () => {
    const ctx = await loadFixture(deploy);
    const { ajo, token, a, b, c } = ctx;
    const id = await active(ctx);
    const order = [a, b, c];
    for (let r = 1; r <= 3; r++) {
      for (const m of order) await ajo.connect(m).contribute(id);
      const before = await token.balanceOf(order[r - 1].address);
      await time.increaseTo(Number(await ajo.roundEnd(id)));
      await ajo.settleRound(id);
      expect((await token.balanceOf(order[r - 1].address)) - before).to.equal(3n * C);
    }
    expect(Number((await ajo.getCircle(id)).status)).to.equal(3);
    for (const m of order) {
      const before = await token.balanceOf(m.address);
      await ajo.connect(m).withdrawDeposit(id);
      expect((await token.balanceOf(m.address)) - before).to.equal(2n * C);
    }
  });

  it("lets a member leave an open circle and take the deposit back; the creator cannot", async () => {
    const ctx = await loadFixture(deploy);
    const { ajo, token, a, b } = ctx;
    const id = await open(ctx);
    const before = await token.balanceOf(b.address);
    await ajo.connect(b).join(id);
    expect(await token.balanceOf(b.address)).to.equal(before - 2n * C);
    await ajo.connect(b).leave(id);
    expect(await token.balanceOf(b.address)).to.equal(before);
    expect(await ajo.isMember(id, b.address)).to.equal(false);
    expect((await ajo.getMembers(id)).length).to.equal(1);
    await expect(ajo.connect(a).leave(id)).to.be.revertedWith("creator should cancel instead");
  });

  it("does not allow leaving once the circle is full", async () => {
    const ctx = await loadFixture(deploy);
    const id = await full(ctx);
    await expect(ctx.ajo.connect(ctx.b).leave(id)).to.be.revertedWith("not open");
  });

  it("lets the creator cancel before the draw and everyone gets the deposit back", async () => {
    const ctx = await loadFixture(deploy);
    const { ajo, token, a, b, c, stranger } = ctx;
    const id = await full(ctx);
    await expect(ajo.connect(stranger).cancel(id)).to.be.revertedWith("too early");
    await ajo.connect(a).cancel(id);
    expect(Number((await ajo.getCircle(id)).status)).to.equal(4);
    for (const m of [a, b, c]) {
      const before = await token.balanceOf(m.address);
      await ajo.connect(m).withdrawDeposit(id);
      expect((await token.balanceOf(m.address)) - before).to.equal(2n * C);
    }
  });

  it("cannot cancel a circle that has been drawn", async () => {
    const ctx = await loadFixture(deploy);
    const id = await active(ctx);
    await expect(ctx.ajo.connect(ctx.a).cancel(id)).to.be.revertedWith("cannot cancel");
  });

  it("runs the two-step fallback draw only after CRE has had its turn", async () => {
    const ctx = await loadFixture(deploy);
    const { ajo, owner, stranger } = ctx;
    const id = await full(ctx);
    await expect(ajo.connect(stranger).requestFallbackDraw(id)).to.be.revertedWith("CRE has not had its turn yet");
    await time.increase(601);
    await ajo.connect(stranger).requestFallbackDraw(id);
    await expect(ajo.connect(stranger).finishFallbackDraw(id)).to.be.revertedWith("not ready yet");
    await mine(3);
    await ajo.connect(stranger).finishFallbackDraw(id);

    const circle = await ajo.getCircle(id);
    expect(Number(circle.status)).to.equal(2);
    expect(Number(circle.drawnBy)).to.equal(2);
    const order = [...(await ajo.getOrder(id))].map((x) => x.toLowerCase()).sort();
    expect(order).to.deep.equal(addrs(ctx).map((x) => x.toLowerCase()).sort());
    await expect(ajo.connect(owner).setOrder(id, addrs(ctx), 1)).to.be.revertedWith("not ready for draw");
  });

  it("gives CRE (the drawer) the first go and records it", async () => {
    const ctx = await loadFixture(deploy);
    const { ajo, owner } = ctx;
    const id = await full(ctx);
    await ajo.connect(owner).setOrder(id, addrs(ctx), 5);
    expect(Number((await ajo.getCircle(id)).drawnBy)).to.equal(1);
    await time.increase(700);
    await expect(ajo.requestFallbackDraw(id)).to.be.revertedWith("not ready for draw");
  });

  it("lets the owner switch the fallback off, and only the owner", async () => {
    const ctx = await loadFixture(deploy);
    const { ajo, owner, stranger } = ctx;
    await expect(ajo.connect(stranger).setFallback(false, 600)).to.be.revertedWithCustomError(ajo, "OwnableUnauthorizedAccount");
    await ajo.connect(owner).setFallback(false, 600);
    const id = await full(ctx);
    await time.increase(700);
    await expect(ajo.requestFallbackDraw(id)).to.be.revertedWith("fallback off");
  });

  it("ends a running circle only when everyone agrees, refunding the open round", async () => {
    const ctx = await loadFixture(deploy);
    const { ajo, token, a, b, c, stranger } = ctx;
    const id = await active(ctx);
    await ajo.connect(a).contribute(id);
    await ajo.connect(b).contribute(id);

    await expect(ajo.connect(stranger).voteEnd(id)).to.be.revertedWith("not a member");
    await ajo.connect(a).voteEnd(id);
    await expect(ajo.connect(a).voteEnd(id)).to.be.revertedWith("already voted");
    await ajo.connect(a).retractEndVote(id);
    expect(await ajo.endVotes(id)).to.equal(0n);

    const balA = await token.balanceOf(a.address);
    const balB = await token.balanceOf(b.address);
    const balC = await token.balanceOf(c.address);
    await ajo.connect(a).voteEnd(id);
    await ajo.connect(b).voteEnd(id);
    expect(Number((await ajo.getCircle(id)).status)).to.equal(2);
    await ajo.connect(c).voteEnd(id);
    expect(Number((await ajo.getCircle(id)).status)).to.equal(5);

    expect((await token.balanceOf(a.address)) - balA).to.equal(C);
    expect((await token.balanceOf(b.address)) - balB).to.equal(C);
    expect(await token.balanceOf(c.address)).to.equal(balC);
    for (const m of [a, b, c]) {
      const before = await token.balanceOf(m.address);
      await ajo.connect(m).withdrawDeposit(id);
      expect((await token.balanceOf(m.address)) - before).to.equal(2n * C);
    }
  });

  it("pulls a share only from members who opted in, and skips anyone who cannot pay", async () => {
    const ctx = await loadFixture(deploy);
    const { ajo, ajoAddr, token, a, b, c, stranger } = ctx;
    const id = await active(ctx);
    await ajo.connect(b).setAutopay(id, true);
    await ajo.connect(c).setAutopay(id, true);
    await expect(ajo.connect(stranger).pullFor(id, a.address)).to.be.revertedWith("autopay off");

    await token.connect(c).approve(ajoAddr, 0);
    const balB = await token.balanceOf(b.address);
    await ajo.connect(stranger).pullAll(id);
    expect(await ajo.paid(id, 1, b.address)).to.equal(true);
    expect(await ajo.paid(id, 1, c.address)).to.equal(false);
    expect(await ajo.paid(id, 1, a.address)).to.equal(false);
    expect(balB - (await token.balanceOf(b.address))).to.equal(C);
    await expect(ajo.pullFor(id, b.address)).to.be.revertedWith("already paid");

    await token.connect(c).approve(ajoAddr, ethers.MaxUint256);
    await ajo.connect(stranger).pullAll(id);
    expect(await ajo.paid(id, 1, c.address)).to.equal(true);
  });

  it("returns everything the app needs in one call", async () => {
    const ctx = await loadFixture(deploy);
    const { ajo, a, stranger } = ctx;
    await full(ctx);
    const mine = await ajo.overview(a.address, 5);
    expect(mine.length).to.equal(1);
    expect(mine[0].name).to.equal("Test");
    expect(mine[0].isMember).to.equal(true);
    expect(Number(mine[0].status)).to.equal(1);
    expect(mine[0].members.length).to.equal(3);
    const theirs = await ajo.overview(stranger.address, 5);
    expect(theirs[0].isMember).to.equal(false);
  });
});

describe("AjoKeeperV2", () => {
  it("draws and pulls auto-pay shares only on reports from the forwarder", async () => {
    const ctx = await loadFixture(deploy);
    const { owner, b, stranger, fwd, ajo, ajoAddr } = ctx;
    const keeper = await (await ethers.getContractFactory("AjoKeeperV2")).deploy(ajoAddr, fwd.address);
    await ajo.connect(owner).setDrawer(await keeper.getAddress(), true);
    const id = await full(ctx);
    await keeper.connect(fwd).onReport("0x", report(2, id, addrs(ctx), 42));
    expect(Number((await ajo.getCircle(id)).drawnBy)).to.equal(1);

    await ajo.connect(b).setAutopay(id, true);
    await keeper.connect(fwd).onReport("0x", report(3, id, [], 0));
    expect(await ajo.paid(id, 1, b.address)).to.equal(true);

    await expect(keeper.connect(stranger).onReport("0x", report(3, id, [], 0))).to.be.revertedWithCustomError(keeper, "InvalidSender");
  });

  it("can be pinned to one workflow", async () => {
    const ctx = await loadFixture(deploy);
    const { owner, fwd, ajo, ajoAddr } = ctx;
    const keeper = await (await ethers.getContractFactory("AjoKeeperV2")).deploy(ajoAddr, fwd.address);
    await ajo.connect(owner).setDrawer(await keeper.getAddress(), true);
    const id = await full(ctx);
    const rep = report(2, id, addrs(ctx), 9);

    const WID = ethers.id("cowrie-ajo-workflow");
    await keeper.connect(owner).setExpectedWorkflowId(WID);
    await expect(keeper.connect(fwd).onReport("0x", rep)).to.be.revertedWithCustomError(keeper, "WrongWorkflow");
    await keeper.connect(fwd).onReport(ethers.concat([WID, ethers.ZeroHash]), rep);
    expect(Number((await ajo.getCircle(id)).status)).to.equal(2);
  });
});
