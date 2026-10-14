// Sends a little test MON gas to your app's login wallet, so it can transact.
// The Privy wallet you sign in with starts empty; this tops it up.
// Run:  node scripts/fund.js 0xYourPrivyAddress
require("dotenv").config();
const { ethers } = require("ethers");

const AMOUNT = process.env.FUND_MON || "0.5";

async function main() {
  const to = process.argv[2];
  if (!to || !/^0x[a-fA-F0-9]{40}$/.test(to)) {
    console.log("\nUsage:  node scripts/fund.js 0xYourPrivyAddress\n");
    console.log("Sign in to the app, tap the address at the bottom of the screen to copy it, then run this.\n");
    process.exit(1);
  }
  const provider = new ethers.JsonRpcProvider(process.env.MONAD_RPC || "https://testnet-rpc.monad.xyz", 10143);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const mine = await provider.getBalance(wallet.address);
  console.log("Funding from:", wallet.address, "(" + ethers.formatEther(mine) + " MON)");
  if (mine < ethers.parseEther(AMOUNT)) {
    console.log("Not enough MON. Top up at https://faucet.monad.xyz");
    process.exit(1);
  }

  const tx = await wallet.sendTransaction({ to, value: ethers.parseEther(AMOUNT) });
  console.log("Sent", AMOUNT, "MON ->", to);
  console.log("tx:", tx.hash);
  await tx.wait();
  const bal = await provider.getBalance(to);
  console.log("Done. That wallet now holds", ethers.formatEther(bal), "MON and can pay its own fees.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exitCode = 1;
});
