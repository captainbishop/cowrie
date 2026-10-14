const hre = require("hardhat");
const fs = require("fs");

// Seeds a reliable demo: funds your vault, flags a scam address, enables 10% auto-save.
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const d = JSON.parse(fs.readFileSync("deployments.json", "utf8"));
  const vault = await hre.ethers.getContractAt("PolicyVault", d.PolicyVault);
  const scam = await hre.ethers.getContractAt("ScamRegistry", d.ScamRegistry);
  const usd = await hre.ethers.getContractAt("MockUSD", d.MockUSD);

  const ONE = 1_000_000n; // 1 cUSD (6 decimals)

  let tx = await vault.mintAndDeposit(500n * ONE);
  await tx.wait();
  console.log("Minted 500 cUSD into your vault balance");

  const SCAM = "0x000000000000000000000000000000000000dEaD";
  tx = await scam.setFlag(SCAM, true);
  await tx.wait();
  console.log("Flagged demo scam address:", SCAM);

  tx = await vault.setAutosave(1000); // 10.00%
  await tx.wait();
  console.log("Auto-save set to 10%");

  // seed a few swap pools so the in-app DEX has real liquidity to trade against
  const assets = [
    { name: "Cowrie BTC", symbol: "cBTC", dec: 18, priceCusd: 60000n, tok: 10n },
    { name: "Cowrie ETH", symbol: "cETH", dec: 18, priceCusd: 3000n, tok: 100n },
    { name: "Cowrie Gold", symbol: "cGOLD", dec: 18, priceCusd: 2000n, tok: 100n },
  ];
  const AssetFactory = await hre.ethers.getContractFactory("MockAsset");
  const existing = new Set();
  const already = Number(await vault.listedTokensCount());
  for (let i = 0; i < already; i++) {
    try { const prev = await hre.ethers.getContractAt("MockAsset", await vault.listedTokens(i)); existing.add((await prev.symbol()).toLowerCase()); } catch {}
  }
  for (const a of assets) {
    if (existing.has(a.symbol.toLowerCase())) { console.log(`${a.symbol} pool already there, skipping`); continue; }
    const asset = await AssetFactory.deploy(a.name, a.symbol, a.dec);
    await asset.waitForDeployment();
    const addr = await asset.getAddress();
    const tokReserve = a.tok * 10n ** BigInt(a.dec);
    const cusdReserve = a.priceCusd * a.tok * ONE;
    await (await asset.mint(deployer.address, tokReserve)).wait();
    await (await usd.mint(deployer.address, cusdReserve)).wait();
    await (await asset.approve(d.PolicyVault, tokReserve)).wait();
    await (await usd.approve(d.PolicyVault, cusdReserve)).wait();
    await (await vault.seedPool(addr, cusdReserve, tokReserve)).wait();
    console.log(`Seeded ${a.symbol} pool (${a.priceCusd} cUSD each) at`, addr);
  }

  const mc = Number(await vault.marketsCount());
  if (mc === 0) {
    await (await vault.mintAndDeposit(200n * ONE)).wait();
    const questions = ["Will Bitcoin close above $100k this year?", "Will the Super Eagles win their next match?"];
    const close = Math.floor(Date.now() / 1000) + 30 * 86400;
    for (let i = 0; i < questions.length; i++) {
      await (await vault.createMarket(questions[i], close)).wait();
      await (await vault.predict(i, true, 20n * ONE)).wait();
      await (await vault.predict(i, false, 20n * ONE)).wait();
      console.log(`Seeded market ${i}: ${questions[i]}`);
    }
  } else {
    console.log("prediction markets already seeded, skipping");
  }

  console.log("\nSeed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
