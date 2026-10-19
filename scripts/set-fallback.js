const hre = require("hardhat");
const fs = require("fs");

// Put one word in the file .fallback-mode, then run this script:
//   demo   = fallback draw allowed after 2 minutes (for live demos)
//   normal = after 10 minutes (the default)
//   off    = fallback disabled, CRE only
// With no file it just prints the current setting.
async function main() {
  const { ethers } = hre;
  const dep = JSON.parse(fs.readFileSync("deployments.json", "utf8"));
  const ajo = await ethers.getContractAt("AjoCircleV2", dep.AjoCircleV2);
  const mode = fs.existsSync(".fallback-mode") ? fs.readFileSync(".fallback-mode", "utf8").trim() : "status";
  if (mode === "demo") await (await ajo.setFallback(true, 120)).wait();
  else if (mode === "normal") await (await ajo.setFallback(true, 600)).wait();
  else if (mode === "off") await (await ajo.setFallback(false, 600)).wait();
  console.log("Fallback enabled:", await ajo.fallbackEnabled(), "| delay (seconds):", String(await ajo.fallbackDelay()));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
