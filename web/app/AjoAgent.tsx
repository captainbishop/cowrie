"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef } from "react";
import { parseAbi } from "viem";
import { ajoAbi, AJO_ADDRESS } from "../lib/ajo";
import { addresses } from "../lib/contracts";

const tokenAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);
const vaultDepositAbi = parseAbi(["function deposit(uint256 amount)"]);
const MAX = 2n ** 256n - 1n;

export type AjoPending = { kind: "pay" | "join" | "withdraw" | "move"; id?: number; until: number };
export type AjoCommand = { what: "pay" | "join" | "withdraw" | "move" | "status"; name?: string; stamp: number };
export type AjoExec = { kind: AjoPending["kind"]; id?: number; stamp: number };

type Snap = {
  id: number;
  name: string;
  contribution: bigint;
  deposit: bigint;
  maxMembers: number;
  round: number;
  status: number;
  members: string[];
  order: string[];
  mine: boolean;
  joinable: boolean;
  paidNow: boolean;
  myDeposit: bigint;
  endsAt: number;
};

function dur(s: number): string {
  if (s >= 86400) return `${Math.floor(s / 86400)} days`;
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  if (s >= 60) return `${Math.floor(s / 60)} min`;
  return `${Math.max(0, s)} sec`;
}

type Props = {
  addr: `0x${string}`;
  publicClient: any;
  run: (fn: string, args: unknown[], ui?: any, target?: any) => Promise<string>;
  busy: boolean;
  setBusy: (b: boolean) => void;
  errText: (e: unknown) => string;
  fmt: (v: bigint) => string;
  spendable: bigint;
  book: { name: string; address: string }[];
  say: (m: any) => void;
  notify: (title: string, body: string, id?: string) => void;
  setPending: (p: AjoPending | null) => void;
  command: AjoCommand | null;
  exec: AjoExec | null;
  refresh: () => Promise<unknown> | void;
};

// Runs in the background: watches the user's Ajo circles, raises alerts, and carries out chat commands.
export default function AjoAgent(props: Props) {
  const { addr, publicClient, command, exec } = props;
  const api = useRef<Props>(props);
  api.current = props;
  const me = addr.toLowerCase();

  const read = useCallback(
    (functionName: string, args: unknown[]) => publicClient.readContract({ address: AJO_ADDRESS, abi: ajoAbi, functionName, args }),
    [publicClient],
  );

  const snapshot = useCallback(async () => {
    const [b, countRaw] = await Promise.all([
      publicClient.readContract({ address: addresses.usd, abi: tokenAbi, functionName: "balanceOf", args: [addr] }),
      read("circleCount", []),
    ]);
    const nowSec = Math.floor(Date.now() / 1000);
    const ids: number[] = [];
    for (let i = Number(countRaw); i >= 1 && ids.length < 8; i--) ids.push(i);
    const rows = await Promise.all(
      ids.map(async (i): Promise<Snap | null> => {
        const id = BigInt(i);
        const c: any = await read("getCircle", [id]);
        const members: string[] = [...c.members];
        const mine = members.some((m) => m.toLowerCase() === me);
        const status = Number(c.status);
        let joinable = false;
        if (!mine && status === 0 && Number(c.joinDeadline) > nowSec) {
          joinable = true;
          if (c.inviteOnly) joinable = (await read("isInvited", [id, addr])) as boolean;
        }
        if (!mine && !joinable) return null;
        let paidNow = false;
        let myDeposit = 0n;
        let endsAt = 0;
        if (mine) {
          myDeposit = (await read("depositOf", [id, addr])) as bigint;
          if (status === 2) {
            const [p, e] = await Promise.all([read("paid", [id, Number(c.round), addr]), read("roundEnd", [id])]);
            paidNow = p as boolean;
            endsAt = Number(e);
          }
        }
        return {
          id: i, name: c.name, contribution: c.contribution, deposit: c.deposit, maxMembers: Number(c.maxMembers),
          round: Number(c.round), status, members, order: [...c.order], mine, joinable, paidNow, myDeposit, endsAt,
        };
      }),
    );
    return { snaps: rows.filter((x): x is Snap => x !== null), bal: b as bigint };
  }, [addr, publicClient, read, me]);

  const who = (a: string) => {
    if (a.toLowerCase() === me) return "you";
    const c = api.current.book.find((b) => b.address.toLowerCase() === a.toLowerCase());
    return c ? c.name : `${a.slice(0, 6)}...${a.slice(-4)}`;
  };

  // Make sure the wallet holds `amount` (moving any shortfall out of spendable) and the Ajo contract may take it.
  const fund = async (amount: bigint) => {
    const A = api.current;
    const have = (await publicClient.readContract({ address: addresses.usd, abi: tokenAbi, functionName: "balanceOf", args: [addr] })) as bigint;
    if (have < amount) {
      const shortBy = amount - have;
      if (A.spendable < shortBy) throw new Error(`You need ${A.fmt(amount)} but only have ${A.fmt(A.spendable + have)}.`);
      await A.run("withdraw", [shortBy], { title: "Move money for your Ajo", description: `${A.fmt(shortBy)} from spendable to your wallet.`, successHeader: "Moved", buttonText: "Move" });
    }
    const allowed = (await publicClient.readContract({ address: addresses.usd, abi: tokenAbi, functionName: "allowance", args: [addr, AJO_ADDRESS] })) as bigint;
    if (allowed < amount) {
      await A.run("approve", [AJO_ADDRESS, MAX], { title: "Allow Cowrie Ajo", description: "Lets the Ajo contract take your deposit and your round payments.", successHeader: "Allowed", buttonText: "Allow" }, { address: addresses.usd, abi: tokenAbi });
    }
  };

  // 1. Background watch: alerts that say what to do next.
  useEffect(() => {
    if (!AJO_ADDRESS) return;
    let on = true;
    const tick = async () => {
      try {
        const { snaps } = await snapshot();
        if (!on) return;
        const { say, notify, setPending, fmt } = api.current;
        const nowSec = Math.floor(Date.now() / 1000);
        const tag = AJO_ADDRESS.slice(2, 8);
        const store = "cowrie.ajo.seen." + me;
        let seen: { said?: string[]; rounds?: Record<string, number> } = {};
        try { seen = JSON.parse(localStorage.getItem(store) || "{}"); } catch {}
        const said = new Set<string>(seen.said || []);
        const rounds: Record<string, number> = seen.rounds || {};
        const tell = (key: string, title: string, body: string, text: string, options?: string[], pend?: AjoPending) => {
          const k = `${tag}-${key}`;
          if (said.has(k)) return;
          said.add(k);
          notify(title, body, "ajo-" + k);
          say({ who: "cowrie", tone: "good", text, options });
          if (pend) setPending(pend);
        };
        for (const s of snaps) {
          if (!s.mine) continue;
          const rk = `${tag}-${s.id}`;
          if (s.status === 2 && !s.paidNow) {
            const left = s.endsAt - nowSec;
            if (left > 0 && left <= 120) {
              tell(`two-${s.id}-${s.round}`, `Ajo "${s.name}": 2 minutes left`, `Pay ${fmt(s.contribution)} before the round ends.`,
                `Only ${dur(left)} left to pay ${fmt(s.contribution)} into "${s.name}" for round ${s.round}. Pay now?`,
                ["Yes, pay", "Not now"], { kind: "pay", id: s.id, until: s.endsAt * 1000 });
            } else if (left > 120) {
              tell(`open-${s.id}-${s.round}`, `Ajo "${s.name}": round ${s.round} is open`, `Pay ${fmt(s.contribution)} before it ends.`,
                `Round ${s.round} of "${s.name}" is open. Pay ${fmt(s.contribution)} before it ends in ${dur(left)}?`,
                ["Yes, pay", "Not now"], { kind: "pay", id: s.id, until: s.endsAt * 1000 });
            }
          }
          const cur = s.status === 3 ? s.members.length + 1 : s.status === 2 ? s.round : 0;
          const last = rounds[rk];
          if (last !== undefined && cur > last && s.order.length) {
            for (let r = Math.max(1, last); r < cur && r <= s.members.length; r++) {
              if (s.order[r - 1]?.toLowerCase() === me) {
                const pot = fmt(s.contribution * BigInt(s.members.length));
                tell(`got-${s.id}-${r}`, `You collected ${pot} from "${s.name}"`, "It is in your wallet. Move it to spendable.",
                  `You collected the ${pot} pot from "${s.name}". It is waiting in your wallet. Move it to spendable now?`,
                  ["Yes, move it", "Not now"], { kind: "move", until: Date.now() + 3600000 });
              }
            }
          }
          if (cur > 0) rounds[rk] = cur;
          if ((s.status === 3 || s.status === 4) && s.myDeposit > 0n) {
            tell(`done-${s.id}`, `Ajo "${s.name}" is ${s.status === 3 ? "complete" : "cancelled"}`, `Withdraw your ${fmt(s.myDeposit)} deposit.`,
              `"${s.name}" is ${s.status === 3 ? "complete" : "cancelled"}. Your ${fmt(s.myDeposit)} deposit is ready to withdraw. Withdraw it now?`,
              ["Yes, withdraw", "Not now"], { kind: "withdraw", id: s.id, until: Date.now() + 3600000 });
          }
        }
        try { localStorage.setItem(store, JSON.stringify({ said: [...said].slice(-300), rounds })); } catch {}
      } catch {}
    };
    tick();
    const t = setInterval(tick, 15000);
    return () => { on = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr, snapshot]);

  // 2. Chat commands: work out what the user means and ask for one confirmation.
  useEffect(() => {
    if (!command) return;
    (async () => {
      const { say, setPending, fmt, errText } = api.current;
      try {
        const { snaps, bal } = await snapshot();
        const nowSec = Math.floor(Date.now() / 1000);
        const nm = (command.name || "").toLowerCase();
        const pickBy = (list: Snap[]) => {
          const f = nm ? list.filter((s) => s.name.toLowerCase().includes(nm)) : list;
          return f.length ? f : list;
        };
        if (command.what === "status") {
          const mine = snaps.filter((s) => s.mine && s.status <= 2);
          if (mine.length === 0 && bal === 0n) { say({ who: "cowrie", text: "You are not in an on-chain Ajo right now. Say \"start an ajo\" to begin one." }); return; }
          for (const s of mine) {
            let line = `"${s.name}": `;
            if (s.status === 0) line += `waiting for members (${s.members.length}/${s.maxMembers}).`;
            else if (s.status === 1) line += "everyone is in, waiting for the fair draw.";
            else {
              const left = s.endsAt - nowSec;
              line += `round ${s.round} of ${s.members.length}. ${who(s.order[s.round - 1] || "")} collects this round. `;
              line += s.paidNow ? "You have paid. " : left > 0 ? `You still need to pay ${fmt(s.contribution)}. ` : "";
              line += left > 0 ? `It ends in ${dur(left)}.` : "Time is up, the automatic payout is on its way.";
            }
            say({ who: "cowrie", text: line });
          }
          if (bal > 0n) say({ who: "cowrie", text: `${fmt(bal)} is waiting in your wallet. Say "move my ajo money" to put it in spendable.` });
          return;
        }
        if (command.what === "pay") {
          const due = pickBy(snaps.filter((s) => s.mine && s.status === 2 && !s.paidNow && s.endsAt > nowSec));
          if (due.length === 0) {
            const active = snaps.some((s) => s.mine && s.status === 2);
            say({ who: "cowrie", text: active ? "You are all paid up for this round." : "You have no round waiting for a payment right now." });
            return;
          }
          if (due.length > 1) { say({ who: "cowrie", text: "Which circle?", options: due.map((s) => `Pay ${s.name} ajo`) }); return; }
          const s = due[0];
          setPending({ kind: "pay", id: s.id, until: s.endsAt * 1000 });
          say({ who: "cowrie", text: `Pay ${fmt(s.contribution)} into "${s.name}" for round ${s.round}? The round ends in ${dur(s.endsAt - nowSec)}.`, options: ["Yes, pay", "Not now"] });
          return;
        }
        if (command.what === "join") {
          const open = pickBy(snaps.filter((s) => s.joinable));
          if (open.length === 0) { say({ who: "cowrie", text: "I do not see a circle you can join. Ask the person who started it to invite you, then try again." }); return; }
          if (open.length > 1) { say({ who: "cowrie", text: "Which circle?", options: open.map((s) => `Join ${s.name} ajo`) }); return; }
          const s = open[0];
          setPending({ kind: "join", id: s.id, until: Date.now() + 600000 });
          say({ who: "cowrie", text: `Join "${s.name}"? You lock a ${fmt(s.deposit)} deposit, which comes back at the end minus any payment you miss, and you pay ${fmt(s.contribution)} each round.`, options: ["Yes, join", "Not now"] });
          return;
        }
        if (command.what === "withdraw") {
          const done = pickBy(snaps.filter((s) => s.mine && (s.status === 3 || s.status === 4) && s.myDeposit > 0n));
          if (done.length === 0) { say({ who: "cowrie", text: "You have no Ajo deposit ready to withdraw. Deposits come back once a circle is complete." }); return; }
          if (done.length > 1) { say({ who: "cowrie", text: "Which circle?", options: done.map((s) => `Withdraw ${s.name} ajo deposit`) }); return; }
          const s = done[0];
          setPending({ kind: "withdraw", id: s.id, until: Date.now() + 600000 });
          say({ who: "cowrie", text: `Withdraw your ${fmt(s.myDeposit)} deposit from "${s.name}"?`, options: ["Yes, withdraw", "Not now"] });
          return;
        }
        if (command.what === "move") {
          if (bal <= 0n) { say({ who: "cowrie", text: "There is nothing waiting in your wallet." }); return; }
          setPending({ kind: "move", until: Date.now() + 600000 });
          say({ who: "cowrie", text: `Move ${fmt(bal)} from your wallet to your spendable balance?`, options: ["Yes, move it", "Not now"] });
        }
      } catch (e) {
        say({ who: "cowrie", tone: "bad", text: errText(e) });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.stamp]);

  // 3. The confirmed action: do it.
  useEffect(() => {
    if (!exec) return;
    (async () => {
      const A = api.current;
      if (A.busy) { A.say({ who: "cowrie", text: "One moment, I am still finishing the last action. Say yes again in a few seconds." }); return; }
      A.setBusy(true);
      try {
        const { snaps, bal } = await snapshot();
        const s = snaps.find((z) => z.id === exec.id);
        const target = { address: AJO_ADDRESS, abi: ajoAbi };
        if (exec.kind === "pay") {
          if (!s || s.status !== 2 || s.paidNow || s.endsAt * 1000 < Date.now()) throw new Error("That round is no longer open for payment.");
          await fund(s.contribution);
          await A.run("contribute", [BigInt(s.id)], { title: `Pay "${s.name}"`, description: `${A.fmt(s.contribution)} for round ${s.round}.`, successHeader: "Paid", buttonText: "Pay" }, target);
          A.say({ who: "cowrie", tone: "good", text: `Paid ${A.fmt(s.contribution)} into "${s.name}" for round ${s.round}. The pot pays out automatically when the round ends.` });
        } else if (exec.kind === "join") {
          if (!s || !s.joinable) throw new Error("That circle is no longer open to join.");
          await fund(s.deposit);
          await A.run("join", [BigInt(s.id)], { title: `Join "${s.name}"`, description: `Locks a ${A.fmt(s.deposit)} deposit.`, successHeader: "Joined", buttonText: "Join" }, target);
          A.say({ who: "cowrie", tone: "good", text: `You are in "${s.name}". Your ${A.fmt(s.deposit)} deposit is locked and comes back at the end, minus any payment you miss.` });
        } else if (exec.kind === "withdraw") {
          if (!s || s.myDeposit <= 0n) throw new Error("There is no deposit to withdraw from that circle.");
          await A.run("withdrawDeposit", [BigInt(s.id)], { title: "Withdraw deposit", description: `${A.fmt(s.myDeposit)} back to your wallet.`, successHeader: "Withdrawn", buttonText: "Withdraw" }, target);
          A.say({ who: "cowrie", tone: "good", text: `Withdrew ${A.fmt(s.myDeposit)} from "${s.name}" into your wallet. Move it to spendable now?`, options: ["Yes, move it", "Not now"] });
          A.setPending({ kind: "move", until: Date.now() + 600000 });
        } else if (exec.kind === "move") {
          if (bal <= 0n) throw new Error("There is nothing in your wallet to move.");
          const allowed = (await publicClient.readContract({ address: addresses.usd, abi: tokenAbi, functionName: "allowance", args: [addr, addresses.vault] })) as bigint;
          if (allowed < bal) {
            await A.run("approve", [addresses.vault, MAX], { title: "Allow Cowrie", description: "Lets Cowrie move your Ajo money back into spendable.", successHeader: "Allowed", buttonText: "Allow" }, { address: addresses.usd, abi: tokenAbi });
          }
          await A.run("deposit", [bal], { title: "Move to spendable", description: `${A.fmt(bal)} back to your spendable balance.`, successHeader: "Moved", buttonText: "Move" }, { address: addresses.vault, abi: vaultDepositAbi });
          A.say({ who: "cowrie", tone: "good", text: `Moved ${A.fmt(bal)} to your spendable balance.` });
        }
        await A.refresh();
      } catch (e) {
        A.say({ who: "cowrie", tone: "bad", text: A.errText(e) });
      } finally {
        A.setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exec?.stamp]);

  return null;
}
