"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { ajoAbi, AJO_ADDRESS } from "../lib/ajo";
import { useAjo, refreshAjoNow, fmtDur, fmtLen, type Circle } from "../lib/ajoStore";
import { fundWallet, moveToSpendable, backupDraw, ajoTarget } from "../lib/ajoActions";

type RunUi = { description?: string; successHeader?: string; title?: string; buttonText?: string };
type RunFn = (fn: string, args: unknown[], ui?: RunUi, target?: { address: `0x${string}`; abi: any }) => Promise<string>;

const UNIT_SECONDS: Record<string, number> = { minutes: 60, hours: 3600, days: 86400, weeks: 604800, months: 2592000 };
const STATUS_TEXT = ["Open", "Full", "Live", "Completed", "Cancelled", "Ended"];

const inputStyle = {
  width: "100%",
  padding: "9px 11px",
  marginTop: 4,
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "inherit",
  font: "inherit",
} as const;

type Detail = { key: string; rounds: { round: number; paid: string[]; missed: string[] }[]; partial: boolean };

export default function OnchainAjo({
  addr, publicClient, run, busy, setBusy, flash, errText, fmt, toU, symbol, perUsd, spendable, book, prefill, focusId, refresh,
}: {
  addr?: `0x${string}`;
  publicClient: any;
  run: RunFn;
  busy: boolean;
  setBusy: (b: boolean) => void;
  flash: (m: string) => void;
  errText: (e: unknown) => string;
  fmt: (v: bigint) => string;
  toU: (n: number) => bigint;
  symbol: string;
  perUsd: number;
  spendable: bigint;
  book: { name: string; address: string }[];
  prefill: { name?: string; amount?: number; minutes?: number; invitees?: string[]; stamp: number } | null;
  focusId: number | null;
  refresh?: () => Promise<unknown> | void;
}) {
  const { circles, bal, fallbackEnabled, fallbackDelay, loaded, error } = useAjo(publicClient, addr, { fast: true });
  const me = (addr || "").toLowerCase();
  const ctx = { addr: addr as `0x${string}`, publicClient, run, spendable, fmt };

  const [, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  const nowSec = Math.floor(Date.now() / 1000);

  // The moment a countdown ends, read again so the screen moves on without waiting for the next check.
  useEffect(() => {
    if (circles.some((c) => c.status === 2 && c.roundEndsAt > 0 && nowSec === c.roundEndsAt + 1)) void refreshAjoNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowSec]);

  const [showForm, setShowForm] = useState(false);
  const [fName, setFName] = useState("Family Ajo");
  const [fAmt, setFAmt] = useState(String(Math.round(10 * perUsd)));
  const [fMult, setFMult] = useState("2");
  const [fLen, setFLen] = useState("1");
  const [fUnit, setFUnit] = useState("weeks");
  const [fSize, setFSize] = useState("3");
  const [fInvite, setFInvite] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const [secTab, setSecTab] = useState<"auto" | "live" | "open" | "join" | "done">("auto");
  const [ask, setAsk] = useState("");
  const [details, setDetails] = useState<Record<number, Detail>>({});
  const loadingDetail = useRef<Set<number>>(new Set());

  // The chat can pre-fill this form ("start an ajo called X with Ike, 50k, weekly").
  useEffect(() => {
    if (!prefill) return;
    if (prefill.name) setFName(prefill.name);
    if (prefill.amount && prefill.amount > 0) setFAmt(String(Math.round(prefill.amount)));
    if (prefill.minutes && prefill.minutes > 0) {
      const m = prefill.minutes;
      const pair: [number, string] = m % 43200 === 0 ? [m / 43200, "months"] : m % 10080 === 0 ? [m / 10080, "weeks"] : m % 1440 === 0 ? [m / 1440, "days"] : m % 60 === 0 ? [m / 60, "hours"] : [m, "minutes"];
      setFLen(String(pair[0]));
      setFUnit(pair[1]);
    }
    const wanted = (prefill.invitees || []).map((n) => n.toLowerCase());
    const found = book.filter((b) => wanted.some((n) => b.name.toLowerCase() === n || b.name.toLowerCase().startsWith(n))).map((b) => b.address.toLowerCase());
    if (found.length) { setPicked(found); setFInvite(true); setFSize(String(Math.min(20, found.length + 1))); }
    setShowForm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  const who = (a: string) => (a.toLowerCase() === me ? "you" : book.find((b) => b.address.toLowerCase() === a.toLowerCase())?.name || `${a.slice(0, 6)}...${a.slice(-4)}`);
  const keyOf = (c: Circle) => `${c.status}-${c.round}`;
  const settledOf = (c: Circle) => (c.status === 3 ? c.members.length : c.status === 2 || c.status === 5 ? c.round - 1 : 0);
  const nameIn = (c: Circle, a: string) => {
    if (a.toLowerCase() === me) return "you";
    const k = book.find((b) => b.address.toLowerCase() === a.toLowerCase());
    if (k) return k.name;
    return `Member ${c.members.findIndex((m) => m.toLowerCase() === a.toLowerCase()) + 1}`;
  };

  async function loadDetails(c: Circle) {
    const settled = settledOf(c);
    const key = keyOf(c);
    if (settled <= 0) { setDetails((d) => ({ ...d, [c.id]: { key, rounds: [], partial: false } })); return; }
    const partial = c.members.length * settled > 80;
    const subset = partial ? c.members.filter((m) => m.toLowerCase() === me) : c.members;
    const reads: Promise<{ round: number; member: string; paid: boolean }>[] = [];
    for (let r = 1; r <= settled; r++) {
      for (const m of subset) {
        reads.push(Promise.resolve(publicClient.readContract({ address: AJO_ADDRESS, abi: ajoAbi, functionName: "paid", args: [BigInt(c.id), r, m] })).then((p: any) => ({ round: r, member: m, paid: !!p })));
      }
    }
    const res = await Promise.all(reads);
    const rounds = Array.from({ length: settled }, (_, i) => ({
      round: i + 1,
      paid: res.filter((x) => x.round === i + 1 && x.paid).map((x) => x.member),
      missed: res.filter((x) => x.round === i + 1 && !x.paid).map((x) => x.member),
    }));
    setDetails((d) => ({ ...d, [c.id]: { key, rounds, partial } }));
  }

  async function act(okMsg: string, fn: () => Promise<boolean | void>) {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await fn();
      await refreshAjoNow();
      try { await refresh?.(); } catch {}
      setAsk("");
      if (ok !== false) flash(okMsg);
    } catch (e) {
      flash(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const need = (amount: bigint) => {
    if (bal + spendable < amount) { flash(`Not enough balance: you need ${fmt(amount)}`); return false; }
    return true;
  };
  const t = ajoTarget();

  const create = () => act("Circle created", async () => {
    const contribution = toU(Number(fAmt) || 0);
    const mult = BigInt(Math.max(1, Math.floor(Number(fMult) || 1)));
    const deposit = contribution * mult;
    const size = Math.floor(Number(fSize));
    const period = Math.round((Number(fLen) || 0) * (UNIT_SECONDS[fUnit] || 60));
    if (!fName.trim()) throw new Error("Give the circle a name");
    if (contribution <= 0n) throw new Error("Enter an amount per round");
    if (!(size >= 2 && size <= 20)) throw new Error("A circle needs 2 to 20 members");
    if (!(period >= 60)) throw new Error("Rounds must be at least 1 minute");
    if (fInvite && picked.length === 0) throw new Error("Pick at least one friend to invite, or switch to Anyone can join");
    if (!need(deposit)) return false;
    await fundWallet(ctx, deposit);
    const joinDeadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 86400);
    await run(
      fInvite ? "createInviteOnlyCircle" : "createCircle",
      fInvite
        ? [{ name: fName.trim(), contribution, deposit, period: BigInt(period), joinDeadline, maxMembers: size }, picked]
        : [fName.trim(), contribution, deposit, BigInt(period), joinDeadline, size],
      { title: `Create "${fName.trim()}"`, description: `Locks a ${fmt(deposit)} deposit.`, successHeader: "Circle created", buttonText: "Create" },
      t,
    );
    setShowForm(false);
    setSecTab("auto");
  });

  const join = (c: Circle) => act("Joined the circle", async () => {
    if (!need(c.deposit)) return false;
    await fundWallet(ctx, c.deposit);
    await run("join", [BigInt(c.id)], { title: `Join "${c.name}"`, description: `Locks a ${fmt(c.deposit)} deposit.`, successHeader: "Joined", buttonText: "Join" }, t);
  });
  const leave = (c: Circle) => act("You left the circle", async () => {
    await run("leave", [BigInt(c.id)], { title: `Leave "${c.name}"`, description: `Your ${fmt(c.deposit)} deposit comes back to your wallet.`, successHeader: "Left", buttonText: "Leave" }, t);
  });
  const cancel = (c: Circle) => act("Circle cancelled", async () => {
    await run("cancel", [BigInt(c.id)], { title: `Cancel "${c.name}"`, description: "Everyone can take their deposit back.", successHeader: "Cancelled", buttonText: "Cancel circle" }, t);
  });
  const pay = (c: Circle) => act("Paid for this round", async () => {
    if (!need(c.contribution)) return false;
    await fundWallet(ctx, c.contribution);
    await run("contribute", [BigInt(c.id)], { title: `Pay "${c.name}"`, description: `${fmt(c.contribution)} for round ${c.round}.`, successHeader: "Paid", buttonText: "Pay" }, t);
  });
  const settle = (c: Circle) => act("Round settled", async () => {
    await run("settleRound", [BigInt(c.id)], { title: `Settle "${c.name}"`, description: "Pays this round's pot to its collector.", successHeader: "Settled", buttonText: "Settle" }, t);
  });
  const withdraw = (c: Circle) => act("Deposit withdrawn", async () => {
    await run("withdrawDeposit", [BigInt(c.id)], { title: "Withdraw deposit", description: `${fmt(c.myDeposit)} back to your wallet.`, successHeader: "Withdrawn", buttonText: "Withdraw" }, t);
  });
  const voteEnd = (c: Circle) => act("Your vote is in", async () => {
    await run("voteEnd", [BigInt(c.id)], { title: `End "${c.name}" early`, description: "The circle ends only if every member agrees.", successHeader: "Voted", buttonText: "Vote to end" }, t);
  });
  const retract = (c: Circle) => act("Vote taken back", async () => {
    await run("retractEndVote", [BigInt(c.id)], { title: "Take back my vote", description: "The circle keeps going.", successHeader: "Done", buttonText: "Take back" }, t);
  });
  const toggleAutopay = (c: Circle) => act(c.autopayOn ? "Auto-pay is off" : "Auto-pay is on", async () => {
    if (!c.autopayOn) {
      const left = c.status === 2 ? c.members.length - c.round + 1 : c.maxMembers;
      const reserve = c.contribution * BigInt(Math.max(1, left));
      if (!need(reserve)) return false;
      await fundWallet(ctx, reserve);
    }
    await run("setAutopay", [BigInt(c.id), !c.autopayOn], { title: c.autopayOn ? "Turn off auto-pay" : "Turn on auto-pay", description: c.autopayOn ? "You will pay by hand again." : "Your share is taken from your wallet at the start of each round.", successHeader: "Done", buttonText: "Confirm" }, t);
  });
  const backup = (c: Circle) => act("Order drawn by the backup", async () => { await backupDraw(ctx, c.id); });
  const moveMoney = () => act("Moved to spendable", async () => {
    const moved = await moveToSpendable(ctx);
    if (moved <= 0n) { flash("Nothing in your wallet to move"); return false; }
  });

  const share = async (c: Circle) => {
    const url = `${window.location.origin}/?ajo=${c.id}`;
    const text = `Join "${c.name}" on Cowrie: ${fmt(c.contribution)} each round.`;
    try { if (navigator.share) { await navigator.share({ title: "Cowrie Ajo", text, url }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(url); flash("Link copied"); } catch { flash(url); }
  };

  const btn = (label: string, fn: () => void, primary = false) => (
    <button className={"mini " + (primary ? "pay" : "ghost")} onClick={fn} disabled={busy}>{label}</button>
  );

  const visible = circles.filter((c) => c.isMember || (c.status === 0 && c.joinDeadline > nowSec && (!c.inviteOnly || c.isInvited)));
  const grpOf = (c: Circle): "live" | "open" | "join" | "done" => (c.status >= 3 ? "done" : c.status === 2 ? "live" : c.isMember ? "open" : "join");
  const counts = { live: 0, open: 0, join: 0, done: 0 };
  visible.forEach((c) => { counts[grpOf(c)] += 1; });
  const effTab = secTab !== "auto" ? secTab : counts.live ? "live" : counts.open ? "open" : counts.join ? "join" : counts.done ? "done" : "live";
  const shown = visible.filter((c) => grpOf(c) === effTab);

  const stepLine = (c: Circle) => {
    if (c.status >= 4) return null;
    const n = c.maxMembers;
    const rl = n <= 4 ? "Round " : "R";
    const labels = ["Join", "Draw", ...Array.from({ length: n }, (_, i) => `${rl}${i + 1}`), "Done"];
    const cur = c.status === 0 ? 0 : c.status === 1 ? 1 : c.status === 2 ? 1 + c.round : labels.length - 1;
    return (
      <div className="ajorder" style={{ marginBottom: 8 }}>
        {labels.map((l, i) => (<span key={i} className={"ajochip" + (i === cur ? " on" : "")}>{i < cur ? "✓ " : ""}{l}</span>))}
      </div>
    );
  };

  const card = (c: Circle) => {
    const who = (a: string) => nameIn(c, a);
    const n = c.members.length;
    const collector = c.order[c.round - 1] || "";
    const iAmCollector = collector.toLowerCase() === me;
    const isCreator = c.creator.toLowerCase() === me;
    const left = c.roundEndsAt - nowSec;
    const waiting = Math.max(0, nowSec - c.fullAt);
    const fbIn = c.fullAt + fallbackDelay - nowSec;
    const det = details[c.id];
    return (
      <div className="pcard" key={c.id} style={{ marginBottom: 10 }}>
        <div className="prow" style={{ cursor: "default" }}>
          <span className="prl">
            <b>{c.name}</b>
            <small>#{c.id} · {fmt(c.contribution)} each · {n}/{c.maxMembers} members · every {fmtLen(c.period)}{c.inviteOnly ? " · invite-only" : ""}</small>
          </span>
          <span className="prr"><b>{STATUS_TEXT[c.status]}</b></span>
        </div>
        <div className="posexp">
          {stepLine(c)}

          {c.status === 0 && !c.isMember && (
            <>
              <div className="ds" style={{ marginBottom: 6 }}>Join with a {fmt(c.deposit)} deposit. It comes back at the end, minus any payment you miss. Each round you pay {fmt(c.contribution)}, and a round lasts {fmtLen(c.period)}.</div>
              <div className="posacts">{btn(`Join and lock ${fmt(c.deposit)}`, () => join(c), true)}</div>
            </>
          )}

          {c.status === 0 && c.isMember && (
            <>
              <div className="ds" style={{ marginBottom: 6 }}>{n} of {c.maxMembers} have joined. Waiting for {c.maxMembers - n} more. When the circle is full, Chainlink CRE draws the payout order.</div>
              <div className="posacts">
                {isCreator && btn("Share link", () => share(c), true)}
                {isCreator && (ask === `cancel-${c.id}` ? btn("Yes, cancel and refund everyone", () => cancel(c), true) : btn("Cancel circle", () => setAsk(`cancel-${c.id}`)))}
                {!isCreator && (ask === `leave-${c.id}` ? btn("Yes, leave and take my deposit back", () => leave(c), true) : btn("Leave circle", () => setAsk(`leave-${c.id}`)))}
              </div>
            </>
          )}

          {c.status === 1 && (
            <>
              <div className="ds" style={{ marginBottom: 6 }}>Everyone is in. Chainlink CRE is drawing the payout order from the live Bitcoin price. Waiting {fmtDur(waiting)} so far, it usually takes under a minute.</div>
              {fallbackEnabled && (fbIn > 0
                ? <div className="ds" style={{ marginBottom: 6 }}>If CRE has not drawn within {fmtDur(fbIn)}, a backup draw on the contract becomes available.</div>
                : <div className="ds" style={{ marginBottom: 6 }}>CRE has had its turn. Anyone in the circle can now run the backup draw.</div>)}
              <div className="posacts">
                {fallbackEnabled && fbIn <= 0 && btn("Run backup draw", () => backup(c), true)}
                {isCreator && (ask === `cancel-${c.id}` ? btn("Yes, cancel and refund everyone", () => cancel(c), true) : btn("Cancel circle", () => setAsk(`cancel-${c.id}`)))}
              </div>
            </>
          )}

          {c.status === 2 && (
            <>
              <div className="ds" style={{ marginBottom: 4 }}>Round {c.round} of {n}. {iAmCollector ? "You collect" : `${who(collector)} collects`} {fmt(c.contribution * BigInt(n))} this round.</div>
              <div className="ds" style={{ marginBottom: 6 }}>
                {left > 0 ? `Ends in ${fmtDur(left)}.` : `Time is up. Chainlink CRE is settling this round and paying the pot to ${iAmCollector ? "you" : who(collector)}.`}
              </div>
              <div className="ds" style={{ marginBottom: 6 }}>Payout order, {c.drawnBy === 1 ? "drawn by Chainlink CRE" : "drawn by the on-chain backup"}:</div>
              <div className="ajorder" style={{ marginBottom: 8 }}>
                {c.order.map((a, i) => (<span key={i} className={"ajochip" + (i === c.round - 1 ? " on" : "")}>{i + 1}. {who(a)}</span>))}
              </div>
              <div className="posacts">
                {c.isMember && !c.paidNow && left > 0 && btn(`Pay ${fmt(c.contribution)} for round ${c.round}`, () => pay(c), true)}
                {c.isMember && c.paidNow && <span className="muted2">You have paid for this round ✓</span>}
                {c.isMember && left <= 0 && btn(iAmCollector ? "Collect my pot now" : "Settle round now", () => settle(c), true)}
              </div>
            </>
          )}

          {c.status >= 3 && (
            <>
              <div className="ds" style={{ marginBottom: 6 }}>
                {c.status === 3 ? "Circle complete. Every round was paid out." : c.status === 4 ? "Circle cancelled. Nothing was paid out, and deposits are refunded." : "Circle ended early by agreement. Deposits are refunded."}
              </div>
              {c.drawnBy > 0 && c.order.length > 0 && (
                <div className="ajorder" style={{ marginBottom: 8 }}>
                  {c.order.map((a, i) => (<span key={i} className="ajochip">{i + 1}. {who(a)}</span>))}
                </div>
              )}
              {c.isMember && c.myDeposit > 0n && <div className="posacts">{btn(`Withdraw ${fmt(c.myDeposit)} deposit`, () => withdraw(c), true)}</div>}
            </>
          )}

          {c.isMember && c.myStrikes > 0 && (
            <div className="ds" style={{ marginTop: 8 }}>
              You missed {c.myStrikes} payment{c.myStrikes === 1 ? "" : "s"} in this circle. Each one was covered from your deposit (up to {fmt(c.contribution)}).
            </div>
          )}
          {settledOf(c) > 0 && (
            <details style={{ marginTop: 8 }} onToggle={(e) => {
              if ((e.currentTarget as HTMLDetailsElement).open && !loadingDetail.current.has(c.id) && (!details[c.id] || details[c.id].key !== keyOf(c))) {
                loadingDetail.current.add(c.id);
                loadDetails(c).catch(() => {}).finally(() => loadingDetail.current.delete(c.id));
              }
            }}>
              <summary className="ds" style={{ cursor: "pointer", fontWeight: 600 }}>Payment history</summary>
              {!det || det.key !== keyOf(c) ? <div className="ds" style={{ marginTop: 6 }}>Loading...</div> : (
                <div style={{ marginTop: 6 }}>
                  {det.rounds.map((r) => {
                    const total = det.partial ? 1 : c.members.length;
                    const collector = c.order[r.round - 1];
                    return (
                      <div key={r.round} className="ds" style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 0", borderTop: "1px solid var(--border)" }}>
                        <span>Round {r.round}{collector ? ` · ${who(collector)} collected` : ""}</span>
                        <span>{det.partial ? (r.missed.length ? "You missed" : "You paid ✓") : r.missed.length === 0 ? `All ${total} paid ✓` : `${r.paid.length} of ${total} paid · missed: ${r.missed.map((m) => who(m)).join(", ")}`}</span>
                      </div>
                    );
                  })}
                  {det.partial && <div className="ds">Large circle: showing your own payments only.</div>}
                </div>
              )}
            </details>
          )}

          {c.isMember && c.status <= 2 && (
            <div style={{ marginTop: 10 }}>
              <div className="ds" style={{ marginBottom: 6 }}>
                {c.autopayOn ? "Auto-pay is on: your share is taken from your wallet at the start of each round." : "Auto-pay is off. Turn it on to have your share taken from your wallet at the start of each round."}
              </div>
              <div className="posacts">{btn(c.autopayOn ? "Turn off auto-pay" : "Turn on auto-pay", () => toggleAutopay(c))}</div>
            </div>
          )}

          {c.isMember && c.status === 2 && (
            <div style={{ marginTop: 10 }}>
              {c.endVotedByMe ? (
                <>
                  <div className="ds" style={{ marginBottom: 6 }}>You voted to end early. {c.endVotes} of {n} members have voted.</div>
                  <div className="posacts">{btn("Take back my vote", () => retract(c))}</div>
                </>
              ) : ask === `end-${c.id}` ? (
                <>
                  <div className="ds" style={{ marginBottom: 6 }}>The circle ends only if every member agrees. Members who have not collected yet lose their turn, this round's payments are refunded, and everyone gets their deposit back.</div>
                  <div className="posacts">
                    {btn("Yes, I agree to end", () => voteEnd(c), true)}
                    {btn("No, keep going", () => setAsk(""))}
                  </div>
                </>
              ) : (
                <div className="posacts">{btn("Propose ending early", () => setAsk(`end-${c.id}`))}</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!AJO_ADDRESS) return <p className="muted">On-chain Ajo is not set up yet. Add NEXT_PUBLIC_AJO_CIRCLE to web/.env.local.</p>;
  if (!addr) return null;

  return (
    <div style={{ marginBottom: 18 }}>
      <div className="poshead">
        On-chain Ajo <span style={{ color: "var(--brass)", fontWeight: 700 }}>· Chainlink CRE draws and pays out, with an on-chain backup</span>
      </div>
      <details style={{ marginBottom: 10 }}>
        <summary className="ds" style={{ cursor: "pointer", fontWeight: 600 }}>What is an Ajo?</summary>
        <div className="ds" style={{ marginTop: 6 }}>
          An ajo is a group saving club, also called esusu, tanda, susu, chit fund or ROSCA (rotating savings and credit association). Everyone pays the same amount each round, and each round one member takes the whole pot, until everyone has had a turn. Here the rules live in a contract on Monad: everyone locks a deposit first (returned at the end, minus any payment they miss), a Chainlink CRE workflow draws the payout order from the live Bitcoin price, and each round pays out automatically when its timer ends.
        </div>
      </details>
      <div className="ds" style={{ marginBottom: 8 }}>
        Spendable: {fmt(spendable)}{bal > 0n ? ` · ${fmt(bal)} waiting in your wallet` : ""}
      </div>
      <div className="posacts" style={{ marginBottom: 10 }}>
        {bal > 0n && btn(`Move ${fmt(bal)} to spendable`, () => moveMoney(), true)}
        <button className="mini pay" onClick={() => setShowForm(!showForm)}>{showForm ? "Close" : "Start an on-chain Ajo"}</button>
      </div>

      {showForm && (
        <div className="pcard" style={{ padding: 12, marginBottom: 10 }}>
          {(
            [
              ["Circle name", fName, setFName],
              [`Each member pays per round (${symbol})`, fAmt, setFAmt],
              ["Security deposit, as a multiple of one payment (1 or more)", fMult, setFMult],
              ["Number of members (2 to 20)", fSize, setFSize],
            ] as [string, string, (v: string) => void][]
          ).map(([label, value, set]) => (
            <label key={label} style={{ display: "block", marginBottom: 8, fontSize: 12 }}>
              {label}
              <input value={value} onChange={(e) => set(e.target.value)} style={inputStyle} />
            </label>
          ))}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, marginBottom: 4 }}>How long is each round?</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {([["Daily", 1, "days"], ["Weekly", 1, "weeks"], ["Every 2 weeks", 2, "weeks"], ["Monthly", 1, "months"]] as [string, number, string][]).map(([lab, n, u]) => (
                <button key={lab} className={"ajochip" + (fLen === String(n) && fUnit === u ? " on" : "")} style={{ cursor: "pointer", font: "inherit" }} onClick={() => { setFLen(String(n)); setFUnit(u); }}>{lab}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={fLen} onChange={(e) => setFLen(e.target.value)} style={{ ...inputStyle, flex: 1, marginTop: 0 }} />
              <select value={fUnit} onChange={(e) => setFUnit(e.target.value)} style={{ ...inputStyle, flex: 1, marginTop: 0 }}>
                <option value="minutes">minutes</option>
                <option value="hours">hours</option>
                <option value="days">days</option>
                <option value="weeks">weeks</option>
                <option value="months">months</option>
              </select>
            </div>
          </div>
          <div style={{ margin: "4px 0 10px" }}>
            <div className="seg" style={{ marginBottom: 8 }}>
              <button className={fInvite ? "on" : ""} onClick={() => setFInvite(true)}>Invite-only</button>
              <button className={!fInvite ? "on" : ""} onClick={() => setFInvite(false)}>Anyone can join</button>
            </div>
            {fInvite && (book.length === 0 ? (
              <div className="ds">Save your friends in People first (name and wallet address), then pick them here.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {book.map((b) => {
                  const a = b.address.toLowerCase();
                  const on = picked.includes(a);
                  return (
                    <button key={a} className={"ajochip" + (on ? " on" : "")} style={{ cursor: "pointer", font: "inherit" }} onClick={() => {
                      const next = on ? picked.filter((x) => x !== a) : [...picked, a];
                      setPicked(next);
                      if (next.length) setFSize(String(Math.min(20, next.length + 1)));
                    }}>
                      {on ? "✓ " : ""}{b.name}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="ds" style={{ marginBottom: 8 }}>
            You lock the deposit now. Other members join from their own Cowrie and lock the same deposit. When the circle is full, the payout order is drawn from the live Chainlink BTC price, and each round pays out automatically when its timer ends.
          </div>
          <div className="posacts"><button className="mini pay" onClick={create} disabled={busy}>Create circle</button></div>
        </div>
      )}

      {loaded && (
        <div className="ds" style={{ margin: "0 0 8px", fontWeight: 600 }}>
          {counts.live ? `${counts.live} live circle${counts.live === 1 ? "" : "s"} right now` : "No live circle right now"}
          {counts.open ? ` · ${counts.open} waiting to start` : ""}
          {counts.join ? ` · ${counts.join} you can join` : ""}
        </div>
      )}
      {error && <div className="ds" style={{ marginBottom: 8 }}>{loaded ? `Showing the last known state. ${error}` : `Could not reach Monad just now. Retrying. ${error}`}</div>}
      <div className="posacts" style={{ marginBottom: 10 }}>
        {([["live", "Live"], ["open", "Open"], ["join", "Join"], ["done", "Completed"]] as ["live" | "open" | "join" | "done", string][]).map(([k, lab]) => (
          <button key={k} className={"mini " + (effTab === k ? "pay" : "ghost")} onClick={() => setSecTab(k)}>{lab} {counts[k]}</button>
        ))}
      </div>

      {focusId && loaded && !visible.some((c) => c.id === focusId) && (
        <div className="ds" style={{ marginBottom: 8 }}>Circle #{focusId} is not open to you. It may be invite-only, full, already running, or older than the most recent 12.</div>
      )}
      {!loaded ? <p className="muted">Loading your circles...</p> : shown.length === 0 ? (
        <p className="muted" style={{ marginTop: 2 }}>{visible.length ? "Nothing here right now. Try another tab above." : "No on-chain circles yet. Start one, or wait for a friend to start one you can join."}</p>
      ) : shown.map(card)}
    </div>
  );
}
