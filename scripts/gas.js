const hre = require("hardhat");
async function main() {
  const { ethers } = hre;
  const [d] = await ethers.getSigners();
  console.log("Wallet that pays for CRE runs:", d.address, ethers.formatEther(await ethers.provider.getBalance(d.address)), "MON");
}
main();
