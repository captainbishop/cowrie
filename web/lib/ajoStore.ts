"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { parseAbi } from "viem";
import { ajoAbi, AJO_ADDRESS } from "./ajo";
import { addresses } from "./contracts";

const balAbi = parseAbi(["function balanceOf(address) view returns (uint256)"]);

export type Circle = {
  id: number;
  name: string;
  creator: string;
  contribution: bigint;
  deposit: bigint;
  period: number;
  joinDeadline: number;
  fullAt: number;
  maxMembers: number;
  round: number;
  status: number; // 0 open, 1 full, 2 live, 3 completed, 4 cancelled, 5 ended
  inviteOnly: boolean;
  drawnBy: number; // 0 not drawn, 1 Chainlink CRE, 2 on-chain backup
  isMember: boolean;
  isInvited: boolean;
  paidNow: boolean;
  autopayOn: boolean;
  endVotedByMe: boolean;
  myDeposit: bigint;
  myStrikes: number;
  roundEndsAt: number;
  endVotes: number;
  members: string[];
  order: string[];
};

export type AjoState = {
  circles: Circle[];
  bal: bigint;
  fallbackEnabled: boolean;
  fallbackDelay: number;
  loaded: boolean;
  error: string;
};

const initial: AjoState = { circles: [], bal: 0n, fallbackEnabled: true, fallbackDelay: 600, loaded: false, error: "" };

let state: AjoState = initial;
let client: any = null;
let user = "";
let inflight = false;
let again = false;
let cfgAt = 0;
let timer: any = null;
let fastCount = 0;
const subs = new Set<() => void>();

const emit = () => subs.forEach((f) => f());
const ser = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? { $b: x.toString() } : x));
const de = (t: string) => JSON.parse(t, (_k, x) => (x && typeof x === "object" && "$b" in x ? BigInt((x as { $b: string }).$b) : x));
const cacheKey = (a: string) => `cowrie.ajo2.snap.${AJO_ADDRESS.slice(2, 8)}.${a}`;

function loadCache(a: string): AjoState {
  try {
    const raw = localStorage.getItem(cacheKey(a));
    if (raw) {
      const j = de(raw);
      if (Array.isArray(j.circles)) return { ...initial, circles: j.circles, bal: typeof j.bal === "bigint" ? j.bal : 0n, loaded: true };
    }
  } catch {}
  return initial;
}

function norm(b: any): Circle {
  return {
    id: Number(b.id), name: String(b.name), creator: String(b.creator),
    contribution: b.contribution as bigint, deposit: b.deposit as bigint,
    period: Number(b.period), joinDeadline: Number(b.joinDeadline), fullAt: Number(b.fullAt),
    maxMembers: Number(b.maxMembers), round: Number(b.round), status: Number(b.status),
    inviteOnly: !!b.inviteOnly, drawnBy: Number(b.drawnBy),
    isMember: !!b.isMember, isInvited: !!b.isInvited, paidNow: !!b.paidNow, autopayOn: !!b.autopayOn, endVotedByMe: !!b.endVotedByMe,
    myDeposit: b.myDeposit as bigint, myStrikes: Number(b.myStrikes), roundEndsAt: Number(b.roundEndsAt), endVotes: Number(b.endVotes),
    members: [...b.members].map(String), order: [...b.order].map(String),
  };
}

const read = (functionName: string, args: unknown[]) => client.readContract({ address: AJO_ADDRESS, abi: ajoAbi, functionName, args });

export async function refreshAjo(): Promise<void> {
  if (!client || !user || !AJO_ADDRESS) return;
  if (inflight) { again = true; return; }
  inflight = true;
  try {
    const [ov, bal] = await Promise.all([
      read("overview", [user, 12n]),
      client.readContract({ address: addresses.usd, abi: balAbi, functionName: "balanceOf", args: [user] }),
    ]);
    let { fallbackEnabled, fallbackDelay } = state;
    if (Date.now() - cfgAt > 60000) {
      try {
        const [fe, fd] = await Promise.all([read("fallbackEnabled", []), read("fallbackDelay", [])]);
        fallbackEnabled = !!fe;
        fallbackDelay = Number(fd);
        cfgAt = Date.now();
      } catch {}
    }
    state = { circles: (ov as any[]).map(norm), bal: bal as bigint, fallbackEnabled, fallbackDelay, loaded: true, error: "" };
    try { localStorage.setItem(cacheKey(user.toLowerCase()), ser({ circles: state.circles, bal: state.bal })); } catch {}
  } catch (e) {
    state = { ...state, error: String((e as any)?.shortMessage || (e as Error)?.message || e).slice(0, 140) };
  } finally {
    inflight = false;
    emit();
    if (again) { again = false; void refreshAjo(); }
  }
}

/** Waits for any read in progress, then reads again, so the result is newer than the action you just took. */
export async function refreshAjoNow(): Promise<void> {
  for (let i = 0; i < 25 && inflight; i++) await new Promise((r) => setTimeout(r, 150));
  await refreshAjo();
}

export const getAjoState = () => state;

function nextDelay(): number {
  if (typeof document !== "undefined" && document.hidden) return 30000;
  if (fastCount > 0) return 4000;
  const now = Math.floor(Date.now() / 1000);
  const hot = state.circles.some((c) => c.isMember && (c.status === 1 || (c.status === 2 && (c.roundEndsAt - now < 120 || !c.paidNow))));
  if (hot) return 6000;
  return state.circles.some((c) => c.status <= 2 && (c.isMember || c.status === 0)) ? 15000 : 30000;
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    if (subs.size === 0 || !client || !user) { timer = null; return; }
    if (!(typeof document !== "undefined" && document.hidden)) await refreshAjo();
    schedule();
  }, nextDelay());
}

export function useAjo(publicClient: any, addr: string | undefined, opts?: { fast?: boolean }) {
  const [, setN] = useState(0);
  const fast = !!opts?.fast;
  useEffect(() => {
    if (!addr || !AJO_ADDRESS) return;
    client = publicClient;
    if (user.toLowerCase() !== addr.toLowerCase()) {
      user = addr;
      state = loadCache(addr.toLowerCase());
      cfgAt = 0;
    }
    const f = () => setN((x) => x + 1);
    subs.add(f);
    if (fast) fastCount += 1;
    f();
    void refreshAjo();
    schedule();
    const vis = () => { if (!document.hidden) { void refreshAjo(); schedule(); } };
    document.addEventListener("visibilitychange", vis);
    return () => {
      subs.delete(f);
      if (fast) fastCount -= 1;
      document.removeEventListener("visibilitychange", vis);
    };
  }, [addr, publicClient, fast]);
  return { ...state, refresh: refreshAjoNow };
}

export function fmtDur(s: number): string {
  s = Math.max(0, Math.round(s));
  if (s >= 86400) return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${s}s`;
}

export function fmtLen(s: number): string {
  const f = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  if (s % 2592000 === 0) return f(s / 2592000, "month");
  if (s % 604800 === 0) return f(s / 604800, "week");
  if (s % 86400 === 0) return f(s / 86400, "day");
  if (s % 3600 === 0) return f(s / 3600, "hour");
  return f(Math.max(1, Math.round(s / 60)), "minute");
}
