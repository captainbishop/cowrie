const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const U = 10n ** 6n;
const C = 100n * U;
const PERIOD = 3600;

async function deploy() {
  const [owner, a, b, c, stranger] = await ethers.getSigners();
  const token = await (await ethers.getContractFactory("MockUSD")).deploy();
  const ajo = await (await ethers.getContractFactory("AjoCircle")).deploy(await token.getAddress(), owner.address);
  for (const m of [a, b, c, stranger]) {
    await token.mint(m.address, 10000n * U);
    await token.connect(m).approve(await ajo.getAddress(), ethers.MaxUint256);
  }
  return { owner, a, b, c, stranger, token, ajo };
}

async function invitedCircle(ctx, invited) {
  const now = await time.latest();
  const p = { name: "Office Thrift", contribution: C, deposit: 2n * C, period: PERIOD, joinDeadline: now + 86400, maxMembers: 3 };
  await ctx.ajo.connect(ctx.a).createInviteOnlyCircle(p, invited);
  return 1n;
}

describe("AjoCircle invite-only", () => {
  it("puts the creator in and flags the circle as invite-only", async () => {
    const ctx = await loadFixture(deploy);
    const id = await invitedCircle(ctx, [ctx.b.address, ctx.c.address]);
    expect(await ctx.ajo.isMember(id, ctx.a.address)).to.equal(true);
    expect((await ctx.ajo.getCircle(id)).inviteOnly).to.equal(true);
  });

  it("lets invited people join and turns everyone else away", async () => {
    const ctx = await loadFixture(deploy);
    const id = await invitedCircle(ctx, [ctx.b.address, ctx.c.address]);
    await expect(ctx.ajo.connect(ctx.stranger).join(id)).to.be.revertedWith("not invited");
    await ctx.ajo.connect(ctx.b).join(id);
    expect(await ctx.ajo.isMember(id, ctx.b.address)).to.equal(true);
  });

  it("closes to everyone once it is full, even invited people", async () => {
    const ctx = await loadFixture(deploy);
    const id = await invitedCircle(ctx, [ctx.b.address, ctx.c.address, ctx.stranger.address]);
    await ctx.ajo.connect(ctx.b).join(id);
    await ctx.ajo.connect(ctx.c).join(id); // 3 of 3: full
    await expect(ctx.ajo.connect(ctx.stranger).join(id)).to.be.revertedWith("not open");
  });

  it("lets only the creator invite more people while it is open", async () => {
    const ctx = await loadFixture(deploy);
    const id = await invitedCircle(ctx, [ctx.b.address]);
    await expect(ctx.ajo.connect(ctx.b).invite(id, [ctx.stranger.address])).to.be.revertedWith("not creator");
    await ctx.ajo.connect(ctx.a).invite(id, [ctx.stranger.address]);
    await ctx.ajo.connect(ctx.stranger).join(id);
    expect(await ctx.ajo.isMember(id, ctx.stranger.address)).to.equal(true);
  });

  it("rejects an empty invite list and inviting to an open circle", async () => {
    const ctx = await loadFixture(deploy);
    const now = await time.latest();
    const p = { name: "x", contribution: C, deposit: C, period: PERIOD, joinDeadline: now + 1000, maxMembers: 3 };
    await expect(ctx.ajo.connect(ctx.a).createInviteOnlyCircle(p, [])).to.be.revertedWith("bad invite list");
    await ctx.ajo.connect(ctx.a).createCircle("Open", C, 2n * C, PERIOD, now + 86400, 3);
    await expect(ctx.ajo.connect(ctx.a).invite(1, [ctx.b.address])).to.be.revertedWith("open to anyone");
  });

  it("keeps open circles open to anyone", async () => {
    const ctx = await loadFixture(deploy);
    const now = await time.latest();
    await ctx.ajo.connect(ctx.a).createCircle("Open", C, 2n * C, PERIOD, now + 86400, 3);
    await ctx.ajo.connect(ctx.stranger).join(1);
    expect(await ctx.ajo.isMember(1, ctx.stranger.address)).to.equal(true);
  });
});
