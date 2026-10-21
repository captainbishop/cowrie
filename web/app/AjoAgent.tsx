"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import { AJO_ADDRESS } from "../lib/ajo";
import { useAjo, refreshAjoNow, getAjoState, fmtDur, type Circle } from "../lib/ajoStore";
import { fundWallet, moveSome, backupDraw, ajoTarget, type Ctx } from "../lib/ajoActions";
import { movableOf, type AjoPlan, type AjoStep } from "../lib/ajoIntent";

export type { AjoPlan, AjoStep };
export type AjoPending = { steps: AjoStep[]; until: number };
export type AjoCommand = { plan: AjoPlan; stamp: number };
export type AjoExec = { steps: AjoStep[]; stamp: number };

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

const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;
const potOf = (c: Circle) => c.contribution * BigInt(c.members.length);

// Runs in the background: watches your circles, tells you what to do next, and carries out confirmed actions.
export default function AjoAgent(props: Props) {
  const { addr, publicClient, command, exec } = props;
  const api = useRef<Props>(props);
  api.current = props;
  const me = addr.toLowerCase();
  const st = useAjo(publicClient, addr, { fast: false });

  const who = (a: string) => (a.toLowerCase() === me ? "you" : api.current.book.find((b) => b.address.toLowerCase() === a.toLowerCase())?.name || `${a.slice(0, 6)}...${a.slice(-4)}`);
  const ctxNow = (): Ctx => ({ addr, publicClient, run: api.current.run, spendable: api.current.spendable, fmt: api.current.fmt });
  const joinable = (c: Circle, nowSec: number) => !c.isMember && c.status === 0 && c.joinDeadline > nowSec && (!c.inviteOnly || c.isInvited);
  const iCollect = (c: Circle) => (c.order[c.round - 1] || "").toLowerCase() === me;

  // 1. Alerts that say what to do next.
  useEffect(() => {
    if (!st.loaded || !AJO_ADDRESS) return;
    const A = api.current;
    const fmt = A.fmt;
    const nowSec = Math.floor(Date.now() / 1000);
    const tag = AJO_ADDRESS.slice(2, 8);
    const store = `cowrie.ajo2.seen.${tag}.${me}`;
    type Last = { s: number; r: number; k: number; p: boolean };
    let seen: { said?: string[]; last?: Record<string, Last> } = {};
    try { seen = JSON.parse(localStorage.getItem(store) || "{}"); } catch {}
    const said = new Set<string>(seen.said || []);
    const last: Record<string, Last> = seen.last || {};
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
      const left = c.roundEndsAt - nowSec;
      const settledTo = c.status === 3 ? n : c.status === 2 || c.status === 5 ? c.round - 1 : 0;
      const payPend: AjoPending = { steps: [{ kind: "pay", id: c.id }], until: c.roundEndsAt * 1000 };
      const by = c.drawnBy === 1 ? "by Chainlink CRE" : "by the on-chain backup";

      // The order was just drawn.
      if (prev && prev.s === 1 && c.status === 2) {
        const order = c.order.map((a, i) => `${i + 1}. ${who(a)}`).join(", ");
        const head = `The payout order for "${c.name}" is drawn ${by}: ${order}. Round 1 is open.`;
        if (c.autopayOn) {
          tell(`drawn-${c.id}`, `"${c.name}": the order is drawn`, "Auto-pay will take your share.", `${head} Auto-pay is on, so your ${fmt(c.contribution)} is taken automatically within a minute or two. I will warn you if it has not gone through with 90 seconds left.`);
        } else if (c.paidNow) {
          tell(`drawn-${c.id}`, `"${c.name}": the order is drawn`, "Round 1 is open.", `${head} You have already paid.`);
        } else {
          tell(`drawn-${c.id}`, `"${c.name}": the order is drawn`, "Round 1 is open.", `${head} Pay ${fmt(c.contribution)} before it ends in ${fmtDur(left)}?`, ["Yes, pay", "Not now"], payPend);
        }
        said.add(`${tag}-open-${c.id}-${c.round}`);
      }

      // A round is open and you have not paid.
      if (c.status === 2 && !c.paidNow) {
        if (c.autopayOn) {
          if (left > 0 && left <= 90) {
            tell(`auto-late-${c.id}-${c.round}`, `"${c.name}": auto-pay has not gone through`, `Pay ${fmt(c.contribution)} yourself.`,
              `Auto-pay has not taken your ${fmt(c.contribution)} for round ${c.round} of "${c.name}" yet, and ${fmtDur(left)} are left. Pay it now?`, ["Yes, pay", "Not now"], payPend);
          }
        } else if (left > 0 && left <= 120) {
          tell(`two-${c.id}-${c.round}`, `"${c.name}": ${fmtDur(left)} left`, `Pay ${fmt(c.contribution)} before the round ends.`,
            `Only ${fmtDur(left)} left to pay ${fmt(c.contribution)} into "${c.name}" for round ${c.round}. Pay now?`, ["Yes, pay", "Not now"], payPend);
        } else if (left > 120) {
          tell(`open-${c.id}-${c.round}`, `"${c.name}": round ${c.round} is open`, `Pay ${fmt(c.contribution)} before it ends.`,
            `Round ${c.round} of "${c.name}" is open. Pay ${fmt(c.contribution)} before it ends in ${fmtDur(left)}?`, ["Yes, pay", "Not now"], payPend);
        }
      }

      // Auto-pay went through.
      if (c.autopayOn && c.status === 2 && prev && prev.s === 2 && prev.r === c.round && !prev.p && c.paidNow) {
        tell(`auto-${c.id}-${c.round}`, `"${c.name}": auto-pay paid`, `Round ${c.round} is paid.`, `Auto-pay took your ${fmt(c.contribution)} for round ${c.round} of "${c.name}" ✓`);
      }

      // The round ended and the pot is yours, but CRE has not paid it out yet.
      if (c.status === 2 && left <= -20 && iCollect(c)) {
        tell(`collect-${c.id}-${c.round}`, `"${c.name}": your pot is ready`, "Collect it now.",
          `Round ${c.round} of "${c.name}" has ended and the ${fmt(potOf(c))} pot is yours. Chainlink CRE has not paid it out yet. Collect it now?`,
          ["Yes, collect it", "Not now"], { steps: [{ kind: "settle", id: c.id }, { kind: "move" }], until: Date.now() + 1800000 });
      }

      // A round was settled since the last look.
      if (prev && prev.s === 2 && (c.round > prev.r || c.status === 3 || c.status === 5) && c.order.length) {
        const from = Math.max(1, prev.r);
        if (c.status !== 5) {
          for (let r = from; r <= settledTo; r++) {
            if ((c.order[r - 1] || "").toLowerCase() === me) {
              tell(`got-${c.id}-${r}`, `You collected ${fmt(potOf(c))} from "${c.name}"`, "It is in your wallet. Move it to spendable.",
                `Round ${r} of "${c.name}" paid out. You collected the ${fmt(potOf(c))} pot and it is waiting in your wallet. Move it to spendable now?`,
                ["Yes, move it", "Not now"], { steps: [{ kind: "move" }], until: Date.now() + 3600000 });
            }
          }
        }
        if (c.myStrikes > prev.k) {
          tell(`missed-${c.id}-${c.myStrikes}`, `You missed a payment in "${c.name}"`, `Up to ${fmt(c.contribution)} was taken from your deposit.`,
            `You missed a payment in "${c.name}". Up to ${fmt(c.contribution)} was taken from your deposit so the collector was paid in full. That is ${c.myStrikes} missed payment${c.myStrikes === 1 ? "" : "s"} in this circle.`);
        }
      }

      // The circle is over and a deposit is waiting.
      if (c.status >= 3 && c.myDeposit > 0n) {
        const label = c.status === 3 ? "complete" : c.status === 4 ? "cancelled" : "ended early";
        tell(`done-${c.id}`, `"${c.name}" is ${label}`, `Withdraw your ${fmt(c.myDeposit)} deposit.`,
          `"${c.name}" is ${label}. Your ${fmt(c.myDeposit)} deposit is ready. Withdraw it and move it to spendable now?`,
          ["Yes, do it", "Not now"], { steps: [{ kind: "withdraw", id: c.id }, { kind: "move" }], until: Date.now() + 3600000 });
      }

      // CRE has not drawn within its turn.
      if (c.status === 1 && st.fallbackEnabled && nowSec >= c.fullAt + st.fallbackDelay) {
        tell(`backup-${c.id}`, `"${c.name}": CRE has not drawn yet`, "You can run the backup draw.",
          `"${c.name}" has been full for ${fmtDur(nowSec - c.fullAt)} and Chainlink CRE has not drawn the order yet. Run the on-chain backup draw now?`,
          ["Yes, run it", "Not now"], { steps: [{ kind: "backup", id: c.id }], until: Date.now() + 1800000 });
      }

      last[c.id] = { s: c.status, r: c.round, k: c.myStrikes, p: c.paidNow };
    }
    try { localStorage.setItem(store, JSON.stringify({ said: [...said].slice(-300), last })); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.circles, st.loaded]);

  // 2. A request from chat: work out exactly what it means, and ask for one confirmation.
  useEffect(() => {
    if (!command) return;
    (async () => {
      const { say, setPending, fmt, errText } = api.current;
      try {
        await refreshAjoNow();
        const { circles, bal } = getAjoState();
        const nowSec = Math.floor(Date.now() / 1000);
        const plan = command.plan;
        const nm = (plan.name || "").toLowerCase();
        const pickBy = (list: Circle[]) => {
          const f = nm ? list.filter((s) => s.name.toLowerCase().includes(nm)) : list;
          return f.length ? f : list;
        };
        const free = movableOf(circles, bal);

        if (plan.type === "status") {
          const mine = circles.filter((c) => c.isMember && c.status <= 2);
          if (mine.length === 0 && free <= 0n) { say({ who: "cowrie", text: "You are not in a running on-chain Ajo right now. Say \"start an ajo\" to begin one." }); return; }
          for (const c of mine) {
            let line = `"${c.name}": `;
            if (c.status === 0) line += `${c.members.length} of ${c.maxMembers} have joined, waiting for the rest.`;
            else if (c.status === 1) line += `everyone is in, waiting ${fmtDur(nowSec - c.fullAt)} for Chainlink CRE to draw the order.`;
            else {
              const left = c.roundEndsAt - nowSec;
              line += `round ${c.round} of ${c.members.length}. ${who(c.order[c.round - 1] || "")} collects this round. `;
              line += c.paidNow ? "You have paid. " : left > 0 ? `You still need to pay ${fmt(c.contribution)}. ` : "";
              line += c.autopayOn ? "Auto-pay is on. " : "";
              line += left > 0 ? `It ends in ${fmtDur(left)}.` : "Time is up, the payout is on its way.";
            }
            say({ who: "cowrie", text: line });
          }
          if (free > 0n) say({ who: "cowrie", text: `${fmt(free)} is waiting in your wallet. Say "move my pot" to put it in spendable.` });
          return;
        }

        const steps: AjoStep[] = [];
        const lines: string[] = [];
        const notes: string[] = [];
        let incoming = free;
        for (const kind of plan.kinds) {
          if (kind === "pay") {
            const due = pickBy(circles.filter((c) => c.isMember && c.status === 2 && !c.paidNow && c.roundEndsAt > nowSec));
            if (due.length > 1) { say({ who: "cowrie", text: "Which circle?", options: due.map((s) => `Pay ${s.name} ajo`) }); return; }
            if (due.length === 1) { steps.push({ kind, id: due[0].id }); lines.push(`pay ${fmt(due[0].contribution)} into "${due[0].name}" for round ${due[0].round}`); }
            else notes.push(circles.some((c) => c.isMember && c.status === 2) ? "You are all paid up for this round." : "You have no round waiting for a payment right now.");
          } else if (kind === "join") {
            const open = pickBy(circles.filter((c) => joinable(c, nowSec)));
            if (open.length > 1) { say({ who: "cowrie", text: "Which circle?", options: open.map((s) => `Join ${s.name} ajo`) }); return; }
            if (open.length === 1) { steps.push({ kind, id: open[0].id }); lines.push(`join "${open[0].name}" and lock a ${fmt(open[0].deposit)} deposit`); }
            else notes.push("I do not see a circle you can join. Ask the person who started it to invite you, then try again.");
          } else if (kind === "settle") {
            const mineDue = circles.filter((c) => c.isMember && c.status === 2 && iCollect(c));
            const ready = pickBy(mineDue.filter((c) => c.roundEndsAt <= nowSec));
            if (ready.length) {
              for (const c of ready) { steps.push({ kind, id: c.id }); lines.push(`collect the ${fmt(potOf(c))} pot from "${c.name}"`); incoming += potOf(c); }
            } else if (mineDue.length) {
              notes.push(`Round ${mineDue[0].round} of "${mineDue[0].name}" is yours, but it ends in ${fmtDur(mineDue[0].roundEndsAt - nowSec)}. The pot pays out automatically then, and I will offer to collect it if CRE is late.`);
            }
          } else if (kind === "withdraw") {
            const done = pickBy(circles.filter((c) => c.isMember && c.status >= 3 && c.myDeposit > 0n));
            if (!done.length) notes.push("You have no Ajo deposit ready to withdraw. Deposits come back once a circle is over.");
            for (const c of done) { steps.push({ kind, id: c.id }); lines.push(`withdraw your ${fmt(c.myDeposit)} deposit from "${c.name}"`); incoming += c.myDeposit; }
          } else if (kind === "move") {
            if (incoming > 0n) { steps.push({ kind }); lines.push(`move ${fmt(incoming)} from your wallet to spendable`); }
            else notes.push("There is nothing waiting in your wallet to move.");
          }
        }
        if (steps.length === 0) { say({ who: "cowrie", text: notes.join(" ") || "There is nothing to do right now." }); return; }
        setPending({ steps, until: Date.now() + 600000 });
        say({ who: "cowrie", text: `${notes.length ? notes.join(" ") + " " : ""}I will ${lines.join(", then ")}. Go ahead?`, options: ["Yes, do it", "Not now"] });
      } catch (e) {
        say({ who: "cowrie", tone: "bad", text: `I could not read your Ajo circles just now, so nothing was changed. ${errText(e)}` });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.stamp]);

  // 3. The confirmed steps: do them one by one, with a receipt for each.
  useEffect(() => {
    if (!exec || exec.steps.length === 0) return;
    (async () => {
      const A = api.current;
      if (A.busy) { A.say({ who: "cowrie", text: "One moment, I am still finishing the last action. Say yes again in a few seconds." }); return; }
      A.setBusy(true);
      const rc = (text: string, h?: string) => A.say({ who: "cowrie", tone: "good", text: h ? `${text} ✓\nTransaction ${short(h)}` : `${text} ✓` });
      try {
        for (const step of exec.steps) {
          await refreshAjoNow();
          const { circles } = getAjoState();
          const { bal } = getAjoState();
          const nowSec = Math.floor(Date.now() / 1000);
          const c = step.id !== undefined ? circles.find((z) => z.id === step.id) : undefined;
          const target = ajoTarget();
          const ctx = ctxNow();

          if (step.kind === "pay") {
            if (!c || !c.isMember) throw new Error("I cannot find that circle");
            if (c.status !== 2) throw new Error(`"${c.name}" is not running right now`);
            if (c.paidNow) { rc(`You have already paid for round ${c.round} of "${c.name}"`); continue; }
            if (c.roundEndsAt <= nowSec) throw new Error(`Round ${c.round} just ended, so payments are closed. A missed payment is covered from your deposit`);
            await fundWallet(ctx, c.contribution);
            const h = await A.run("contribute", [BigInt(c.id)], { title: `Pay "${c.name}"`, description: `${A.fmt(c.contribution)} for round ${c.round}.`, successHeader: "Paid", buttonText: "Pay" }, target);
            rc(`Paid ${A.fmt(c.contribution)} into "${c.name}" for round ${c.round}. The pot pays out automatically when the round ends`, h);
          } else if (step.kind === "join") {
            if (!c || !joinable(c, nowSec)) throw new Error("That circle is no longer open to join");
            await fundWallet(ctx, c.deposit);
            const h = await A.run("join", [BigInt(c.id)], { title: `Join "${c.name}"`, description: `Locks a ${A.fmt(c.deposit)} deposit.`, successHeader: "Joined", buttonText: "Join" }, target);
            rc(`You are in "${c.name}". Your ${A.fmt(c.deposit)} deposit is locked and comes back at the end, minus any payment you miss`, h);
          } else if (step.kind === "settle") {
            if (!c || c.status !== 2 || c.roundEndsAt > nowSec) { rc("That round has already been paid out"); continue; }
            const h = await A.run("settleRound", [BigInt(c.id)], { title: `Collect from "${c.name}"`, description: `Pays the round ${c.round} pot to its collector.`, successHeader: "Collected", buttonText: "Collect" }, target);
            rc(`Round ${c.round} of "${c.name}" settled. The ${A.fmt(potOf(c))} pot is in your wallet`, h);
          } else if (step.kind === "withdraw") {
            if (!c || c.myDeposit <= 0n) { rc("That deposit was already withdrawn"); continue; }
            const h = await A.run("withdrawDeposit", [BigInt(c.id)], { title: "Withdraw deposit", description: `${A.fmt(c.myDeposit)} back to your wallet.`, successHeader: "Withdrawn", buttonText: "Withdraw" }, target);
            rc(`Withdrew your ${A.fmt(c.myDeposit)} deposit from "${c.name}" into your wallet`, h);
          } else if (step.kind === "move") {
            const free = movableOf(circles, bal);
            const moved = await moveSome(ctx, free);
            if (moved <= 0n) A.say({ who: "cowrie", text: "There was nothing left in your wallet to move." });
            else rc(`Moved ${A.fmt(moved)} to your spendable balance`);
          } else if (step.kind === "backup") {
            if (!c || c.status !== 1) { rc("That circle has already been drawn"); continue; }
            await backupDraw(ctx, c.id);
            rc(`The payout order for "${c.name}" is drawn by the on-chain backup`);
          }
        }
        await refreshAjoNow();
        await A.refresh();
      } catch (e) {
        A.say({ who: "cowrie", tone: "bad", text: `${A.errText(e)}. I stopped here, so nothing after this step was done.` });
      } finally {
        A.setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exec?.stamp]);

  return null;
}
