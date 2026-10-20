"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import { AJO_ADDRESS } from "../lib/ajo";
import { useAjo, refreshAjoNow, getAjoState, fmtDur, type Circle } from "../lib/ajoStore";
import { fundWallet, moveToSpendable, backupDraw, ajoTarget, type Ctx } from "../lib/ajoActions";

export type AjoPending = { kind: "pay" | "join" | "withdraw" | "move" | "backup"; id?: number; until: number };
export type AjoCommand = { what: "pay" | "join" | "withdraw" | "move" | "status"; name?: string; stamp: number };
export type AjoExec = { kind: AjoPending["kind"]; id?: number; stamp: number };

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
  setSummary: (s: { live: number; open: number; invited: number; done: number }) => void;
};

// Runs in the background: watches your circles, tells you what to do next, and carries out chat commands.
export default function AjoAgent(props: Props) {
  const { addr, publicClient, command, exec } = props;
  const api = useRef<Props>(props);
  api.current = props;
  const me = addr.toLowerCase();
  const st = useAjo(publicClient, addr, { fast: false });

  const who = (a: string) => (a.toLowerCase() === me ? "you" : api.current.book.find((b) => b.address.toLowerCase() === a.toLowerCase())?.name || `${a.slice(0, 6)}...${a.slice(-4)}`);
  const ctxNow = (): Ctx => ({ addr, publicClient, run: api.current.run, spendable: api.current.spendable, fmt: api.current.fmt });
  const joinable = (c: Circle, nowSec: number) => !c.isMember && c.status === 0 && c.joinDeadline > nowSec && (!c.inviteOnly || c.isInvited);

  // 1. Alerts that say what to do next.
  useEffect(() => {
    if (!st.loaded || !AJO_ADDRESS) return;
    const A = api.current;
    const fmt = A.fmt;
    const nowSec = Math.floor(Date.now() / 1000);
    const tag = AJO_ADDRESS.slice(2, 8);
    const store = `cowrie.ajo2.seen.${tag}.${me}`;
    let seen: { said?: string[]; last?: Record<string, { s: number; r: number; k: number }> } = {};
    try { seen = JSON.parse(localStorage.getItem(store) || "{}"); } catch {}
    const said = new Set<string>(seen.said || []);
    const last: Record<string, { s: number; r: number; k: number }> = seen.last || {};
    const tell = (key: string, title: string, body: string, text: string, options?: string[], pend?: AjoPending) => {
      const k = `${tag}-${key}`;
      if (said.has(k)) return;
      said.add(k);
      A.notify(title, body, "ajo-" + k);
      A.say({ who: "cowrie", tone: "good", text, options });
      if (pend) A.setPending(pend);
    };

    A.setSummary({
      live: st.circles.filter((c) => c.isMember && c.status === 2).length,
      open: st.circles.filter((c) => c.isMember && c.status <= 1).length,
      invited: st.circles.filter((c) => joinable(c, nowSec)).length,
      done: st.circles.filter((c) => c.isMember && c.status >= 3).length,
    });

    for (const c of st.circles) {
      if (!c.isMember) continue;
      const n = c.members.length;
      const prev = last[c.id];
      const settledTo = c.status === 3 ? n : c.status === 2 || c.status === 5 ? c.round - 1 : 0;

      // The order was just drawn.
      if (prev && prev.s === 1 && c.status === 2) {
        const order = c.order.map((a, i) => `${i + 1}. ${who(a)}`).join(", ");
        const pend: AjoPending | undefined = c.paidNow ? undefined : { kind: "pay", id: c.id, until: c.roundEndsAt * 1000 };
        tell(`drawn-${c.id}`, `"${c.name}": the order is drawn`, "Round 1 is open.",
          `The payout order for "${c.name}" is drawn ${c.drawnBy === 1 ? "by Chainlink CRE" : "by the on-chain backup"}: ${order}. Round 1 is open${c.paidNow ? "" : `, pay ${fmt(c.contribution)} before it ends in ${fmtDur(c.roundEndsAt - nowSec)}?`}`,
          pend ? ["Yes, pay", "Not now"] : undefined, pend);
        said.add(`${tag}-open-${c.id}-${c.round}`);
      }

      // A round is open and you have not paid.
      if (c.status === 2 && !c.paidNow) {
        const left = c.roundEndsAt - nowSec;
        const pend: AjoPending = { kind: "pay", id: c.id, until: c.roundEndsAt * 1000 };
        if (left > 0 && left <= 120) {
          tell(`two-${c.id}-${c.round}`, `"${c.name}": ${fmtDur(left)} left`, `Pay ${fmt(c.contribution)} before the round ends.`,
            `Only ${fmtDur(left)} left to pay ${fmt(c.contribution)} into "${c.name}" for round ${c.round}. Pay now?`, ["Yes, pay", "Not now"], pend);
        } else if (left > 120) {
          tell(`open-${c.id}-${c.round}`, `"${c.name}": round ${c.round} is open`, `Pay ${fmt(c.contribution)} before it ends.`,
            `Round ${c.round} of "${c.name}" is open. Pay ${fmt(c.contribution)} before it ends in ${fmtDur(left)}?`, ["Yes, pay", "Not now"], pend);
        }
      }

      // A round was settled since the last look.
      if (prev && prev.s === 2 && (c.round > prev.r || c.status === 3 || c.status === 5) && c.order.length) {
        const from = Math.max(1, prev.r);
        if (c.status !== 5) {
          for (let r = from; r <= settledTo; r++) {
            if (c.order[r - 1]?.toLowerCase() === me) {
              const pot = fmt(c.contribution * BigInt(n));
              tell(`got-${c.id}-${r}`, `You collected ${pot} from "${c.name}"`, "It is in your wallet. Move it to spendable.",
                `Round ${r} of "${c.name}" paid out. You collected the ${pot} pot and it is waiting in your wallet. Move it to spendable now?`,
                ["Yes, move it", "Not now"], { kind: "move", until: Date.now() + 3600000 });
            }
          }
        }
        if (c.myStrikes > prev.k) {
          const rounds = settledTo - from + 1;
          tell(`missed-${c.id}-${c.myStrikes}`, `You missed a payment in "${c.name}"`, `Up to ${fmt(c.contribution)} was taken from your deposit.`,
            `You missed the ${rounds === 1 ? `round ${from}` : "earlier"} payment in "${c.name}". Up to ${fmt(c.contribution)} was taken from your deposit so the collector was paid in full. That is ${c.myStrikes} missed payment${c.myStrikes === 1 ? "" : "s"} in this circle.`);
        }
      }

      // The circle is over and a deposit is waiting.
      if (c.status >= 3 && c.myDeposit > 0n) {
        const label = c.status === 3 ? "complete" : c.status === 4 ? "cancelled" : "ended early";
        tell(`done-${c.id}`, `"${c.name}" is ${label}`, `Withdraw your ${fmt(c.myDeposit)} deposit.`,
          `"${c.name}" is ${label}. Your ${fmt(c.myDeposit)} deposit is ready to withdraw. Withdraw it now?`,
          ["Yes, withdraw", "Not now"], { kind: "withdraw", id: c.id, until: Date.now() + 3600000 });
      }

      // CRE has not drawn within its turn.
      if (c.status === 1 && st.fallbackEnabled && nowSec >= c.fullAt + st.fallbackDelay) {
        tell(`backup-${c.id}`, `"${c.name}": CRE has not drawn yet`, "You can run the backup draw.",
          `"${c.name}" has been full for ${fmtDur(nowSec - c.fullAt)} and Chainlink CRE has not drawn the order yet. Run the on-chain backup draw now?`,
          ["Yes, run it", "Not now"], { kind: "backup", id: c.id, until: Date.now() + 1800000 });
      }

      last[c.id] = { s: c.status, r: c.round, k: c.myStrikes };
    }
    try { localStorage.setItem(store, JSON.stringify({ said: [...said].slice(-300), last })); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.circles, st.loaded]);

  // 2. Chat commands: work out what the user means and ask for one confirmation.
  useEffect(() => {
    if (!command) return;
    (async () => {
      const { say, setPending, fmt, errText } = api.current;
      try {
        await refreshAjoNow();
        const { circles, bal } = getAjoState();
        const nowSec = Math.floor(Date.now() / 1000);
        const nm = (command.name || "").toLowerCase();
        const pickBy = (list: Circle[]) => {
          const f = nm ? list.filter((s) => s.name.toLowerCase().includes(nm)) : list;
          return f.length ? f : list;
        };
        if (command.what === "status") {
          const mine = circles.filter((c) => c.isMember && c.status <= 2);
          if (mine.length === 0 && bal === 0n) { say({ who: "cowrie", text: "You are not in a running on-chain Ajo right now. Say \"start an ajo\" to begin one." }); return; }
          for (const c of mine) {
            let line = `"${c.name}": `;
            if (c.status === 0) line += `${c.members.length} of ${c.maxMembers} have joined, waiting for the rest.`;
            else if (c.status === 1) line += `everyone is in, waiting ${fmtDur(nowSec - c.fullAt)} for Chainlink CRE to draw the order.`;
            else {
              const left = c.roundEndsAt - nowSec;
              line += `round ${c.round} of ${c.members.length}. ${who(c.order[c.round - 1] || "")} collects this round. `;
              line += c.paidNow ? "You have paid. " : left > 0 ? `You still need to pay ${fmt(c.contribution)}. ` : "";
              line += left > 0 ? `It ends in ${fmtDur(left)}.` : "Time is up, the payout is on its way.";
            }
            say({ who: "cowrie", text: line });
          }
          if (bal > 0n) say({ who: "cowrie", text: `${fmt(bal)} is waiting in your wallet. Say "move my ajo money" to put it in spendable.` });
          return;
        }
        if (command.what === "pay") {
          const due = pickBy(circles.filter((c) => c.isMember && c.status === 2 && !c.paidNow && c.roundEndsAt > nowSec));
          if (due.length === 0) {
            const active = circles.some((c) => c.isMember && c.status === 2);
            say({ who: "cowrie", text: active ? "You are all paid up for this round." : "You have no round waiting for a payment right now." });
            return;
          }
          if (due.length > 1) { say({ who: "cowrie", text: "Which circle?", options: due.map((s) => `Pay ${s.name} ajo`) }); return; }
          const c = due[0];
          setPending({ kind: "pay", id: c.id, until: c.roundEndsAt * 1000 });
          say({ who: "cowrie", text: `Pay ${fmt(c.contribution)} into "${c.name}" for round ${c.round}? The round ends in ${fmtDur(c.roundEndsAt - nowSec)}.`, options: ["Yes, pay", "Not now"] });
          return;
        }
        if (command.what === "join") {
          const open = pickBy(circles.filter((c) => joinable(c, nowSec)));
          if (open.length === 0) { say({ who: "cowrie", text: "I do not see a circle you can join. Ask the person who started it to invite you, then try again." }); return; }
          if (open.length > 1) { say({ who: "cowrie", text: "Which circle?", options: open.map((s) => `Join ${s.name} ajo`) }); return; }
          const c = open[0];
          setPending({ kind: "join", id: c.id, until: Date.now() + 600000 });
          say({ who: "cowrie", text: `Join "${c.name}"? You lock a ${fmt(c.deposit)} deposit, which comes back at the end minus any payment you miss, and you pay ${fmt(c.contribution)} each round.`, options: ["Yes, join", "Not now"] });
          return;
        }
        if (command.what === "withdraw") {
          const done = pickBy(circles.filter((c) => c.isMember && c.status >= 3 && c.myDeposit > 0n));
          if (done.length === 0) { say({ who: "cowrie", text: "You have no Ajo deposit ready to withdraw. Deposits come back once a circle is over." }); return; }
          if (done.length > 1) { say({ who: "cowrie", text: "Which circle?", options: done.map((s) => `Withdraw ${s.name} ajo deposit`) }); return; }
          const c = done[0];
          setPending({ kind: "withdraw", id: c.id, until: Date.now() + 600000 });
          say({ who: "cowrie", text: `Withdraw your ${fmt(c.myDeposit)} deposit from "${c.name}"?`, options: ["Yes, withdraw", "Not now"] });
          return;
        }
        if (command.what === "move") {
          if (bal <= 0n) { say({ who: "cowrie", text: "There is nothing waiting in your wallet." }); return; }
          setPending({ kind: "move", until: Date.now() + 600000 });
          say({ who: "cowrie", text: `Move ${fmt(bal)} from your wallet to your spendable balance?`, options: ["Yes, move it", "Not now"] });
        }
      } catch (e) {
        say({ who: "cowrie", tone: "bad", text: `I could not read your Ajo circles just now, so nothing was changed. ${errText(e)}` });
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
        await refreshAjoNow();
        const { circles, bal } = getAjoState();
        const nowSec = Math.floor(Date.now() / 1000);
        const c = circles.find((z) => z.id === exec.id);
        const target = ajoTarget();
        const ctx = ctxNow();
        if (exec.kind === "pay") {
          if (!c || !c.isMember) throw new Error("I cannot find that circle");
          if (c.status !== 2) throw new Error(`"${c.name}" is not running right now`);
          if (c.paidNow) { A.say({ who: "cowrie", tone: "good", text: `You have already paid for round ${c.round} of "${c.name}", so there is nothing more to do ✓` }); return; }
          if (c.roundEndsAt <= nowSec) throw new Error(`Round ${c.round} just ended, so payments are closed. A missed payment is covered from your deposit`);
          await fundWallet(ctx, c.contribution);
          await A.run("contribute", [BigInt(c.id)], { title: `Pay "${c.name}"`, description: `${A.fmt(c.contribution)} for round ${c.round}.`, successHeader: "Paid", buttonText: "Pay" }, target);
          A.say({ who: "cowrie", tone: "good", text: `Paid ${A.fmt(c.contribution)} into "${c.name}" for round ${c.round} ✓ The pot pays out automatically when the round ends.` });
        } else if (exec.kind === "join") {
          if (!c || !joinable(c, nowSec)) throw new Error("That circle is no longer open to join");
          await fundWallet(ctx, c.deposit);
          await A.run("join", [BigInt(c.id)], { title: `Join "${c.name}"`, description: `Locks a ${A.fmt(c.deposit)} deposit.`, successHeader: "Joined", buttonText: "Join" }, target);
          A.say({ who: "cowrie", tone: "good", text: `You are in "${c.name}" ✓ Your ${A.fmt(c.deposit)} deposit is locked and comes back at the end, minus any payment you miss.` });
        } else if (exec.kind === "withdraw") {
          if (!c || c.myDeposit <= 0n) throw new Error("There is no deposit to withdraw from that circle");
          await A.run("withdrawDeposit", [BigInt(c.id)], { title: "Withdraw deposit", description: `${A.fmt(c.myDeposit)} back to your wallet.`, successHeader: "Withdrawn", buttonText: "Withdraw" }, target);
          A.say({ who: "cowrie", tone: "good", text: `Withdrew ${A.fmt(c.myDeposit)} from "${c.name}" into your wallet. Move it to spendable now?`, options: ["Yes, move it", "Not now"] });
          A.setPending({ kind: "move", until: Date.now() + 600000 });
        } else if (exec.kind === "move") {
          if (bal <= 0n) throw new Error("There is nothing in your wallet to move");
          const moved = await moveToSpendable(ctx);
          A.say({ who: "cowrie", tone: "good", text: `Moved ${A.fmt(moved)} to your spendable balance ✓` });
        } else if (exec.kind === "backup") {
          if (!c || c.status !== 1) { A.say({ who: "cowrie", text: "That circle has already been drawn, so there is nothing to do ✓" }); return; }
          await backupDraw(ctx, c.id);
          A.say({ who: "cowrie", tone: "good", text: `The payout order for "${c.name}" is drawn by the on-chain backup ✓` });
        }
        await refreshAjoNow();
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
