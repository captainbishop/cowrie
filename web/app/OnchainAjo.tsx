"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { parseAbi } from "viem";
import { ajoAbi, AJO_ADDRESS, AJO_STATUS } from "../lib/ajo";
import { addresses } from "../lib/contracts";

const tokenAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
]);

const MAX = 2n ** 256n - 1n;
const UNIT_SECONDS: Record<string, number> = { minutes: 60, hours: 3600, days: 86400, weeks: 604800, months: 2592000 };
const vaultDepositAbi = parseAbi(["function deposit(uint256 amount)"]);
// Remembers the last answer so the sheet shows your circles immediately when you reopen it.
const CACHE = new Map<string, { views: View[]; bal: bigint }>();

type RunUi = { description?: string; successHeader?: string; title?: string; buttonText?: string };
type RunFn = (fn: string, args: unknown[], ui?: RunUi, target?: { address: `0x${string}`; abi: any }) => Promise<string>;

type View = {
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
  paidNow: boolean;
  myDeposit: bigint;
  myStrikes: number;
  endsAt: number;
  inviteOnly: boolean;
};

// amounts are shown in the user's own currency via the fmt prop

function dur(s: number): string {
  if (s >= 86400) return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

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

export default function OnchainAjo({
  addr,
  publicClient,
  run,
  busy,
  setBusy,
  flash,
  errText,
  fmt,
  toU,
  symbol,
  perUsd,
  spendable,
  book,
  prefill,
  focusId,
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
}) {
  const cusd = (v: bigint) => fmt(v);
  const [views, setViews] = useState<View[]>(() => CACHE.get((addr || "").toLowerCase())?.views ?? []);
  const [loaded, setLoaded] = useState(() => CACHE.has((addr || "").toLowerCase()));
  const [bal, setBal] = useState<bigint>(() => CACHE.get((addr || "").toLowerCase())?.bal ?? 0n);
  const [, setTick] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [fName, setFName] = useState("Family Ajo");
  const [fAmt, setFAmt] = useState(String(Math.round(10 * perUsd)));
  const [fMult, setFMult] = useState("2");
  const [fLen, setFLen] = useState("5");
  const [fUnit, setFUnit] = useState("minutes");
  const [fSize, setFSize] = useState("3");
  const [fInvite, setFInvite] = useState(true);
  const [secTab, setSecTab] = useState<"auto" | "live" | "open" | "join" | "done">("auto");
  const [picked, setPicked] = useState<string[]>([]);

  const me = (addr || "").toLowerCase();

  // The chat can pre-fill this form ("start an ajo called X with Ike, 50k").
  useEffect(() => {
    if (!prefill) return;
    if (prefill.name) setFName(prefill.name);
    if (prefill.minutes && prefill.minutes > 0) {
      const m = prefill.minutes;
      const pair: [number, string] = m % 43200 === 0 ? [m / 43200, "months"] : m % 10080 === 0 ? [m / 10080, "weeks"] : m % 1440 === 0 ? [m / 1440, "days"] : m % 60 === 0 ? [m / 60, "hours"] : [m, "minutes"];
      setFLen(String(pair[0]));
      setFUnit(pair[1]);
    }
    if (prefill.amount && prefill.amount > 0) setFAmt(String(Math.round(prefill.amount)));
    const wanted = (prefill.invitees || []).map((n) => n.toLowerCase());
    const found = book
      .filter((b) => wanted.some((n) => b.name.toLowerCase() === n || b.name.toLowerCase().startsWith(n)))
      .map((b) => b.address.toLowerCase());
    if (found.length) {
      setPicked(found);
      setFInvite(true);
      setFSize(String(Math.min(20, found.length + 1)));
    }
    setShowForm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);
  const target = { address: AJO_ADDRESS, abi: ajoAbi };
  const read = useCallback(
    (functionName: string, args: unknown[]) =>
      publicClient.readContract({ address: AJO_ADDRESS, abi: ajoAbi, functionName, args }),
    [publicClient],
  );

  const load = useCallback(async () => {
    if (!addr || !AJO_ADDRESS) return;
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const [b, countRaw] = await Promise.all([
        publicClient.readContract({ address: addresses.usd, abi: tokenAbi, functionName: "balanceOf", args: [addr] }),
        read("circleCount", []),
      ]);
      setBal(b as bigint);
      const count = Number(countRaw);
      const nowSec = Math.floor(Date.now() / 1000);
      const ids: number[] = [];
      for (let i = count; i >= 1 && ids.length < 8; i--) ids.push(i);
      if (focusId && focusId <= count && !ids.includes(focusId)) ids.push(focusId);
      const rows = await Promise.all(
        ids.map(async (i): Promise<View | null> => {
          const id = BigInt(i);
          const c: any = await read("getCircle", [id]);
          const members: string[] = [...c.members];
          const mine = members.some((m) => m.toLowerCase() === me);
          const status = Number(c.status);
          const joinable = status === 0 && Number(c.joinDeadline) > nowSec;
          if (!mine && !joinable) return null;
          if (!mine && c.inviteOnly) {
            const invited = (await read("isInvited", [id, addr])) as boolean;
            if (!invited) return null;
          }
          let paidNow = false;
          let myDeposit = 0n;
          let myStrikes = 0;
          let endsAt = 0;
          if (mine) {
            const [dep, str] = await Promise.all([read("depositOf", [id, addr]), read("strikes", [id, addr])]);
            myDeposit = dep as bigint;
            myStrikes = Number(str);
            if (status === 2) {
              const [p, e] = await Promise.all([read("paid", [id, Number(c.round), addr]), read("roundEnd", [id])]);
              paidNow = p as boolean;
              endsAt = Number(e);
            }
          }
          return {
            id: i, name: c.name, contribution: c.contribution, deposit: c.deposit,
            maxMembers: Number(c.maxMembers), round: Number(c.round), status, members,
            order: [...c.order], mine, paidNow, myDeposit, myStrikes, endsAt, inviteOnly: !!c.inviteOnly,
          };
        }),
      );
      const out = rows.filter((x): x is View => x !== null).slice(0, 6);
      setViews(out);
      CACHE.set(me, { views: out, bal: b as bigint });
    } catch {
    } finally {
      setLoaded(true);
    }
  }, [addr, publicClient, read, me, focusId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 25000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  async function act(label: string, fn: () => Promise<boolean | void>) {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await fn();
      await load();
      if (ok !== false) flash(label);
    } catch (e) {
      flash(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const need = (amount: bigint) => {
    if (bal + spendable < amount) {
      flash(`Not enough spendable balance: you need ${cusd(amount)}.`);
      return false;
    }
    return true;
  };

  // Make sure the wallet holds `amount`, moving any shortfall out of spendable, then allow the Ajo contract.
  async function fund(amount: bigint) {
    const have = (await publicClient.readContract({ address: addresses.usd, abi: tokenAbi, functionName: "balanceOf", args: [addr] })) as bigint;
    if (have < amount) {
      await run("withdraw", [amount - have], { title: "Move money for your Ajo", description: `${cusd(amount - have)} from spendable to your wallet.`, successHeader: "Moved", buttonText: "Move" });
    }
    await approveIfNeeded(amount);
  }

  async function approveIfNeeded(amount: bigint) {
    const have = (await publicClient.readContract({ address: addresses.usd, abi: tokenAbi, functionName: "allowance", args: [addr, AJO_ADDRESS] })) as bigint;
    if (have >= amount) return;
    await run(
      "approve",
      [AJO_ADDRESS, MAX],
      { title: "Allow Cowrie Ajo", description: "Lets the Ajo contract take your deposit and your round payments.", successHeader: "Allowed", buttonText: "Allow" },
      { address: addresses.usd, abi: tokenAbi },
    );
  }

  const moveToSpendable = () =>
    act("Moved to spendable", async () => {
      const have = (await publicClient.readContract({ address: addresses.usd, abi: tokenAbi, functionName: "balanceOf", args: [addr] })) as bigint;
      if (have <= 0n) { flash("Nothing in your wallet to move."); return false; }
      const allowed = (await publicClient.readContract({ address: addresses.usd, abi: tokenAbi, functionName: "allowance", args: [addr, addresses.vault] })) as bigint;
      if (allowed < have) {
        await run("approve", [addresses.vault, MAX], { title: "Allow Cowrie", description: "Lets Cowrie move your Ajo money back into spendable.", successHeader: "Allowed", buttonText: "Allow" }, { address: addresses.usd, abi: tokenAbi });
      }
      await run("deposit", [have], { title: "Move to spendable", description: `${cusd(have)} back to your spendable balance.`, successHeader: "Moved", buttonText: "Move" }, { address: addresses.vault, abi: vaultDepositAbi });
    });

  const create = () =>
    act("Circle created", async () => {
      const contribution = toU(Number(fAmt) || 0);
      const mult = BigInt(Math.max(1, Math.floor(Number(fMult) || 1)));
      const deposit = contribution * mult;
      const size = Math.floor(Number(fSize));
      const period = Math.round((Number(fLen) || 0) * (UNIT_SECONDS[fUnit] || 60));
      if (!fName.trim()) throw new Error("Give the circle a name.");
      if (contribution <= 0n) throw new Error("Enter an amount per round.");
      if (!(size >= 2 && size <= 20)) throw new Error("A circle needs 2 to 20 members.");
      if (!(period >= 60)) throw new Error("Rounds must be at least 1 minute.");
      if (fInvite && picked.length === 0) throw new Error("Pick at least one friend to invite, or switch to Anyone can join.");
      if (!need(deposit)) return false;
      await fund(deposit);
      const joinDeadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 86400);
      await run(
        fInvite ? "createInviteOnlyCircle" : "createCircle",
        fInvite
          ? [{ name: fName.trim(), contribution, deposit, period: BigInt(period), joinDeadline, maxMembers: size }, picked]
          : [fName.trim(), contribution, deposit, BigInt(period), joinDeadline, size],
        { title: `Create "${fName.trim()}"`, description: `Locks a ${cusd(deposit)} deposit.`, successHeader: "Circle created", buttonText: "Create" },
        target,
      );
      setShowForm(false);
    });

  const join = (v: View) =>
    act("Joined the circle", async () => {
      if (!need(v.deposit)) return false;
      await fund(v.deposit);
      await run("join", [BigInt(v.id)], { title: `Join "${v.name}"`, description: `Locks a ${cusd(v.deposit)} deposit.`, successHeader: "Joined", buttonText: "Join" }, target);
    });

  const pay = (v: View) =>
    act("Paid for this round", async () => {
      if (!need(v.contribution)) return false;
      await fund(v.contribution);
      await run("contribute", [BigInt(v.id)], { title: `Pay "${v.name}"`, description: `${cusd(v.contribution)} for round ${v.round}.`, successHeader: "Paid", buttonText: "Pay" }, target);
    });

  const withdraw = (v: View) =>
    act("Deposit withdrawn", async () => {
      await run("withdrawDeposit", [BigInt(v.id)], { title: "Withdraw deposit", description: `${cusd(v.myDeposit)} back to your wallet.`, successHeader: "Withdrawn", buttonText: "Withdraw" }, target);
    });

  const who = (a: string) => (a.toLowerCase() === me ? "You" : `${a.slice(0, 6)}…${a.slice(-4)}`);

  const grpOf = (v: View): "live" | "open" | "join" | "done" => (v.status >= 3 ? "done" : v.status === 2 ? "live" : v.mine ? "open" : "join");
  const counts = { live: 0, open: 0, join: 0, done: 0 };
  views.forEach((v) => { counts[grpOf(v)] += 1; });
  const effTab: "live" | "open" | "join" | "done" = secTab !== "auto" ? secTab : counts.live ? "live" : counts.open ? "open" : counts.join ? "join" : counts.done ? "done" : "live";
  const shown = views.filter((v) => grpOf(v) === effTab);

  const share = async (v: View) => {
    const url = `${window.location.origin}/?ajo=${v.id}`;
    const text = `Join "${v.name}" on Cowrie: ${cusd(v.contribution)} each round.`;
    try {
      if (navigator.share) { await navigator.share({ title: "Cowrie Ajo", text, url }); return; }
    } catch { return; }
    try { await navigator.clipboard.writeText(url); flash("Link copied"); } catch { flash(url); }
  };

  if (!AJO_ADDRESS) return <p className="muted">On-chain Ajo is not set up yet. Add NEXT_PUBLIC_AJO_CIRCLE to web/.env.local.</p>;
  if (!addr) return null;

  return (
    <div style={{ marginBottom: 18 }}>
      <div className="poshead">
        On-chain Ajo <span style={{ color: "var(--brass)", fontWeight: 700 }}>· drawn and paid out by Chainlink CRE</span>
      </div>
      <div className="ds" style={{ marginBottom: 8 }}>Spendable: {cusd(spendable)}{bal > 0n ? ` · ${cusd(bal)} waiting in your wallet` : ""}</div>
      <div className="posacts" style={{ marginBottom: 10 }}>
        {bal > 0n && <button className="mini pay" onClick={moveToSpendable} disabled={busy}>Move {cusd(bal)} to spendable</button>}
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
                    <button
                      key={a}
                      className={"ajochip" + (on ? " on" : "")}
                      style={{ cursor: "pointer", font: "inherit" }}
                      onClick={() => {
                        const next = on ? picked.filter((x) => x !== a) : [...picked, a];
                        setPicked(next);
                        if (next.length) setFSize(String(Math.min(20, next.length + 1)));
                      }}
                    >
                      {on ? "✓ " : ""}{b.name}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="ds" style={{ marginBottom: 8 }}>
            You lock the deposit now. Other members join from their own Cowrie and lock the same deposit. When the circle is full, Chainlink CRE draws the payout order, and it pays out each round when the timer ends.
          </div>
          <div className="posacts"><button className="mini pay" onClick={create} disabled={busy}>Create circle</button></div>
        </div>
      )}

      {focusId && loaded && !views.some((x) => x.id === focusId) && (<div className="ds" style={{ marginBottom: 8 }}>Circle #{focusId} is not open to you. It may be invite-only, full or already running.</div>)}
      {loaded && (
        <div className="ds" style={{ margin: "0 0 8px", fontWeight: 600 }}>
          {counts.live ? `${counts.live} live circle${counts.live === 1 ? "" : "s"} right now` : "No live circle right now"}
          {counts.open ? ` · ${counts.open} waiting to start` : ""}
          {counts.join ? ` · ${counts.join} you can join` : ""}
        </div>
      )}
      <div className="posacts" style={{ marginBottom: 10 }}>
        {([["live", "Live"], ["open", "Open"], ["join", "Join"], ["done", "Completed"]] as ["live" | "open" | "join" | "done", string][]).map(([k, lab]) => (
          <button key={k} className={"mini " + (effTab === k ? "pay" : "ghost")} onClick={() => setSecTab(k)}>{lab} {counts[k]}</button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="muted" style={{ marginTop: 2 }}>{loaded ? (views.length ? "Nothing here right now. Try another tab above." : "No on-chain circles yet. Start one, or wait for a friend to start one you can join.") : "Loading your circles..."}</p>
      ) : (
        shown.map((v) => {
          const left = v.endsAt - Math.floor(Date.now() / 1000);
          const collector = v.order[v.round - 1];
          return (
            <div className="pcard" key={v.id} style={{ marginBottom: 10 }}>
              <div className="prow" style={{ cursor: "default" }}>
                <span className="prl">
                  <b>{v.name}</b>
                  <small>#{v.id} · {cusd(v.contribution)} each · {v.members.length}/{v.maxMembers} members{v.inviteOnly ? " · invite-only" : ""}</small>
                </span>
                <span className="prr"><b>{AJO_STATUS[v.status]}</b></span>
              </div>
              <div className="posexp">
                {v.status === 0 && !v.mine && (
                  <>
                    <div className="ds" style={{ marginBottom: 6 }}>Join with a {cusd(v.deposit)} deposit. You get it back at the end, minus any payment you miss.</div>
                    <div className="posacts"><button className="mini pay" onClick={() => join(v)} disabled={busy}>Join · lock {cusd(v.deposit)}</button></div>
                  </>
                )}
                {v.status === 0 && v.mine && (
                  <div className="ds">Waiting for {v.maxMembers - v.members.length} more {v.maxMembers - v.members.length === 1 ? "member" : "members"}. Friends can join from their own Cowrie.</div>
                )}
                {v.status === 1 && <div className="ds">Everyone is in. Waiting for the fair draw from Chainlink CRE.</div>}
                {v.status === 2 && (
                  <>
                    <div className="ds" style={{ marginBottom: 6 }}>Payout order <span style={{ color: "var(--brass)" }}>· drawn by Chainlink CRE from the live BTC price</span></div>
                    <div className="ajorder">
                      {v.order.map((a, pos) => (
                        <span key={pos} className={"ajochip" + (pos === v.round - 1 ? " on" : "")}>{pos + 1}. {who(a)}</span>
                      ))}
                    </div>
                    <div className="ds" style={{ margin: "8px 0" }}>
                      {left > 0 ? `Round ${v.round} ends in ${dur(left)}.` : `Round ${v.round} time is up. Chainlink CRE settles it and pays the pot to ${collector ? who(collector) : "the collector"}.`}
                    </div>
                    {v.mine && !v.paidNow && left > 0 && (
                      <div className="posacts"><button className="mini pay" onClick={() => pay(v)} disabled={busy}>Pay {cusd(v.contribution)} for round {v.round}</button></div>
                    )}
                    {v.mine && v.paidNow && <span className="muted2">You have paid for this round.</span>}
                  </>
                )}
                {(v.status === 3 || v.status === 4) && (
                  <>
                    <div className="ds" style={{ marginBottom: 6 }}>{v.status === 3 ? "Circle complete. Every round was paid out automatically." : "Circle cancelled."}</div>
                    {v.mine && v.myDeposit > 0n && (
                      <div className="posacts"><button className="mini pay" onClick={() => withdraw(v)} disabled={busy}>Withdraw {cusd(v.myDeposit)} deposit</button></div>
                    )}
                  </>
                )}
                {v.mine && v.status === 0 && (<div className="posacts" style={{ marginTop: 8 }}><button className="mini pay" onClick={() => share(v)}>Share link</button></div>)}
                {v.mine && v.myStrikes > 0 && <div className="ds" style={{ marginTop: 6 }}>Missed payments: {v.myStrikes}</div>}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
