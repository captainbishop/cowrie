const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const U = 10n ** 6n;
const C = 100n * U;
const PERIOD = 3600;

const coder = ethers.AbiCoder.defaultAbiCoder();
const report = (action, id, order, seed) =>
  coder.encode(["uint8", "uint256", "address[]", "uint256"], [action, id, order, seed]);

async function deploy() {
  const [owner, fwd, a, b, c, d, stranger] = await ethers.getSigners();
  const token = await (await ethers.getContractFactory("MockUSD")).deploy();
  const ajo = await (await ethers.getContractFactory("AjoCircle")).deploy(await token.getAddress(), owner.address);
  const keeper = await (await ethers.getContractFactory("AjoKeeper")).deploy(await ajo.getAddress(), fwd.address);
  await ajo.setDrawer(await keeper.getAddress());

  const members = [a, b, c, d];
  for (const m of members) {
    await token.mint(m.address, 10000n * U);
    await token.connect(m).approve(await ajo.getAddress(), ethers.MaxUint256);
  }
  const now = await time.latest();
  await ajo.connect(a).createCircle("Family Ajo", C, 2n * C, PERIOD, now + 86400, 4);
  for (const m of members.slice(1)) await ajo.connect(m).join(1);
  return { owner, fwd, members, stranger, token, ajo, keeper };
}

describe("AjoKeeper", () => {
  it("records the draw when the forwarder sends it", async () => {
    const { fwd, members, ajo, keeper } = await loadFixture(deploy);
    const order = [members[2], members[0], members[3], members[1]].map((m) => m.address);
    await keeper.connect(fwd).onReport("0x", report(2, 1, order, 777));

    const circle = await ajo.getCircle(1);
    expect(Number(circle.status)).to.equal(2); // Active
    expect(await ajo.getOrder(1)).to.deep.equal(order);
  });

  it("settles a round when the timer ends, paying the collector", async () => {
    const { fwd, members, token, ajo, keeper } = await loadFixture(deploy);
    const order = [members[2], members[0], members[3], members[1]];
    await keeper.connect(fwd).onReport("0x", report(2, 1, order.map((m) => m.address), 777));

    for (const m of members) await ajo.connect(m).contribute(1);

    // too early: the settle report is rejected
    await expect(keeper.connect(fwd).onReport("0x", report(1, 1, [], 0))).to.be.revertedWith("round not over");

    await time.increaseTo(Number(await ajo.roundEnd(1, 1)));
    const before = await token.balanceOf(order[0].address);
    await keeper.connect(fwd).onReport("0x", report(1, 1, [], 0));
    expect((await token.balanceOf(order[0].address)) - before).to.equal(4n * C);
  });

  it("rejects anyone who is not the forwarder", async () => {
    const { stranger, members, keeper } = await loadFixture(deploy);
    const order = members.map((m) => m.address);
    await expect(keeper.connect(stranger).onReport("0x", report(2, 1, order, 1))).to.be.revertedWithCustomError(keeper, "InvalidSender");
  });

  it("rejects an unknown action", async () => {
    const { fwd, keeper } = await loadFixture(deploy);
    await expect(keeper.connect(fwd).onReport("0x", report(9, 1, [], 0))).to.be.revertedWithCustomError(keeper, "UnknownAction");
  });

  it("only the owner can change the forwarder", async () => {
    const { stranger, owner, keeper } = await loadFixture(deploy);
    await expect(keeper.connect(stranger).setForwarder(stranger.address)).to.be.revertedWithCustomError(keeper, "OwnableUnauthorizedAccount");
    await keeper.connect(owner).setForwarder(stranger.address);
    expect(await keeper.forwarder()).to.equal(stranger.address);
  });
});