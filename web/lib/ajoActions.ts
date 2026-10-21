/* eslint-disable @typescript-eslint/no-explicit-any */
import { parseAbi } from "viem";
import { ajoAbi, AJO_ADDRESS } from "./ajo";
import { addresses } from "./contracts";

export const tokenAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);
export const vaultDepositAbi = parseAbi(["function deposit(uint256 amount)"]);
export const MAX = 2n ** 256n - 1n;

export type Ctx = {
  addr: `0x${string}`;
  publicClient: any;
  run: (fn: string, args: unknown[], ui?: any, target?: any) => Promise<string>;
  spendable: bigint;
  fmt: (v: bigint) => string;
};

export const ajoTarget = () => ({ address: AJO_ADDRESS, abi: ajoAbi });

/** Makes sure the wallet holds `amount` (moving any shortfall out of spendable) and the Ajo contract may take it. */
export async function fundWallet(ctx: Ctx, amount: bigint): Promise<void> {
  const have = (await ctx.publicClient.readContract({ address: addresses.usd, abi: tokenAbi, functionName: "balanceOf", args: [ctx.addr] })) as bigint;
  if (have < amount) {
    const short = amount - have;
    if (ctx.spendable < short) throw new Error(`You need ${ctx.fmt(amount)} but only have ${ctx.fmt(ctx.spendable + have)}`);
    await ctx.run("withdraw", [short], { title: "Move money for your Ajo", description: `${ctx.fmt(short)} from spendable to your wallet.`, successHeader: "Moved", buttonText: "Move" });
  }
  const allowed = (await ctx.publicClient.readContract({ address: addresses.usd, abi: tokenAbi, functionName: "allowance", args: [ctx.addr, AJO_ADDRESS] })) as bigint;
  if (allowed < amount) {
    await ctx.run("approve", [AJO_ADDRESS, MAX], { title: "Allow Cowrie Ajo", description: "Lets the Ajo contract take your deposit and your round payments.", successHeader: "Allowed", buttonText: "Allow" }, { address: addresses.usd, abi: tokenAbi });
  }
}

/** Moves everything waiting in the wallet back into spendable. Returns the amount moved. */
export async function moveToSpendable(ctx: Ctx): Promise<bigint> {
  const have = (await ctx.publicClient.readContract({ address: addresses.usd, abi: tokenAbi, functionName: "balanceOf", args: [ctx.addr] })) as bigint;
  if (have <= 0n) return 0n;
  const allowed = (await ctx.publicClient.readContract({ address: addresses.usd, abi: tokenAbi, functionName: "allowance", args: [ctx.addr, addresses.vault] })) as bigint;
  if (allowed < have) {
    await ctx.run("approve", [addresses.vault, MAX], { title: "Allow Cowrie", description: "Lets Cowrie move your Ajo money back into spendable.", successHeader: "Allowed", buttonText: "Allow" }, { address: addresses.usd, abi: tokenAbi });
  }
  await ctx.run("deposit", [have], { title: "Move to spendable", description: `${ctx.fmt(have)} back to your spendable balance.`, successHeader: "Moved", buttonText: "Move" }, { address: addresses.vault, abi: vaultDepositAbi });
  return have;
}

/** The on-chain backup draw, in its two steps. */
export async function backupDraw(ctx: Ctx, id: number): Promise<void> {
  const t = ajoTarget();
  await ctx.run("requestFallbackDraw", [BigInt(id)], { title: "Backup draw, step 1 of 2", description: "Asks the contract to draw from a block hash nobody could know in advance.", successHeader: "Requested", buttonText: "Request" }, t);
  for (let i = 0; i < 30; i++) {
    const [bn, target] = await Promise.all([
      ctx.publicClient.getBlockNumber(),
      ctx.publicClient.readContract({ address: AJO_ADDRESS, abi: ajoAbi, functionName: "fallbackBlock", args: [BigInt(id)] }),
    ]);
    if ((bn as bigint) > (target as bigint)) break;
    await new Promise((r) => setTimeout(r, 700));
  }
  await ctx.run("finishFallbackDraw", [BigInt(id)], { title: "Backup draw, step 2 of 2", description: "Records the payout order.", successHeader: "Drawn", buttonText: "Finish" }, t);
}

/** Moves `amount` (at most what the wallet holds) back into spendable. Returns the amount moved. */
export async function moveSome(ctx: Ctx, amount: bigint): Promise<bigint> {
  const have = (await ctx.publicClient.readContract({ address: addresses.usd, abi: tokenAbi, functionName: "balanceOf", args: [ctx.addr] })) as bigint;
  const amt = amount > have ? have : amount;
  if (amt <= 0n) return 0n;
  const allowed = (await ctx.publicClient.readContract({ address: addresses.usd, abi: tokenAbi, functionName: "allowance", args: [ctx.addr, addresses.vault] })) as bigint;
  if (allowed < amt) {
    await ctx.run("approve", [addresses.vault, MAX], { title: "Allow Cowrie", description: "Lets Cowrie move your Ajo money back into spendable.", successHeader: "Allowed", buttonText: "Allow" }, { address: addresses.usd, abi: tokenAbi });
  }
  await ctx.run("deposit", [amt], { title: "Move to spendable", description: `${ctx.fmt(amt)} back to your spendable balance.`, successHeader: "Moved", buttonText: "Move" }, { address: addresses.vault, abi: vaultDepositAbi });
  return amt;
}
