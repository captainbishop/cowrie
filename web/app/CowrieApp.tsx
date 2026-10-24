"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import DemoVideo from "./DemoVideo";
import { usePrivy, useWallets, useSendTransaction } from "@privy-io/react-auth";
import { createPublicClient, createWalletClient, http, custom, formatUnits, formatEther, encodeFunctionData, parseAbiItem } from "viem";
import { monadTestnet } from "../lib/chain";
import { addresses, vaultAbi, scamAbi, usdAbi } from "../lib/contracts";
import { readAllFeeds, feedKeyFor } from "../lib/chainlink"; import OnchainAjo from "./OnchainAjo"; import { detectBill, billStart, billNext, billReceipt } from "../lib/bills"; import type { BillState, BillSay } from "../lib/bills"; import { ajoAbi, AJO_ADDRESS } from "../lib/ajo"; import AjoAgent from "./AjoAgent"; import { parseAjoText, ajoFacts } from "../lib/ajoIntent"; import { refreshAjoNow } from "../lib/ajoStore"; import type { AjoPending, AjoCommand, AjoExec } from "./AjoAgent";

const RATE = Number(process.env.NEXT_PUBLIC_NGN_PER_USD || 1600);
const CURRENCIES: Record<string, { symbol: string; perUsd: number }> = {
  NGN: { symbol: "₦", perUsd: RATE }, USD: { symbol: "$", perUsd: 1 },
  GHS: { symbol: "₵", perUsd: 15.5 }, KES: { symbol: "KSh", perUsd: 129 },
  ZAR: { symbol: "R", perUsd: 18.2 }, GBP: { symbol: "£", perUsd: 0.79 },
  EUR: { symbol: "€", perUsd: 0.92 }, INR: { symbol: "₹", perUsd: 83 },
};
function agoStr(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
// Fair, unriggable payout order for an Ajo circle, seeded by a live Chainlink price (a public beacon no member controls).
function seededOrder(n: number, seed: number): number[] {
  let s = (seed >>> 0) || 1;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const DEAD = "0x000000000000000000000000000000000000dEaD" as `0x${string}`;
const MERCHANT = "0x00000000000000000000000000000000000000A1" as `0x${string}`;
const contacts: Record<string, `0x${string}`> = {
  scammer: DEAD, seller: DEAD,
  friend: "0x0000000000000000000000000000000000000001",
  son: "0x0000000000000000000000000000000000000002",
  daughter: "0x0000000000000000000000000000000000000003",
  mum: "0x0000000000000000000000000000000000000004",
  landlord: "0x0000000000000000000000000000000000000005",
};
const BRANDS = [
  { k: /netflix/i, label: "Netflix", color: "#e50914" },
  { k: /spotify/i, label: "Spotify", color: "#1db954" },
  { k: /youtube|yt premium/i, label: "YouTube", color: "#ff0000" },
  { k: /apple|itunes|icloud|app ?store/i, label: "Apple", color: "#555555" },
  { k: /amazon|prime/i, label: "Prime", color: "#ff9900" },
  { k: /disney/i, label: "Disney+", color: "#113ccf" },
  { k: /dstv|gotv|showmax/i, label: "DStv", color: "#1b7fd4" },
  { k: /twitter|x premium/i, label: "X", color: "#111827" },
] as { k: RegExp; label: string; color: string }[];
function detectBrand(t: string) { for (const b of BRANDS) if (b.k.test(t)) return { label: b.label, color: b.color }; return null; }
type DApp = { label: string; desc: string; url: string; tag: string };
const DAPPS: Record<string, { intro: string; apps: DApp[] }> = {
  earn: {
    intro: "Here are real places to put your stablecoins to work and earn yield. Each opens in a new tab and you connect your own wallet there, Cowrie never moves your money for you.",
    apps: [
      { label: "Kintsu", desc: "Liquid staking on Monad, earn while your stake stays liquid.", url: "https://kintsu.xyz", tag: "Monad" },
      { label: "Aave", desc: "Lend out your stablecoins and earn interest on them.", url: "https://app.aave.com", tag: "multi-chain" },
      { label: "More on Monad", desc: "Browse every live app in the Monad ecosystem.", url: "https://www.monad.xyz", tag: "directory" },
    ],
  },
  predict: {
    intro: "Prediction markets let you back your view on real-world events. Each opens in a new tab and you connect your own wallet, Cowrie doesn't place anything for you.",
    apps: [
      { label: "Polymarket", desc: "Trade on elections, sports, prices and world events.", url: "https://polymarket.com", tag: "external" },
      { label: "More on Monad", desc: "Browse prediction and trading apps on Monad.", url: "https://www.monad.xyz", tag: "directory" },
    ],
  },
  trade: {
    intro: "Want to swap or trade tokens? These open in a new tab and you trade from your own wallet, Cowrie never trades for you.",
    apps: [
      { label: "Kuru", desc: "Fully on-chain order-book DEX, built on Monad.", url: "https://www.kuru.io", tag: "Monad" },
      { label: "More on Monad", desc: "Browse every DEX and app on Monad.", url: "https://www.monad.xyz", tag: "directory" },
    ],
  },
};
const CHIP_POOL = ["Send ₦5,000 to a friend", "Save 10% of what I receive", "Grow my savings", "What's my balance?", "Cap my spending at ₦20,000 a day", "Give my son ₦2,000 a day", "Remind me before Netflix renews", "Pay ₦7,500 to a seller", "Where can I earn yield?", "Swap ₦10,000 into bitcoin"];
const publicClient = createPublicClient({ chain: monadTestnet, transport: http() });
const EXPLORER = monadTestnet.blockExplorers?.default.url || "https://testnet.monadexplorer.com";

type Msg = { who: "you" | "cowrie"; tone?: "good" | "bad"; text: string; options?: string[]; links?: DApp[]; demo?: boolean };
type Tx = { hash: string; title: string; amount: string; sign: "pos" | "neg" | ""; ts: number };
const SENT_EVENT = parseAbiItem("event Sent(address indexed from, address indexed to, uint256 amount, uint256 autoSaved)");
type Sub = { id: string; service: string; amount: number; currency: string; cycleDays: number; startISO: string; nextISO: string };

function Icon({ children, size = 22 }: { children: React.ReactNode; size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>);
}
function CowrieMark({ size = 28 }: { size?: number }) {
  const teeth = Array.from({ length: 7 });
  return (
    <svg width={size} height={size * 1.14} viewBox="0 0 28 32" fill="none" aria-hidden="true">
      <defs><linearGradient id="cw" x1="4" y1="2" x2="24" y2="30" gradientUnits="userSpaceOnUse"><stop stopColor="#f3ead6" /><stop offset="1" stopColor="#c69a3f" /></linearGradient></defs>
      <ellipse cx="14" cy="16" rx="10" ry="15" fill="url(#cw)" stroke="#9c7526" strokeWidth="0.6" />
      <path d="M14 4.5C11.4 10 11.4 22 14 27.5C16.6 22 16.6 10 14 4.5Z" fill="#1b1733" />
      {teeth.map((_, i) => (<line key={i} x1="10.4" y1={9 + i * 2.3} x2="12.5" y2={9 + i * 2.3} stroke="#1b1733" strokeWidth="0.9" strokeLinecap="round" />))}
      {teeth.map((_, i) => (<line key={"r" + i} x1="15.5" y1={9 + i * 2.3} x2="17.6" y2={9 + i * 2.3} stroke="#1b1733" strokeWidth="0.9" strokeLinecap="round" />))}
    </svg>
  );
}

export default function CowrieApp() {
  const { ready, authenticated, login, logout, user, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const [spendable, setSpendable] = useState<bigint>(0n);
  const [savings, setSavings] = useState<bigint>(0n);
  const [gas, setGas] = useState<bigint>(0n);
  const [input, setInput] = useState("");
  const [thread, setThread] = useState<Msg[]>([]);
  const [history, setHistory] = useState<Tx[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [ccy, setCcy] = useState("NGN");
  const [hidden, setHidden] = useState(false);
  const [theme, setTheme] = useState("system");
  const [lang, setLang] = useState("Auto");
  const [brand, setBrand] = useState<{ label: string; color: string } | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [facts, setFacts] = useState<string[]>([]);
  const [tab, setTab] = useState("home");
  const [starters, setStarters] = useState<string[]>([]);
  const [earned, setEarned] = useState<bigint>(0n);
  const [earnP, setEarnP] = useState<bigint>(0n);
  const [posAmt, setPosAmt] = useState<number>(0);
  const [assets, setAssets] = useState<{ addr: `0x${string}`; symbol: string; decimals: number }[]>([]);
  const [assetData, setAssetData] = useState<Record<string, { holding: bigint; value: bigint; poolCusd: bigint; poolTok: bigint }>>({});
  const [amtByKey, setAmtByKey] = useState<Record<string, number>>({});
  const [actView, setActView] = useState<"portfolio" | "history" | "chats">("portfolio");
  const [openPos, setOpenPos] = useState<string | null>(null);
  const [requests, setRequests] = useState<{ id: string; who: string; amount: number; currency: string; note: string; ts: number }[]>([]);
  const [markets, setMarkets] = useState<{ id: number; question: string; resolved: boolean; outcome: boolean; poolYes: bigint; poolNo: bigint; yes: bigint; no: bigint }[]>([]);
  const [addAmt, setAddAmt] = useState(50000);
  const [book, setBook] = useState<{ name: string; address: `0x${string}` }[]>([]);
  const [clPrices, setClPrices] = useState<Record<string, { price: number; at: number }>>({});
  const [guards, setGuards] = useState<{ id: string; asset: string; op: string; price: number; act: string; amount?: number; currency?: string; done?: boolean }[]>([]);
  const [ajos, setAjos] = useState<{ id: string; name: string; amount: number; currency: string; members: { name: string; address?: string }[]; order: number[]; seedPrice: number; round: number; cycleDays?: number; nextISO?: string; pinged?: number }[]>([]);
  const [homePanel, setHomePanel] = useState<"guardian" | "ajo" | null>(null);
  const [nickname, setNickname] = useState("");
  const [sessions, setSessions] = useState<{ id: string; title: string; ts: number; msgs: { who: string; text: string; tone?: string; demo?: boolean }[] }[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [ajoPrefill, setAjoPrefill] = useState<{ name?: string; amount?: number; minutes?: number; invitees?: string[]; stamp: number } | null>(null);
  const [ajoCmd, setAjoCmd] = useState<AjoCommand | null>(null);
  const [ajoSummary, setAjoSummary] = useState<{ live: number; open: number; invited: number; done: number } | null>(null);
  const [ajoExec, setAjoExec] = useState<AjoExec | null>(null);
  const ajoPending = useRef<AjoPending | null>(null);
  const billFlow = useRef<BillState | null>(null);
  const billAt = useRef(0);
  const [linkCircle, setLinkCircle] = useState<number | null>(null);
  // A shared join link (?ajo=3) opens the Ajo sheet on that circle, even after sign-in.
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("ajo");
      if (q && /^\d+$/.test(q)) sessionStorage.setItem("cowrie.joinlink", q);
      const stored = sessionStorage.getItem("cowrie.joinlink");
      if (stored) setLinkCircle(Number(stored));
    } catch {}
  }, []);
  useEffect(() => {
    if (!authenticated || !linkCircle) return;
    setHomePanel("ajo"); setTab("home");
    try { sessionStorage.removeItem("cowrie.joinlink"); } catch {}
  }, [authenticated, linkCircle]);
  const [notes, setNotes] = useState<{ id: string; title: string; body: string; ts: number; read?: boolean }[]>([]);
  const curSid = useRef<string>(Date.now().toString(36));
  const [cName, setCName] = useState("");
  const [cAddr, setCAddr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const awaitingName = useRef(false);
  const askedName = useRef(false);
  const [nameReady, setNameReady] = useState(false);
  const seenIn = useRef<Set<string> | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const addr = (user?.wallet?.address || wallets[0]?.address) as `0x${string}` | undefined;
  const configured = addresses.vault?.length === 42;
  const anyU = user as unknown as { google?: { name?: string; email?: string }; email?: { address?: string }; farcaster?: { displayName?: string }; discord?: { username?: string } } | null;
  const rawName = anyU?.google?.name || anyU?.farcaster?.displayName || anyU?.discord?.username || anyU?.email?.address?.split("@")[0] || "there";
  const acctName = anyU?.google?.name || anyU?.farcaster?.displayName || anyU?.discord?.username || "";
  const acctEmail = anyU?.google?.email || anyU?.email?.address || "";
  const firstName = nickname || rawName.split(/[ ._@]/)[0].replace(/^./, (ch) => ch.toUpperCase());
  const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
  const greeted = useRef(false);

  const say = (m: Msg) => { setThread((t) => [...t, m]); if (m.tone === "good") { setCelebrate(true); setTimeout(() => setCelebrate(false), 1800); } };
  const flash = (s: string) => { setToast(s); setTimeout(() => setToast(""), 1500); };
  const conv = (u: bigint, code = ccy) => Number(formatUnits(u, 6)) * (CURRENCIES[code] || CURRENCIES.NGN).perUsd;
  const cfmt = (u: bigint, code = ccy) => {
    const c = CURRENCIES[code] || CURRENCIES.NGN;
    const d = c.perUsd >= 20 ? 0 : 2;
    return c.symbol + (c.symbol.length > 1 ? " " : "") + conv(u, code).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  };
  const mask = (s: string) => (hidden ? "••••••" : s);
  const amtStr = (n: number, code = ccy) => { const c = CURRENCIES[code] || CURRENCIES.NGN; return c.symbol + (c.symbol.length > 1 ? " " : "") + n.toLocaleString(); };
  const shortAddr = (x: string) => (/^0x[a-fA-F0-9]{40}$/.test(x) ? x.slice(0, 6) + "…" + x.slice(-4) : x);
  const usdBal = conv(spendable, "USD");
  const low = usdBal > 0 && usdBal < 10;
  const amb = celebrate ? "#16a34a" : brand?.color || (low ? "#e5484d" : null);
  const dueSubs = subs.map((s) => ({ s, days: Math.ceil((new Date(s.nextISO).getTime() - Date.now()) / 86400000) })).sort((a, b) => a.days - b.days);
  const alertCount = dueSubs.filter((d) => d.days <= 5).length;
  const heldVals = assets.reduce((s, a) => s + (assetData[a.addr]?.value || 0n), 0n);
  const defiTotal = earned + heldVals;
  const heldCount = assets.filter((a) => (assetData[a.addr]?.holding || 0n) > 0n).length;

  const refresh = useCallback(async () => {
    if (!addr || !configured) return;
    try {
      const [sp, sv, g] = await Promise.all([
        publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "spendable", args: [addr] }),
        publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "savings", args: [addr] }),
        publicClient.getBalance({ address: addr }),
      ]);
      setSpendable(sp as bigint); setSavings(sv as bigint); setGas(g as bigint);
      try {
        const [en, ep] = await Promise.all([
          publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "earnedOf", args: [addr] }),
          publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "earnPrincipal", args: [addr] }),
        ]);
        setEarned(en as bigint); setEarnP(ep as bigint);
      } catch { /* keep the last good Earn value */ }
      try {
        const entries = await Promise.all(assets.map(async (as) => {
          const [hold, val, pc, pt] = await Promise.all([
            publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "holding", args: [addr, as.addr] }),
            publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "holdingValue", args: [addr, as.addr] }),
            publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "poolCusd", args: [as.addr] }),
            publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "poolTok", args: [as.addr] }),
          ]);
          return [as.addr, { holding: hold as bigint, value: val as bigint, poolCusd: pc as bigint, poolTok: pt as bigint }] as const;
        }));
        setAssetData(Object.fromEntries(entries));
      } catch {}
      try {
        const mc = Number(await publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "marketsCount", args: [] }));
        const ms: { id: number; question: string; resolved: boolean; outcome: boolean; poolYes: bigint; poolNo: bigint; yes: bigint; no: bigint }[] = [];
        const rows = await Promise.all(Array.from({ length: mc }, async (_, i) => {
          const [mk, pos] = (await Promise.all([
            publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "markets", args: [BigInt(i)] }),
            publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "predictionOf", args: [BigInt(i), addr] }),
          ])) as [readonly [string, bigint, boolean, boolean, bigint, bigint], readonly [bigint, bigint]];
          return { id: i, question: mk[0], resolved: mk[2], outcome: mk[3], poolYes: mk[4], poolNo: mk[5], yes: pos[0], no: pos[1] };
        }));
        ms.push(...rows);
        setMarkets(ms);
      } catch {}
    } catch {}
  }, [addr, configured, assets]);
  useEffect(() => { refresh(); const t = setInterval(refresh, 4000); return () => clearInterval(t); }, [refresh]);
  useEffect(() => { if (!configured) return; let on = true; const run = async () => { try { const p = await readAllFeeds(); if (on && Object.keys(p).length) setClPrices(p); } catch {} }; run(); const t = setInterval(run, 45000); return () => { on = false; clearInterval(t); }; }, [configured]);
  // Money arriving from someone else: the vault emits Sent, so read those logs and
  // surface them, otherwise a credit never shows up in the receiver's history.
  useEffect(() => {
    if (!addr || !configured) return;
    let on = true;
    const scan = async () => {
      try {
        const latest = await publicClient.getBlockNumber();
        const fromBlock = latest > 9000n ? latest - 9000n : 0n;
        const logs = await publicClient.getLogs({ address: addresses.vault, event: SENT_EVENT, args: { to: addr }, fromBlock, toBlock: "latest" });
        if (!on || logs.length === 0) return;
        const rows: Tx[] = logs.filter((l) => l.transactionHash).map((l) => {
          const a = l.args as { from?: string; amount?: bigint };
          return { hash: l.transactionHash as string, title: `Received from ${shortAddr(a.from || "")}`, amount: cfmt(a.amount || 0n), sign: "pos" as const, ts: Date.now() };
        });
        if (seenIn.current === null) seenIn.current = new Set(rows.map((r) => r.hash));
        else {
          const fresh = rows.filter((r) => !seenIn.current!.has(r.hash));
          fresh.forEach((r) => seenIn.current!.add(r.hash));
          if (fresh.length > 0) { flash("Money received"); fresh.forEach((r) => notify("Money received", `${r.amount} ${r.title.replace("Received from", "from")}.`, "in-" + r.hash)); say({ who: "cowrie", tone: "good", text: fresh.length === 1 ? `${fresh[0].amount} just landed in your wallet, ${firstName}. ${fresh[0].title.replace("Received from", "It came from")}.` : `${fresh.length} payments just landed, ${firstName}. They're under Activity.` }); }
        }
        setHistory((prev) => { const have = new Set(prev.map((h) => h.hash)); const add = rows.filter((r) => !have.has(r.hash)); if (add.length === 0) return prev; const next = [...add, ...prev].slice(0, 50); if (addr) persist("cowrie.tx." + addr, JSON.stringify(next)); return next; });
      } catch {}
    };
    scan(); const t = setInterval(scan, 15000);
    return () => { on = false; clearInterval(t); };
  }, [addr, configured, firstName]);
  // Every conversation saves itself, keyed by the current session id, like a normal chat app.
  useEffect(() => {
    if (!addr || !thread.some((m) => m.who === "you")) return;
    const t = setTimeout(() => {
      setSessions((prev) => {
        const title = (thread.find((m) => m.who === "you")?.text || "Conversation").slice(0, 52);
        const s = { id: curSid.current, title, ts: Date.now(), msgs: thread.slice(-80).map(({ who, text, tone, demo }) => ({ who, text, tone, ...(demo ? { demo: true } : {}) })) };
        const next = [s, ...prev.filter((x) => x.id !== s.id)].slice(0, 30);
        persist("cowrie.sessions." + addr, JSON.stringify(next));
        return next;
      });
    }, 700);
    return () => clearTimeout(t);
  }, [thread, addr]);
  useEffect(() => {
    ajos.forEach((c) => {
      if (!c.nextISO || c.round >= c.members.length) return;
      if (new Date(c.nextISO).getTime() <= Date.now()) notify(`Ajo "${c.name}" is due`, `Cycle ${c.round + 1} of ${c.members.length} is due now. Open the Ajo card on Home to pay or collect.`, `ajo-due-${c.id}-${c.round}`);
    });
  }, [ajos]);
  useEffect(() => {
    if (tab !== "alerts" || !notes.some((n) => !n.read)) return;
    const t = setTimeout(() => setNotes((prev) => { const next = prev.map((n) => ({ ...n, read: true })); if (addr) persist("cowrie.notes." + addr, JSON.stringify(next)); return next; }), 1500);
    return () => clearTimeout(t);
  }, [tab, notes, addr]);
  useEffect(() => {
    if (!guards.length) return;
    let changed = false;
    const next = guards.map((g) => {
      if (g.done) return g;
      const p = clPrices[g.asset]?.price; if (!p) return g;
      const hit = g.op === "below" ? p <= g.price : p >= g.price;
      if (!hit) return g;
      changed = true;
      flash(`${g.asset} hit $${g.price.toLocaleString()}`);
      notify(`Guardian: ${g.asset} ${g.op} $${g.price.toLocaleString()}`, `Chainlink has ${g.asset} at $${Math.round(p).toLocaleString()}.`, "g-" + g.id);
      const head = `${g.asset} just went ${g.op} $${g.price.toLocaleString()}, ${firstName}. Chainlink has it at $${Math.round(p).toLocaleString()}.`;
      if (g.act === "notify") say({ who: "cowrie", tone: "good", text: `${head} You asked me to flag it, so here it is.` });
      else if (g.act === "protect") say({ who: "cowrie", tone: "good", text: `${head} You wanted your savings moved to safety, tap to grow them in the vault.`, options: ["Grow my savings", "Not now"] });
      else say({ who: "cowrie", tone: "good", text: `${head} You wanted me to ${g.act}${g.amount ? " " + amtStr(g.amount) : ""}, want me to go ahead?`, options: [g.act === "sell" ? `Sell ${g.asset}` : `Buy ${g.asset}`, "Not now"] });
      return { ...g, done: true };
    });
    if (changed) { setGuards(next); if (addr) persist("cowrie.guards." + addr, JSON.stringify(next)); }
  }, [clPrices, guards, addr, firstName]);
  useEffect(() => { if (tab === "home") endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread, busy, tab]);
  // Tell the user when someone invites them to an on-chain Ajo circle.
  useEffect(() => {
    if (!addr || !AJO_ADDRESS) return;
    let on = true;
    const check = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const count = Number(await publicClient.readContract({ address: AJO_ADDRESS, abi: ajoAbi, functionName: "circleCount", args: [] }));
        for (let i = count; i >= Math.max(1, count - 4); i--) {
          const c: any = await publicClient.readContract({ address: AJO_ADDRESS, abi: ajoAbi, functionName: "getCircle", args: [BigInt(i)] });
          if (!on) return;
          if (Number(c.status) !== 0 || !c.inviteOnly) continue;
          if ((c.members as string[]).some((m) => m.toLowerCase() === addr.toLowerCase())) continue;
          const inv = await publicClient.readContract({ address: AJO_ADDRESS, abi: ajoAbi, functionName: "isInvited", args: [BigInt(i), addr] });
          if (inv) notify(`Invited to ${c.name}`, `You were invited to the Ajo circle "${c.name}". Open the Ajo sheet on Home to join.`, `ajo-invite-${AJO_ADDRESS.slice(2, 8)}-${i}`);
        }
      } catch {}
    };
    check();
    const t = setInterval(check, 120000);
    return () => { on = false; clearInterval(t); };
  }, [addr]);
  useEffect(() => { const el = taRef.current; if (!el) return; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 140) + "px"; el.style.overflowY = el.scrollHeight > 140 ? "auto" : "hidden"; }, [input]);
  useEffect(() => { const p = [...CHIP_POOL]; for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } setStarters(p.slice(0, 2)); }, []);
  useEffect(() => {
    if (!addr || !configured) return;
    (async () => {
      try {
        try { const cached = localStorage.getItem("cowrie.assets"); if (cached) setAssets(JSON.parse(cached)); } catch {}
        const n = Number((await publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "listedTokensCount", args: [] })) as bigint);
        const list = await Promise.all(Array.from({ length: n }, async (_, i) => {
          const a = (await publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "listedTokens", args: [BigInt(i)] })) as `0x${string}`;
          const [sym, dec] = await Promise.all([
            publicClient.readContract({ address: a, abi: usdAbi, functionName: "symbol", args: [] }).catch(() => a.slice(0, 6)),
            publicClient.readContract({ address: a, abi: usdAbi, functionName: "decimals", args: [] }).catch(() => 18),
          ]);
          return { addr: a, symbol: String(sym), decimals: Number(dec) };
        }));
        setAssets(list);
        try { localStorage.setItem("cowrie.assets", JSON.stringify(list)); } catch {}
      } catch {}
    })();
  }, [addr, configured]);
  useEffect(() => { if (authenticated && configured && nameReady && !greeted.current) { greeted.current = true; const h = new Date().getHours(); const tod = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; setThread((t) => (t.length ? t : [{ who: "cowrie", text: pick([`${tod}, ${firstName}. Your money's ready, tell me what to do, or tap a suggestion.`, `${tod}, ${firstName}. What should we do with your money today?`]) }])); } }, [authenticated, configured, firstName, nameReady]);
  // First time on this device: ask what Cowrie should call the user, instead of using the email name.
  useEffect(() => {
    if (!authenticated || !addr || !configured || askedName.current) return;
    askedName.current = true;
    let saved = "";
    try { saved = localStorage.getItem("cowrie.nick." + addr) || ""; } catch {}
    if (saved) { setNameReady(true); return; }
    awaitingName.current = true;
    const hr = new Date().getHours();
    const tod = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
    setThread((t) => [...t, { who: "cowrie", text: `${tod}. Before we start, what should I call you? A first name or a nickname is fine, and you can change it any time in Settings.` }]);
  }, [authenticated, addr, configured]);
  useEffect(() => { const s = localStorage.getItem("cowrie.ccy"); if (s && CURRENCIES[s]) setCcy(s); setHidden(localStorage.getItem("cowrie.hidden") === "1"); const th = localStorage.getItem("cowrie.theme"); if (th) setTheme(th); const lg = localStorage.getItem("cowrie.lang"); if (lg) setLang(lg); }, []);
  useEffect(() => { if (!addr) return; try { const s = localStorage.getItem("cowrie.tx." + addr); setHistory(s ? JSON.parse(s) : []); } catch {} }, [addr]);
  useEffect(() => { if (!addr) return; try { const s = localStorage.getItem("cowrie.book." + addr); setBook(s ? JSON.parse(s) : []); } catch {} }, [addr]);
  useEffect(() => { if (!addr) return; try { const s = localStorage.getItem("cowrie.subs." + addr); setSubs(s ? JSON.parse(s) : []); const fArr = JSON.parse(localStorage.getItem("cowrie.facts." + addr) || "[]"); setFacts(fArr); const r = localStorage.getItem("cowrie.req." + addr); setRequests(r ? JSON.parse(r) : []);
      const gd = localStorage.getItem("cowrie.guards." + addr); setGuards(gd ? JSON.parse(gd) : []);
      const aj = localStorage.getItem("cowrie.ajo." + addr); setAjos(aj ? JSON.parse(aj) : []);
      setNickname(localStorage.getItem("cowrie.nick." + addr) || "");
      const ss = localStorage.getItem("cowrie.sessions." + addr); setSessions(ss ? JSON.parse(ss) : []);
      const nt = localStorage.getItem("cowrie.notes." + addr); setNotes(nt ? JSON.parse(nt) : []);
      const bk = JSON.parse(localStorage.getItem("cowrie.book." + addr) || "[]"); const have = new Set(bk.map((x: { address: string }) => x.address.toLowerCase())); let changed = false;
      for (const fact of (Array.isArray(fArr) ? fArr : [])) { const m = String(fact).match(/([A-Za-z][A-Za-z0-9 ._-]{0,24}?)(?:'s)?\s*(?:=|:|is|address|wallet|at)\s*.{0,14}?(0x[a-fA-F0-9]{40})/i); if (m && !have.has(m[2].toLowerCase())) { const nm = m[1].trim().replace(/\b(my|the|a|contact|wallet|address|save|add|as|is)\b/gi, "").trim(); if (nm) { bk.push({ name: nm[0].toUpperCase() + nm.slice(1), address: m[2] }); have.add(m[2].toLowerCase()); changed = true; } } }
      if (changed) { persist("cowrie.book." + addr, JSON.stringify(bk)); setBook(bk); }
    } catch {} }, [addr]);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { const eff = theme === "system" ? (mq.matches ? "dark" : "light") : theme; document.documentElement.dataset.theme = eff; };
    apply(); mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, [theme]);
  const persist = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };

  // Show the last known portfolio instantly, then let the fresh reads replace it.
  const snapSer = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? { $b: x.toString() } : x));
  const snapDe = (t: string) => JSON.parse(t, (_k, x) => (x && typeof x === "object" && "$b" in x ? BigInt((x as { $b: string }).$b) : x));
  useEffect(() => {
    if (!addr) return;
    try {
      const raw = localStorage.getItem("cowrie.snap." + addr);
      if (!raw) return;
      const j = snapDe(raw);
      if (typeof j.spendable === "bigint") setSpendable(j.spendable);
      if (typeof j.savings === "bigint") setSavings(j.savings);
      if (typeof j.earned === "bigint") setEarned(j.earned);
      if (j.assetData && typeof j.assetData === "object") setAssetData(j.assetData);
      if (Array.isArray(j.markets)) setMarkets(j.markets);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr]);
  useEffect(() => {
    if (!addr) return;
    const t = setTimeout(() => {
      try { localStorage.setItem("cowrie.snap." + addr, snapSer({ spendable, savings, earned, assetData, markets })); } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [addr, spendable, savings, earned, assetData, markets]);

  // Contacts follow the login: saved to the account's database when it is set up, restored on any device.
  const bookSynced = useRef(false);
  useEffect(() => {
    bookSynced.current = false;
    if (!addr || !authenticated) return;
    let on = true;
    (async () => {
      try {
        const tok = await getAccessToken();
        if (!tok) return;
        const r = await fetch("/api/store?key=book", { headers: { Authorization: `Bearer ${tok}` } });
        if (!r.ok || !on) return;
        const j = await r.json();
        if (!on) return;
        if (Array.isArray(j.value)) {
          setBook(j.value);
          persist("cowrie.book." + addr, JSON.stringify(j.value));
        } else {
          const local = JSON.parse(localStorage.getItem("cowrie.book." + addr) || "[]");
          if (Array.isArray(local) && local.length) {
            await fetch("/api/store", { method: "PUT", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify({ key: "book", value: local }) });
          }
        }
        bookSynced.current = true;
      } catch {}
    })();
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr, authenticated]);
  useEffect(() => {
    if (!bookSynced.current || !addr) return;
    const t = setTimeout(async () => {
      try {
        const tok = await getAccessToken();
        if (!tok) return;
        await fetch("/api/store", { method: "PUT", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify({ key: "book", value: book }) });
      } catch {}
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book]);
  const changeCcy = (c: string) => { setCcy(c); persist("cowrie.ccy", c); };
  const changeTheme = (t: string) => { setTheme(t); persist("cowrie.theme", t); };
  const changeLang = (l: string) => { setLang(l); persist("cowrie.lang", l); };
  const toggleHidden = () => setHidden((h) => { persist("cowrie.hidden", h ? "0" : "1"); return !h; });
  const copyAddr = async () => { if (addr) { await navigator.clipboard.writeText(addr); flash("Address copied"); } };
  const logTx = (e: Omit<Tx, "ts">) => setHistory((prev) => { const next = [{ ...e, ts: Date.now() }, ...prev].slice(0, 50); if (addr) persist("cowrie.tx." + addr, JSON.stringify(next)); return next; });
  const saveContact = (name: string, address: string) => setBook((prev) => { const next = [...prev.filter((x) => x.address.toLowerCase() !== address.toLowerCase()), { name, address: address as `0x${string}` }]; if (addr) persist("cowrie.book." + addr, JSON.stringify(next)); return next; });
  const removeContact = (address: string) => setBook((prev) => { const next = prev.filter((x) => x.address !== address); if (addr) persist("cowrie.book." + addr, JSON.stringify(next)); return next; });
  const setNick = (n: string) => { setNickname(n); if (addr) persist("cowrie.nick." + addr, n); };
  function newChat() {
    curSid.current = Date.now().toString(36);
    setThread([{ who: "cowrie", text: `Fresh chat, ${firstName}. Your last one is saved under Activity, Chats. What should we do?` }]);
    setExpanded(false); setTab("home");
  }
  function openSession(id: string) {
    const s = sessions.find((x) => x.id === id); if (!s) return;
    curSid.current = s.id; setThread(s.msgs as typeof thread); setTab("home"); flash("Chat reopened");
  }
  const notify = (title: string, body: string, id?: string) => setNotes((prev) => {
    const nid = id || Date.now().toString(36) + Math.random().toString(16).slice(2, 5);
    if (prev.some((n) => n.id === nid)) return prev;
    const next = [{ id: nid, title, body, ts: Date.now() }, ...prev].slice(0, 40);
    if (addr) persist("cowrie.notes." + addr, JSON.stringify(next));
    return next;
  });
  const unread = notes.filter((n) => !n.read).length;
  const hasChat = thread.some((m) => m.who === "you");
  const heroOpen = expanded || !hasChat;
  const expandAt = useRef(0);
  const openHero = () => { expandAt.current = Date.now(); setExpanded(true); };
  async function sellPct(a: string, pct: number) {
    const d = assetData[a];
    if (busy || !d || d.holding <= 0n) { flash("Nothing to sell"); return; }
    const tokIn = pct >= 100 ? d.holding : (d.holding * BigInt(pct)) / 100n;
    const val = pct >= 100 ? d.value : (d.value * BigInt(pct)) / 100n;
    if (tokIn <= 0n) return;
    setBusy(true);
    try {
      const h = await run("swapTokenForCusd", [a, tokIn], { description: `Sell ${pct}% of your ${symOf(a)}, about ${cfmt(val)}.`, successHeader: "Sold", title: `Sell ${pct}% of ${symOf(a)}`, buttonText: `Sell ${pct}%` });
      logTx({ hash: h, title: `Sold ${pct}% of ${symOf(a)}`, amount: cfmt(val), sign: "pos" });
      say({ who: "cowrie", tone: "good", text: `Sold ${pct === 100 ? "all" : pct + "%"} of your ${symOf(a)}, about ${cfmt(val)} back to spendable, ${firstName}.` });
      await refresh();
    } catch (e) { say({ who: "cowrie", tone: "bad", text: txErr(e) }); }
    finally { setBusy(false); }
  }
  function deleteSession(id: string) { const next = sessions.filter((x) => x.id !== id); setSessions(next); if (addr) persist("cowrie.sessions." + addr, JSON.stringify(next)); }
  const remember = (fact: string) => setFacts((p) => { if (!fact || p.includes(fact)) return p; const n = [...p, fact].slice(-30); if (addr) persist("cowrie.facts." + addr, JSON.stringify(n)); return n; });
  const saveSubs = (n: Sub[]) => { setSubs(n); if (addr) persist("cowrie.subs." + addr, JSON.stringify(n)); };
  const addSub = (service: string, amount: number, currency: string, cycleDays?: number, startedDaysAgo?: number) => {
    const now = Date.now(); const cd = cycleDays && cycleDays > 0 ? cycleDays : 30;
    const start = now - (startedDaysAgo || 0) * 86400000; const next = start + cd * 86400000;
    const s: Sub = { id: String(now), service, amount: amount || 0, currency: CURRENCIES[currency] ? currency : "NGN", cycleDays: cd, startISO: new Date(start).toISOString(), nextISO: new Date(next).toISOString() };
    saveSubs([...subs.filter((x) => x.service.toLowerCase() !== service.toLowerCase()), s]);
    return s;
  };
  const addReminder = (title: string, amount: number, currency: string, dueInDays?: number, repeatDays?: number) => {
    const now = Date.now(); const next = now + (dueInDays && dueInDays > 0 ? dueInDays : 0) * 86400000;
    const s: Sub = { id: String(now), service: title, amount: amount || 0, currency: CURRENCIES[currency] ? currency : "NGN", cycleDays: repeatDays && repeatDays > 0 ? repeatDays : 0, startISO: new Date(now).toISOString(), nextISO: new Date(next).toISOString() };
    saveSubs([...subs, s]); return s;
  };
  const cancelSub = (id: string) => saveSubs(subs.filter((x) => x.id !== id));
  const addRequest = (who: string, amount: number, currency: string, note: string) => setRequests((p) => { const n = [{ id: String(Date.now()) + Math.random().toString(16).slice(2, 6), who, amount, currency: CURRENCIES[currency] ? currency : ccy, note, ts: Date.now() }, ...p].slice(0, 30); if (addr) persist("cowrie.req." + addr, JSON.stringify(n)); return n; });
  const removeRequest = (id: string) => setRequests((p) => { const n = p.filter((x) => x.id !== id); if (addr) persist("cowrie.req." + addr, JSON.stringify(n)); return n; });
  async function completeReminder(s: Sub) {
    if (busy) return;
    setBusy(true);
    try {
      if (s.amount > 0) { const h = await run("send", [MERCHANT, toUnits(s.amount, s.currency)], { description: `Pay ${s.service}, ${amtStr(s.amount, s.currency)}.`, successHeader: "Paid", title: s.service }); logTx({ hash: h, title: `${s.service} paid`, amount: amtStr(s.amount, s.currency), sign: "neg" }); }
      if (s.cycleDays > 0) { saveSubs(subs.map((x) => (x.id === s.id ? { ...x, nextISO: new Date(Date.now() + s.cycleDays * 86400000).toISOString() } : x))); say({ who: "cowrie", tone: "good", text: `Sorted ${s.service}. The next one is in ${s.cycleDays} days, I'll remind you.` }); }
      else { saveSubs(subs.filter((x) => x.id !== s.id)); say({ who: "cowrie", tone: "good", text: `Done. I've cleared ${s.service} off your reminders.` }); }
      setTab("home"); await refresh();
    } catch (e) { say({ who: "cowrie", tone: "bad", text: txErr(e) }); }
    finally { setBusy(false); }
  }
  async function getWallet() {
    const w = wallets.find((x) => x.walletClientType === "privy") || wallets[0];
    if (!w) throw new Error("Please sign in again.");
    await w.switchChain(monadTestnet.id);
    return createWalletClient({ account: w.address as `0x${string}`, chain: monadTestnet, transport: custom(await w.getEthereumProvider()) });
  }
  function toUnits(amount: number, code: string) { return BigInt(Math.round((amount / (CURRENCIES[code] || CURRENCIES.NGN).perUsd) * 1e6)); }
  function resolveTo(to: string): `0x${string}` | null {
    if (/^0x[a-fA-F0-9]{40}$/.test(to)) return to as `0x${string}`;
    const toks = to.toLowerCase().replace(/\b(a|an|the|my|to|new|some)\b/g, " ").trim().split(/\s+/).filter(Boolean);
    for (const w of toks) {
      const saved = book.find((x) => x.name.toLowerCase() === w || x.name.toLowerCase().startsWith(w));
      if (saved) return saved.address;
      if (contacts[w]) return contacts[w];
    }
    return null;
  }
  async function run(fn: string, args: unknown[], ui?: { description?: string; successHeader?: string; title?: string; buttonText?: string }, target?: { address: `0x${string}`; abi: any }) {
    const data = encodeFunctionData({ abi: target?.abi ?? vaultAbi, functionName: fn as never, args: args as never });
    let hash: `0x${string}`;
    try {
      const r = await sendTransaction(
        { to: target?.address ?? addresses.vault, data, chainId: monadTestnet.id },
        {  sponsor: true,uiOptions: { showWalletUIs: true, buttonText: ui?.buttonText || "Confirm", successHeader: ui?.successHeader || "All done", successDescription: ui?.description || "", transactionInfo: { title: ui?.title || ui?.description || "Cowrie" } } }
      );
      hash = r.hash as `0x${string}`;
    } catch (e) {
      const m = (e as { message?: string })?.message || "";
      if (/reject|denied|declined|cancel/i.test(m)) throw e;
      const client = await getWallet();
      hash = (await client.writeContract({ address: target?.address ?? addresses.vault, abi: target?.abi ?? vaultAbi, functionName: fn as never, args: args as never })) as `0x${string}`;
    }
    const rcpt = await publicClient.waitForTransactionReceipt({ hash });
    if (rcpt.status === "reverted") throw new Error("reverted on-chain");
    return hash as string;
  }
  // ---- Bill payments: a guided, confirmed flow (the biller is a demo, the test money is real on Monad testnet) ----
  function billSayAll(list: BillSay[]) { list.forEach((m) => say({ who: "cowrie", text: m.text, tone: m.tone, options: m.options })); }
  function billRun(out: ReturnType<typeof billStart>) {
    billFlow.current = out.state;
    billSayAll(out.say);
    if (out.later && out.later.length) { const later = out.later; setTimeout(() => billSayAll(later), out.delayMs || 900); }
  }
  function startBill(kind: Parameters<typeof billStart>[0]) { billAt.current = Date.now(); billRun(billStart(kind)); }
  async function billInput(text: string, viaAI = false) {
    const st = billFlow.current;
    if (!st) return;
    const out = billNext(st, text);
    // The steps could not read it, and the user wrote real words: let the AI work out what they mean.
    const unchanged = !!out.state && out.state.step === st.step && JSON.stringify(out.state.d) === JSON.stringify(st.d) && !out.pay && !out.later;
    if (!viaAI && unchanged && st.step !== "paying" && /[a-z]{3,}/i.test(text) && !/\b(change|edit|wrong|incorrect|mistake|switch|redo|different|another)\b/i.test(text)) {
      setBusy(true);
      const op = await billAsk(st, text, out);
      setBusy(false);
      if (op) { await billApply(st, text, op, out); return; }
    }
    billRun(out);
    if (out.pay && out.state) await billPay(out.state, out.pay);
  }
  async function billAsk(st: BillState, text: string, out: ReturnType<typeof billNext>): Promise<any> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 14000);
      const d = st.d;
      const flow = { kind: st.kind, step: st.step, question: out.say[0]?.text || "", fields: { company: d.disco, meterType: d.mtype, meter: d.meter, customer: d.cust?.name, amount: d.amount, total: d.total, network: d.net, phone: d.phone, plan: d.plan, provider: d.prov, card: d.card, package: d.pkg } };
      const res = await fetch("/api/flow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, flow, name: firstName, lang }), signal: ctrl.signal });
      clearTimeout(timer);
      const j = await res.json();
      return j && j.ok && j.op ? j : null;
    } catch { return null; }
  }
  async function billApply(st: BillState, text: string, op: any, fallback: ReturnType<typeof billNext>) {
    const agreed = /\b(pay|yes|yeah|yep|confirm|go ahead|proceed|do it|sure|ok|okay)\b/i.test(text);
    if (op.op === "cancel") { billFlow.current = null; say({ who: "cowrie", text: "Okay, I cancelled that. Nothing was paid." }); return; }
    if (op.op === "say" && op.text) { say({ who: "cowrie", text: String(op.text), options: fallback.say[0]?.options }); return; }
    if (op.op === "redo") {
      const map: Record<string, string> = { meter: "change meter number", company: "change company", amount: "change amount", type: "change type", network: "change network", number: "change phone number", plan: "change plan", card: "change card number", provider: "change provider", package: "change package" };
      const cmd = map[String(op.what)];
      if (cmd) { await billInput(cmd, true); return; }
    }
    if (op.op === "answer" && op.text) {
      const ans = String(op.text).slice(0, 80);
      if (/^\s*pay\b/i.test(ans) && !(st.step === "confirm" && agreed)) { say({ who: "cowrie", text: 'Say "pay" when you are ready to go ahead.', options: fallback.say[0]?.options }); return; }
      await billInput(ans, true);
      return;
    }
    billRun(fallback);
  }
  async function billPay(st: BillState, pay: { naira: number; title: string; desc: string }) {
    const units = toUnits(pay.naira, "NGN");
    if (units > spendable) {
      say({ who: "cowrie", tone: "bad", text: `You have ${cfmt(spendable)} to spend right now, ${firstName}, and this bill is ${amtStr(pay.naira, "NGN")}. Add money or choose a smaller amount.` });
      billFlow.current = { ...st, step: "confirm" };
      return;
    }
    setBusy(true);
    try {
      const h = await run("send", [MERCHANT, units], { description: pay.desc, successHeader: "Paid", title: pay.title });
      logTx({ hash: h, title: pay.title, amount: amtStr(pay.naira, "NGN"), sign: "neg" });
      billFlow.current = null;
      say({ who: "cowrie", tone: "good", text: billReceipt(st, h) });
      await refresh();
    } catch (e) {
      billFlow.current = { ...st, step: "confirm" };
      say({ who: "cowrie", tone: "bad", text: `${txErr(e)} Nothing was paid. Say "pay" to try again, or "cancel".` });
    } finally {
      setBusy(false);
    }
  }
  function txErr(e: unknown) { const msg = (e as { shortMessage?: string; message?: string })?.shortMessage || (e as Error)?.message || "something went wrong"; if (/abort|timed? ?out|timeout/i.test(msg)) return `That took longer than expected, ${firstName}. Mind trying again?`; if (/insufficient funds/i.test(msg)) return `Your wallet's out of MON for gas, ${firstName}. Top it up and I'll try again.`; if (/user rejected|denied|rejected the request/i.test(msg)) return `No problem,I cancelled that. Nothing left your wallet.`; if (/reverted/i.test(msg)) return `That didn't go through, ${firstName}, it reverted on-chain. Your balance might be short, or the pool or market isn't ready yet. Want to try again?`; if (/rpc|request failed|http|fetch|network|connection|econn|socket|timeout|gateway|50[0-9]|429/i.test(msg)) return `The Monad network didn't answer that time, ${firstName}. Nothing left your wallet, give it a moment and try again.`; return `That didn't go through: ${msg.slice(0, 110)}. Want to try again?`; }
  async function payContact(address: string, name: string, n: number) {
    if (busy || n <= 0) return;
    const to = address as `0x${string}`;
    setBusy(true);
    try {
      const flagged = await publicClient.readContract({ address: addresses.scam, abi: scamAbi, functionName: "isFlagged", args: [to] });
      if (flagged) { say({ who: "cowrie", tone: "bad", text: `Hold on, ${firstName}, that address is flagged as a scam. I didn't send anything.` }); return; }
      const units = toUnits(n, ccy);
      if (units > spendable) { say({ who: "cowrie", tone: "bad", text: `You've got ${cfmt(spendable)} to spend right now, ${firstName}. Add money or try a smaller amount.` }); return; }
      const h = await run("send", [to, units], { description: `Send ${amtStr(n)} to ${name}.`, successHeader: "Sent", title: `Send ${amtStr(n)} to ${name}`, buttonText: "Send" });
      logTx({ hash: h, title: `Sent to ${name}`, amount: amtStr(n), sign: "neg" });
      setAmtByKey((m) => ({ ...m, [address]: 0 })); setOpenPos(null); setTab("home");
      say({ who: "cowrie", tone: "good", text: `Sent ${amtStr(n)} to ${name}, ${firstName}. Landed in under a second.` });
      await refresh();
    } catch (e) { say({ who: "cowrie", tone: "bad", text: txErr(e) }); }
    finally { setBusy(false); }
  }
  function advanceAjo(id: string) { setAjos((prev) => { const n = prev.map((a) => (a.id === id ? { ...a, round: a.round + 1, nextISO: new Date(Date.now() + (a.cycleDays || 30) * 86400000).toISOString(), pinged: 0 } : a)); if (addr) persist("cowrie.ajo." + addr, JSON.stringify(n)); return n; }); }
  function collectPot(id: string) {
    const c = ajos.find((a) => a.id === id); if (!c) return;
    const others = c.members.filter((m, i) => i !== 0 || false).filter((m) => m.name !== (firstName || "You"));
    others.forEach((m) => addRequest(m.name, c.amount, c.currency, `${c.name} ajo share`));
    setAjos((prev) => { const n = prev.map((a) => (a.id === id ? { ...a, pinged: Date.now() } : a)); if (addr) persist("cowrie.ajo." + addr, JSON.stringify(n)); return n; });
    say({ who: "cowrie", tone: "good", text: `It's your turn in "${c.name}", ${firstName}. I've put a request for ${amtStr(c.amount, c.currency)} to each of the other ${others.length} ${others.length === 1 ? "member" : "members"}, so they know to pay you. They're under People, tap Copy to nudge anyone directly, and I'll tell you the moment money lands. Tap Collected once everyone has paid.` });
    flash(`Pinged ${others.length}`);
    notify(`Ajo "${c.name}": you're collecting`, `Requests for ${amtStr(c.amount, c.currency)} sent to ${others.map((m) => m.name).join(", ")}. Share them from People, Money requests.`);
  }
  function removeAjo(id: string) { setAjos((prev) => { const n = prev.filter((a) => a.id !== id); if (addr) persist("cowrie.ajo." + addr, JSON.stringify(n)); return n; }); }
  async function payShare(id: string) {
    const c = ajos.find((a) => a.id === id); if (!c || busy) return;
    const recipient = c.members[c.order[c.round % c.members.length]];
    const isYou = recipient.name === (firstName || "You") || (!!recipient.address && !!addr && recipient.address.toLowerCase() === addr.toLowerCase());
    if (isYou) { collectPot(id); return; }
    if (!recipient.address) { say({ who: "cowrie", text: `I don't have ${recipient.name}'s wallet yet, ${firstName}. Save it under People and I'll pay their turn straight away.` }); return; }
    setBusy(true);
    try {
      const units = toUnits(c.amount, c.currency);
      if (units > spendable) { say({ who: "cowrie", tone: "bad", text: `You've got ${cfmt(spendable)} right now, ${firstName}. Top up to pay your ajo share.` }); return; }
      const h = await run("send", [recipient.address, units], { description: `Ajo "${c.name}": pay ${amtStr(c.amount, c.currency)} to ${recipient.name}.`, successHeader: "Share paid", title: `Ajo share to ${recipient.name}`, buttonText: "Pay share" });
      logTx({ hash: h, title: `Ajo share to ${recipient.name}`, amount: amtStr(c.amount, c.currency), sign: "neg" });
      say({ who: "cowrie", tone: "good", text: `Paid your ${amtStr(c.amount, c.currency)} into "${c.name}" for ${recipient.name}, ${firstName}.` });
      advanceAjo(id); await refresh();
    } catch (e) { say({ who: "cowrie", tone: "bad", text: txErr(e) }); } finally { setBusy(false); }
  }
  async function addMoney() {
    if (busy || addAmt <= 0) return;
    setBusy(true);
    try { const h = await run("mintAndDeposit", [toUnits(addAmt, ccy)], { description: `Add ${amtStr(addAmt)} to your balance.`, successHeader: "Money added", title: "Add money" }); logTx({ hash: h, title: "Added money", amount: amtStr(addAmt), sign: "pos" }); flash("Money added"); setTab("home"); say({ who: "cowrie", tone: "good", text: `Added ${amtStr(addAmt)} to your balance.` }); await refresh(); }
    catch (e) { say({ who: "cowrie", tone: "bad", text: txErr(e) }); }
    finally { setBusy(false); }
  }
  async function withdrawEarnings() {
    if (busy || earned <= 0n) return;
    setBusy(true);
    try { const h = await run("stopAllEarning", [], { description: "Move your earnings back to spendable.", successHeader: "Withdrawn", title: "Earn" }); logTx({ hash: h, title: "Withdrew earnings", amount: cfmt(earned), sign: "pos" }); say({ who: "cowrie", tone: "good", text: `Moved your earnings back to spendable, ${firstName}.` }); await refresh(); }
    catch (e) { say({ who: "cowrie", tone: "bad", text: txErr(e) }); }
    finally { setBusy(false); }
  }
  async function withdrawEarn(n: number) {
    if (busy || n <= 0) return;
    const units = toUnits(n, ccy);
    setBusy(true);
    try {
      const h = units >= earned ? await run("stopAllEarning", [], { description: "Move your earnings back to spendable.", successHeader: "Withdrawn", title: "Earn" }) : await run("stopEarning", [units], { description: `Move ${amtStr(n)} from your Earn vault back to spendable.`, successHeader: "Withdrawn", title: "Earn" });
      logTx({ hash: h, title: "Withdrew from Earn", amount: units >= earned ? cfmt(earned) : amtStr(n), sign: "pos" });
      say({ who: "cowrie", tone: "good", text: `Moved ${units >= earned ? cfmt(earned) : amtStr(n)} back to spendable, ${firstName}.` });
      await refresh(); setPosAmt(0);
    } catch (e) { say({ who: "cowrie", tone: "bad", text: txErr(e) }); }
    finally { setBusy(false); }
  }
  async function earnMore(n: number) {
    if (busy || n <= 0) return;
    const units = toUnits(n, ccy);
    if (units > spendable) { flash("Not enough spendable"); return; }
    setBusy(true);
    try { const h = await run("startEarning", [units], { description: `Move ${amtStr(n)} into your Earn vault at 10% a year.`, successHeader: "Now earning", title: "Earn" }); logTx({ hash: h, title: "Started earning", amount: amtStr(n), sign: "" }); say({ who: "cowrie", tone: "good", text: `${amtStr(n)} added to your Earn vault.` }); await refresh(); }
    catch (e) { say({ who: "cowrie", tone: "bad", text: txErr(e) }); }
    finally { setBusy(false); }
  }
  const symOf = (a: string) => assets.find((x) => x.addr === a)?.symbol || "the asset";
  function assetAlias(q: string): string[] { const s = q.toLowerCase(); const out = [s]; if (/bitcoin|btc/.test(s)) out.push("cbtc"); if (/eth|ether/.test(s)) out.push("ceth"); if (/gold|xau/.test(s)) out.push("cgold"); return out; }
  function resolveAsset(q: string) { const norm = (x: string) => x.toLowerCase().replace(/^c/, ""); return assets.find((a) => assetAlias(q).some((al) => norm(a.symbol) === norm(al))); }
  async function buyAsset(a: string, n: number) {
    if (busy || n <= 0) return;
    const units = toUnits(n, ccy);
    if (units > spendable) { flash("Not enough spendable"); return; }
    setBusy(true);
    try { const h = await run("swapCusdForToken", [a, units], { description: `Swap ${amtStr(n)} into ${symOf(a)}.`, successHeader: "Swapped", title: `Buy ${amtStr(n)} of ${symOf(a)}`, buttonText: `Buy ${symOf(a)}` }); logTx({ hash: h, title: `Bought ${symOf(a)}`, amount: amtStr(n), sign: "neg" }); say({ who: "cowrie", tone: "good", text: `Swapped ${amtStr(n)} into ${symOf(a)}. It's in your holdings under Activity.` }); setAmtByKey((m) => ({ ...m, [a]: 0 })); await refresh(); }
    catch (e) { say({ who: "cowrie", tone: "bad", text: txErr(e) }); }
    finally { setBusy(false); }
  }
  async function sellAsset(a: string, nValue: number) {
    const d = assetData[a];
    if (busy || !d || d.holding <= 0n) { flash("Nothing to sell"); return; }
    const valueUnits = toUnits(nValue, ccy);
    const tokIn = !d.value || valueUnits <= 0n || valueUnits >= d.value ? d.holding : (d.holding * valueUnits) / d.value;
    if (tokIn <= 0n) return;
    const whole = tokIn >= d.holding;
    setBusy(true);
    try { const h = await run("swapTokenForCusd", [a, tokIn], { description: `Sell ${whole ? cfmt(d.value) : amtStr(nValue)} of ${symOf(a)} back to spendable.`, successHeader: "Sold", title: `Sell ${whole ? cfmt(d.value) : amtStr(nValue)} of ${symOf(a)}`, buttonText: `Sell ${symOf(a)}` }); logTx({ hash: h, title: `Sold ${symOf(a)}`, amount: whole ? cfmt(d.value) : amtStr(nValue), sign: "pos" }); say({ who: "cowrie", tone: "good", text: `Sold ${whole ? cfmt(d.value) : amtStr(nValue)} of ${symOf(a)} back to spendable.` }); setAmtByKey((m) => ({ ...m, [a]: 0 })); await refresh(); }
    catch (e) { say({ who: "cowrie", tone: "bad", text: txErr(e) }); }
    finally { setBusy(false); }
  }
  async function placeBet(id: number, side: boolean, n: number) {
    if (busy || n <= 0) return;
    const units = toUnits(n, ccy);
    if (units > spendable) { flash("Not enough spendable"); return; }
    setBusy(true);
    try { const h = await run("predict", [BigInt(id), side, units], { description: `Stake ${amtStr(n)} on ${side ? "Yes" : "No"}.`, successHeader: "Bet placed", title: "Predict" }); logTx({ hash: h, title: `Bet ${side ? "Yes" : "No"}`, amount: amtStr(n), sign: "neg" }); say({ who: "cowrie", tone: "good", text: `Staked ${amtStr(n)} on ${side ? "Yes" : "No"}, ${firstName}. Good luck.` }); setAmtByKey((m) => ({ ...m, ["mkt" + id]: 0 })); await refresh(); }
    catch (e) { say({ who: "cowrie", tone: "bad", text: txErr(e) }); }
    finally { setBusy(false); }
  }
  async function claimBet(id: number) {
    if (busy) return;
    setBusy(true);
    try { const h = await run("claimPrediction", [BigInt(id)], { description: "Claim your winnings.", successHeader: "Claimed", title: "Predict" }); logTx({ hash: h, title: "Prediction win", amount: "paid out", sign: "pos" }); say({ who: "cowrie", tone: "good", text: `Winnings claimed, ${firstName}.` }); await refresh(); }
    catch (e) { say({ who: "cowrie", tone: "bad", text: txErr(e) }); }
    finally { setBusy(false); }
  }
  async function handle(override?: string) {
    const text = (typeof override === "string" ? override : input).trim();
    if (!text || busy) return;
    if (billFlow.current) {
      if (Date.now() - billAt.current > 900000) billFlow.current = null;
      else { setInput(""); say({ who: "you", text }); billAt.current = Date.now(); await billInput(text); return; }
    }
    { const bk = detectBill(text); if (bk) { setInput(""); say({ who: "you", text }); startBill(bk); return; } }
    const pend = ajoPending.current;
    if (pend) {
      if (Date.now() > pend.until) ajoPending.current = null;
      else if (/^\s*(yes|yeah|yep|yup|sure|ok|okay|confirm|do it|go ahead)\b/i.test(text)) {
        setInput(""); say({ who: "you", text });
        ajoPending.current = null;
        setAjoExec({ steps: pend.steps, stamp: Date.now() });
        return;
      } else if (/^\s*(no|nope|not now|cancel|stop|leave it)\b/i.test(text)) {
        setInput(""); say({ who: "you", text });
        ajoPending.current = null;
        say({ who: "cowrie", text: "Okay, I will not do it. Ask me any time." });
        return;
      } else ajoPending.current = null;
    }
    {
      // Ajo requests are recognised here, from your live circles, before the AI sees them. The AI explains; the app acts.
      if (!awaitingName.current && AJO_ADDRESS && text.length < 200) {
        const plan = parseAjoText(text);
        if (plan) { setInput(""); say({ who: "you", text }); setAjoCmd({ plan, stamp: Date.now() }); return; }
      }
    }
    setInput(""); const hist8 = thread.slice(-8).map((mm) => ({ role: mm.who === "you" ? "user" : "assistant", content: mm.text })); say({ who: "you", text }); setExpanded(false); const b = detectBrand(text); if (b) setBrand(b); setBusy(true);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000);
      let it: any;
      try { const res = await fetch("/api/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, name: firstName, awaitingName: awaitingName.current, lang, history: hist8, recent: history.slice(0, 10).map((h) => `${h.title} ${h.sign === "neg" ? "-" : h.sign === "pos" ? "+" : ""}${h.amount} (${agoStr(h.ts)})`).join("; "), chats: sessions.slice(0, 5).map((s) => `"${s.title}" (${agoStr(s.ts)})`).join("; "), ajo: ajoFacts(cfmt), facts, bal: `spendable ${cfmt(spendable)} (about $${conv(spendable, "USD").toFixed(2)}), savings ${cfmt(savings)}, gas ${Number(formatEther(gas)).toFixed(3)} MON`, subs: subs.map((s) => `${s.service} ${amtStr(s.amount, s.currency)} every ${s.cycleDays}d, renews ${new Date(s.nextISO).toDateString()}`).join("; "), markets: markets.filter((m) => !m.resolved).map((m) => m.question).join(" | "), contacts: book.map((b) => `${b.name}: ${b.address}`).join("; "), prices: Object.entries(clPrices).map(([k, v]) => `${k} $${Math.round(v.price).toLocaleString()}`).join(", ") }), signal: ctrl.signal }); it = (await res.json()).intent; }
      finally { clearTimeout(timer); }
      const c = it.currency && it.currency !== "AUTO" && CURRENCIES[it.currency] ? it.currency : ccy;
      const amt = (n: number) => amtStr(n, c);
      if (it.action === "watchDemo") { say({ who: "cowrie", text: "Here’s the Cowrie walkthrough. Tap Play to watch right here.", demo: true }); }
      else if (it.action === "reply") { if (it.remember) remember(it.remember); say({ who: "cowrie", text: it.message || it.text || it.reply || "Okay.", options: Array.isArray(it.options) ? it.options.slice(0, 4) : undefined }); }
      else if (it.action === "discover") { say({ who: "cowrie", text: `It all lives right here in Cowrie, ${firstName}, no leaving the app. You can grow money in the Earn vault, swap into cBTC, cETH or cGOLD, send, or pay a bill. What would you like to do?` }); }
      else if (it.action === "earn") { const units = toUnits(it.amount || 0, c); if (!it.amount || units <= 0n) { say({ who: "cowrie", text: `How much would you like to move into earning, ${firstName}?`, options: ["Earn ₦10,000", "Earn ₦50,000", "Earn ₦100,000", "Another amount"] }); } else if (units > spendable) { say({ who: "cowrie", tone: "bad", text: `You've got ${cfmt(spendable)} spendable right now, ${firstName}. Pick an amount up to that and I'll move it into your Earn vault.` }); } else { const h = await run("startEarning", [units], { description: `Move ${amt(it.amount)} into your Earn vault at 10% a year.`, successHeader: "Now earning", title: "Earn" }); logTx({ hash: h, title: "Started earning", amount: amt(it.amount), sign: "" }); say({ who: "cowrie", tone: "good", text: `Done, ${firstName}. ${amt(it.amount)} is in your Cowrie Earn vault now, growing at 10% a year. Pull it out anytime under Activity, or just tell me.` }); } }
      else if (it.action === "stopEarn") { if (earned <= 0n) { say({ who: "cowrie", text: `There's nothing in your Earn vault right now, ${firstName}.` }); } else if (it.amount && Number(it.amount) > 0) { await withdrawEarn((Number(it.amount) / (CURRENCIES[c] || CURRENCIES.NGN).perUsd) * (CURRENCIES[ccy] || CURRENCIES.NGN).perUsd); } else { await withdrawEarnings(); } }
      else if (it.action === "swap") { const found = resolveAsset((it.asset || "").toString()); if (!found) { say({ who: "cowrie", tone: "bad", text: `I don't have a pool for "${it.asset || "that"}" yet, ${firstName}. Right now you can trade ${assets.map((a) => a.symbol).join(", ") || "nothing yet"}.` }); } else if (it.direction === "sell") { await sellAsset(found.addr, it.amount || 0); } else if (!it.amount) { say({ who: "cowrie", text: `How much do you want to put into ${found.symbol}, ${firstName}?`, options: [`Buy ₦10,000 of ${found.symbol}`, `Buy ₦50,000 of ${found.symbol}`, `Buy ₦100,000 of ${found.symbol}`, "Another amount"] }); } else { await buyAsset(found.addr, it.amount); } }
      else if (it.action === "balance") { say({ who: "cowrie", text: `${firstName}, you've got ${cfmt(spendable)} to spend${savings > 0n ? `, with ${cfmt(savings)} tucked away in savings` : ""}. ${false ? "Your wallet needs a little MON for gas before you can move it." : `You've ${Number(formatEther(gas)).toFixed(3)} MON left for gas.`}` }); }
      else if (it.action === "addSubscription") {
        const s = addSub(it.service || "Subscription", it.amount || 0, it.currency, it.cycleDays, it.startedDaysAgo);
        const d = Math.ceil((new Date(s.nextISO).getTime() - Date.now()) / 86400000);
        const fresh = !it.startedDaysAgo || it.startedDaysAgo <= 0;
        const su = toUnits(s.amount, s.currency);
        if (s.amount > 0 && fresh && su <= spendable) {
          const h = await run("send", [MERCHANT, su], { description: `Pay your first ${s.service}, ${amtStr(s.amount, s.currency)}.`, successHeader: "Subscribed", title: s.service });
          logTx({ hash: h, title: `${s.service} subscription`, amount: amtStr(s.amount, s.currency), sign: "neg" });
          say({ who: "cowrie", tone: "good", text: `Done, ${firstName}. Paid your first ${s.service} at ${amtStr(s.amount, s.currency)}, and I'm tracking it. Next charge in ${s.cycleDays} day${s.cycleDays === 1 ? "" : "s"}, I'll nudge you to renew or cancel from the bell up top.` });
        } else {
          const low = s.amount > 0 && fresh && su > spendable;
          say({ who: "cowrie", tone: "good", text: `Got it, ${firstName}, I'm tracking your ${s.service}${s.amount ? ` at ${amtStr(s.amount, s.currency)}` : ""}. ${d <= 0 ? "It's due now" : `Next renewal in ${d} day${d === 1 ? "" : "s"}`}.${low ? " Add money and I'll pay it when it's due." : " I'll nudge you to renew or cancel from the bell up top."}` });
        }
      }
      else if (it.action === "payBill") {
        const bk = detectBill(String(it.what || "") + " " + text);
        startBill(bk && bk !== "ask" ? bk : "ask");
      }
      else if (it.action === "request") { const who = (it.from || "someone").toString(); addRequest(who, it.amount || 0, c, (it.note || "").toString()); say({ who: "cowrie", tone: "good", text: `Done, ${firstName}. I've set up a request for ${amt(it.amount || 0)}${it.note ? ` for ${it.note}` : ""}${it.from ? ` from ${it.from}` : ""}. It's under People, tap Copy to share it.` }); }
      else if (it.action === "split") { const names = Array.isArray(it.names) ? it.names.filter(Boolean).map((x: unknown) => String(x)) : []; const n = names.length || it.people || 2; const share = Math.round((it.amount || 0) / n); if (names.length) names.forEach((nm: string) => addRequest(nm, share, c, "split bill")); say({ who: "cowrie", tone: "good", text: `${amt(it.amount || 0)} split ${n} way${n === 1 ? "" : "s"} is ${amt(share)} each.${names.length ? ` I've made a request for ${names.join(", ")}, under People.` : " Tell me the names and I'll make each request."}` }); }
      else if (it.action === "predict") {
        const side = String(it.side || "yes").toLowerCase() !== "no";
        const hint = (it.market || "").toString().toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim();
        const open = markets.filter((x) => !x.resolved);
        const STOP = ["will", "that", "this", "your", "from", "with", "about", "close", "above", "below", "price", "year", "market", "odds", "stake", "position", "increase", "more", "some", "the", "and", "for", "put", "extra", "money", "bet"];
        const words = hint.split(/\s+/).filter((w: string) => w.length >= 4 && !STOP.includes(w));
        const matched = hint.length > 1 ? (open.find((x) => x.question.toLowerCase().includes(hint)) || open.find((x) => words.some((w: string) => x.question.toLowerCase().includes(w)))) : null;
        const list = open.map((x) => `• ${x.question}`).join("\n");
        if (open.length === 0) { say({ who: "cowrie", text: `There are no open prediction markets right now, ${firstName}. You'll find them under Predict in the Activity tab when they go live.` }); }
        else if (hint.length > 1 && !matched) { say({ who: "cowrie", text: `I don't have a market for "${it.market}", ${firstName}. The open ones are:\n${list}\nName one of these, or open Activity and tap Predict to place your bet.` }); }
        else if (!matched && open.length > 1) { say({ who: "cowrie", text: `Which market, ${firstName}? The open ones are:\n${list}\nName one, or tap it under Predict in Activity.` }); }
        else { const mk = matched || open[0]; if (!it.amount) { say({ who: "cowrie", text: `How much do you want to stake on "${mk.question}" (${side ? "Yes" : "No"}), ${firstName}?`, options: ["₦1,000", "₦5,000", "₦10,000", "Another amount"] }); } else { await placeBet(mk.id, side, it.amount); } }
      }
      else if (it.action === "saveContact") {
        const a = (it.address || "").toString().trim();
        const nmRaw = (it.name || "").toString().trim();
        if (!/^0x[a-fA-F0-9]{40}$/.test(a)) { say({ who: "cowrie", tone: "bad", text: `That address doesn't look complete, ${firstName}. Paste the full 0x address and the name, like "0x1234...abcd save as Mum".` }); }
        else if (!nmRaw) { say({ who: "cowrie", text: `What name should I save ${shortAddr(a)} under, ${firstName}?` }); }
        else { const nm = nmRaw[0].toUpperCase() + nmRaw.slice(1); saveContact(nm, a.toLowerCase()); say({ who: "cowrie", tone: "good", text: `Saved ${nm} to your People list, ${firstName}. You can pay them by name now, just say "send 5,000 to ${nmRaw}". Tap People to see them.` }); }
      }
      else if (it.action === "price") {
        const key = feedKeyFor(it.asset || "bitcoin") || "BTC";
        const p = clPrices[key]?.price;
        const per = (CURRENCIES[ccy] || CURRENCIES.NGN).perUsd;
        if (!p) say({ who: "cowrie", text: `I'm still reaching Chainlink for the ${key} price, ${firstName}. Give it a few seconds and ask again.` });
        else say({ who: "cowrie", text: `${key} is $${Math.round(p).toLocaleString()} right now, ${firstName}, read straight off Chainlink's on-chain feed, about ${amtStr(Math.round(p * per))}. Want me to keep an eye on a level for you?`, options: [`Watch ${key} below ${Math.round(p * 0.9).toLocaleString()}`, `Buy ${key === "BTC" ? "cBTC" : "cETH"}`] });
      }
      else if (it.action === "setName") {
        const raw = (it.name || "").toString().trim().slice(0, 24);
        if (!raw) say({ who: "cowrie", text: "No problem, what should I call you?" });
        else { const nm = raw[0].toUpperCase() + raw.slice(1); awaitingName.current = false; setNick(nm); say({ who: "cowrie", tone: "good", text: `Got it, I'll call you ${nm} from now on. You can change that any time in Settings.` }); }
      }
      else if (it.action === "guardian") {
        const key = feedKeyFor(it.asset || "");
        if (!key) { say({ who: "cowrie", text: `Guardian watches Bitcoin and Ethereum live on Chainlink, ${firstName}. Which one should I watch, and at what price?` }); }
        else if (!it.price || Number(it.price) <= 0) { say({ who: "cowrie", text: `At what ${key} price should I watch for you, ${firstName}?` }); }
        else {
          const g = { id: Date.now().toString(36), asset: key, op: it.op === "above" ? "above" : "below", price: Number(it.price), act: ["protect", "sell", "buy", "notify"].includes(it.act) ? it.act : "notify", amount: it.amount && it.amount > 0 ? it.amount : undefined, currency: it.currency && it.currency !== "AUTO" ? it.currency : ccy };
          const next = [...guards, g]; setGuards(next); if (addr) persist("cowrie.guards." + addr, JSON.stringify(next));
          const doing = g.act === "protect" ? "move your savings into the vault" : g.act === "sell" ? `sell${g.amount ? " " + amtStr(g.amount) : ""}` : g.act === "buy" ? `buy${g.amount ? " " + amtStr(g.amount) : ""}` : "flag it to you";
          const now = clPrices[key]?.price;
          say({ who: "cowrie", tone: "good", text: `Set, ${firstName}. Guardian is watching ${key} on Chainlink${now ? ` (now about $${Math.round(now).toLocaleString()})` : ""} and will ${doing} the moment it goes ${g.op} $${g.price.toLocaleString()}. It's on the Guardian card on Home.` });
        }
      }
      else if (it.action === "ajoDo") {
        const w = ["pay", "join", "withdraw", "move", "status"].includes(String(it.what)) ? String(it.what) : "status";
        setAjoCmd({ plan: w === "status" ? { type: "status", name: it.name ? String(it.name) : undefined } : { type: "do", kinds: [w === "pay" ? "pay" : w === "join" ? "join" : w === "withdraw" ? "withdraw" : "move"], name: it.name ? String(it.name) : undefined }, stamp: Date.now() });
      }
      else if (it.action === "ajo") {
        { const fromCur = (CURRENCIES[(it.currency && it.currency !== "AUTO" ? it.currency : ccy)] || CURRENCIES.NGN).perUsd; const toCur = (CURRENCIES[ccy] || CURRENCIES.NGN).perUsd; const a0 = it.amount && Number(it.amount) > 0 ? (Number(it.amount) / fromCur) * toCur : undefined; setAjoPrefill({ name: it.name ? String(it.name) : undefined, amount: a0, minutes: typeof it.minutes === "number" && it.minutes > 0 ? it.minutes : undefined, invitees: Array.isArray(it.members) ? it.members.map((x: unknown) => String(x)) : [], stamp: Date.now() }); }
        setHomePanel("ajo"); setTab("home");
        say({ who: "cowrie", tone: "good", text: `Ajo circles are on-chain now, ${firstName}. Everyone joins from their own Cowrie and locks a deposit, a Chainlink CRE workflow draws the payout order from the live BTC price, and each round pays out automatically when its timer ends. I opened the Ajo sheet and filled in what you told me. Check the form and tap Create circle.` });
      } else if (false) {
        const amt = it.amount && Number(it.amount) > 0 ? Number(it.amount) : 0;
        const cur = it.currency && it.currency !== "AUTO" ? it.currency : ccy;
        const names = Array.isArray(it.members) ? it.members.map((x: unknown) => String(x).trim()).filter(Boolean) : [];
        if (!amt) { say({ who: "cowrie", text: `How much should each person put in per cycle, ${firstName}? And who's in the circle with you?` }); }
        else if (names.length < 1) { say({ who: "cowrie", text: `Who's in the circle with you, ${firstName}? Name a couple of people, like "with Mum and Tunde" (saved contacts work best).` }); }
        else {
          const members = [{ name: firstName || "You", address: addr as string | undefined }, ...names.map((nm: string) => { const b = book.find((x) => x.name.toLowerCase() === nm.toLowerCase() || x.name.toLowerCase().startsWith(nm.toLowerCase())); return { name: nm[0].toUpperCase() + nm.slice(1), address: b?.address as string | undefined }; })];
          const seedP = clPrices.BTC?.price || clPrices.ETH?.price || 0;
          const seed = Math.floor((seedP || (Date.now() % 100000)) * 1000);
          const cyc = /\bweek/i.test(text) ? 7 : /\bfortnight|two weeks|2 weeks/i.test(text) ? 14 : 30;
          const circle = { id: Date.now().toString(36), name: (it.name || "My Ajo").toString(), amount: amt, currency: cur, members, order: seededOrder(members.length, seed), seedPrice: seedP, round: 0, cycleDays: cyc, nextISO: new Date(Date.now() + cyc * 86400000).toISOString(), pinged: 0 };
          const next = [...ajos, circle]; setAjos(next); if (addr) persist("cowrie.ajo." + addr, JSON.stringify(next));
          addReminder(`Ajo: ${circle.name}`, amt, cur, cyc, cyc);
          setHomePanel("ajo"); setTab("home");
          const first = circle.members[circle.order[0]].name;
          say({ who: "cowrie", tone: "good", text: `Your ajo "${circle.name}" is live, ${firstName}: ${members.length} people, ${amtStr(amt, cur)} each per cycle. I drew the turn order from the live Chainlink BTC price${seedP ? ` ($${Math.round(seedP).toLocaleString()})` : ""}, so nobody can rig who collects first. ${first} is up first. It's on your Home under Ajo circle.` });
        }
      }
      else if (it.action === "setAutosave") { const h = await run("setAutosave", [Math.round(it.percent * 100)], { description: `Save ${it.percent}% of everything you receive, automatically.`, successHeader: "Rule set", title: "Auto-save" }); logTx({ hash: h, title: `Auto-save ${it.percent}%`, amount: "rule", sign: "" }); say({ who: "cowrie", tone: "good", text: pick([`Done, ${firstName},${it.percent}% of everything you receive now slips into your savings pot automatically.`, `Rule set: whenever money lands, ${it.percent}% goes straight to savings. You won't have to think about it.`]) }); }
      else if (it.action === "setDailyCap") { const h = await run("setDailyCap", [toUnits(it.amount, c)], { description: `Cap your spending at ${amt(it.amount)} a day.`, successHeader: "Limit set", title: "Daily cap" }); logTx({ hash: h, title: "Daily spend cap", amount: amt(it.amount), sign: "" }); say({ who: "cowrie", tone: "good", text: pick([`Guardrail on: you can't spend more than ${amt(it.amount)} in a day now.`, `${amt(it.amount)} a day is your ceiling, I'll stop anything over it before it goes out.`]) }); }
      else if (it.action === "fund") { const h = await run("mintAndDeposit", [toUnits(it.amount, c)], { description: `Add ${amt(it.amount)} to your Cowrie balance.`, successHeader: "Money added", title: "Add money" }); logTx({ hash: h, title: "Added money", amount: amt(it.amount), sign: "pos" }); say({ who: "cowrie", tone: "good", text: pick([`Topped up, ${amt(it.amount)} is in your balance.`, `${amt(it.amount)} added and ready to spend or save.`]) }); }
      else if (it.action === "unlockSavings") { const h = await run("unlockSavings", [toUnits(it.amount, c)], { description: `Move ${amt(it.amount)} from savings to spendable.`, successHeader: "Unlocked", title: "Savings" }); logTx({ hash: h, title: "Unlocked savings", amount: amt(it.amount), sign: "pos" }); say({ who: "cowrie", tone: "good", text: `Moved ${amt(it.amount)} out of your savings pot and back into spendable.` }); }
      else if (it.action === "setAllowance") { const to = resolveTo(it.to); if (!to) say({ who: "cowrie", tone: "bad", text: `I don't have an address for "${it.to}" yet, ${firstName}. Paste their wallet and I'll set it up.` }); else { const h = await run("setAllowance", [to, toUnits(it.amount, c)], { description: `Give ${it.to} ${amt(it.amount)} a day, automatically.`, successHeader: "Allowance set", title: "Allowance" }); logTx({ hash: h, title: `Allowance to ${it.to}`, amount: amt(it.amount) + "/day", sign: "" }); say({ who: "cowrie", tone: "good", text: `${it.to} now receives ${amt(it.amount)} a day from you, topped up automatically. No reminders needed.` }); } }
      else if (it.action === "send") { const to = resolveTo(it.to); if (!to) { say({ who: "cowrie", tone: "bad", text: `I don't have an address for "${it.to}" yet. Paste their wallet address and I'll send it.` }); } else { const flagged = await publicClient.readContract({ address: addresses.scam, abi: scamAbi, functionName: "isFlagged", args: [to] }); if (flagged) { const n = await publicClient.readContract({ address: addresses.scam, abi: scamAbi, functionName: "reportCount", args: [to] }); say({ who: "cowrie", tone: "bad", text: `Hold on, ${firstName},that address has been reported ${Number(n) || "several"} times as a scam. I stopped the payment before it left your wallet.` }); } else { const h = await run("send", [to, toUnits(it.amount, c)], { description: `Send ${amt(it.amount)} to ${shortAddr(it.to)}.`, successHeader: "Sent", title: "Payment" }); logTx({ hash: h, title: `Sent to ${shortAddr(it.to)}`, amount: amt(it.amount), sign: "neg" }); say({ who: "cowrie", tone: "good", text: pick([`Sent ${amt(it.amount)} to ${shortAddr(it.to)}, landed in under a second.`, `Done. ${amt(it.amount)} is with ${shortAddr(it.to)} now, settled on Monad for next to nothing.`]) }); } } }
      else if (it.action === "addReminder") { const s = addReminder(it.title || "Reminder", it.amount || 0, it.currency, it.dueInDays, it.repeatDays); const d = Math.ceil((new Date(s.nextISO).getTime() - Date.now()) / 86400000); say({ who: "cowrie", tone: "good", text: `Noted, ${firstName}. I'll remind you about "${s.service}"${s.amount ? ` (${amtStr(s.amount, s.currency)})` : ""} ${d <= 0 ? "today" : `in ${d} day${d === 1 ? "" : "s"}`}${s.cycleDays ? `, then every ${s.cycleDays} days` : ""}. It's under the bell up top.` }); }
      else { say({ who: "cowrie", text: it.reason || it.message || it.text || "I didn't catch that." }); }
      await refresh();
    } catch (e) { say({ who: "cowrie", tone: "bad", text: txErr(e) }); }
    finally { setBusy(false); }
  }
  if (!ready) return (
    <div className="splash">
      <div className="splashmark"><CowrieMark size={76} /></div>
      <div className="splashword">Cowrie</div>
      <div className="splashbar"><span /></div>
      <div className="splashsub">getting your money ready</div>
    </div>
  );
  if (!authenticated)
    return (
      <div className="screen"><div className="phone">
        {toast && <div className="toast">{toast}</div>}
        <section className="welcome">
          <div className="lg"><CowrieMark size={54} /></div>
          <h1 className="pitch">Talk to your money.</h1>
          <p className="blurb">Send, save, and stay safe, in plain language. Settled on Monad in under a second.</p>
          <button className="cta" onClick={login}>Get started</button>
          <a className="demoentry" href="/demo">Watch the demo <span aria-hidden="true">↗</span></a>
        </section>
      </div></div>
    );

  return (
    <div className="screen">
      <div className="ambient" style={{ background: amb ? `radial-gradient(110% 55% at 50% -6%, ${amb}3d, transparent 60%)` : "transparent" }} />
      {toast && <div className="toast">{toast}</div>}
      <div className="phone">
        <header className="top">
          <CowrieMark size={26} />
          <div className="word">Cowrie</div>
          <span className="chain">on Monad</span>
          <div className="spacer" />
          {authenticated && addr && (<AjoAgent addr={addr as `0x${string}`} publicClient={publicClient} run={run} busy={busy} setBusy={setBusy} errText={txErr} fmt={cfmt} spendable={spendable} book={book} say={say} notify={notify} setPending={(p: AjoPending | null) => { ajoPending.current = p; }} command={ajoCmd} exec={ajoExec} refresh={refresh} setSummary={setAjoSummary} />)}
          {authenticated && (<button className="iconbtn bell" onClick={() => setTab("alerts")} aria-label="Notifications"><Icon size={17}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></Icon>{(alertCount + unread) > 0 && <span className="badge">{alertCount + unread}</span>}</button>)}
          {addr && (
            <button className="addrchip" onClick={copyAddr} title="Copy your wallet address" aria-label="Copy address">
              <span>{addr.slice(0, 6)}…{addr.slice(-4)}</span>
              <Icon size={15}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></Icon>
            </button>
          )}
        </header>
        {tab === "home" && (
          <>
            {heroOpen ? (<>
            <section className="wallet" style={brand ? ({ ["--edge"]: brand.color } as any) : undefined}>
              <div className="wtop">
                <span className="wlabel">Spendable</span>
                <button className="wbtn" onClick={toggleHidden} aria-label="Hide balance">
                  {hidden ? <Icon size={16}><path d="M3 3l18 18" /><path d="M10.7 5.1A10.7 10.7 0 0 1 12 5c6 0 10 7 10 7a17.6 17.6 0 0 1-3.3 4M6.5 6.6A17.6 17.6 0 0 0 2 12s4 7 10 7a10.7 10.7 0 0 0 3.4-.6" /></Icon>
                         : <Icon size={16}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Icon>}
                </button>
                <select className="ccysel" value={ccy} onChange={(e) => changeCcy(e.target.value)} aria-label="Display currency">
                  {Object.keys(CURRENCIES).map((code) => (<option key={code} value={code}>{code}</option>))}
                </select>
              </div>
              <div className="big">{mask(cfmt(spendable))}</div>
              {ccy !== "USD" && <div className="usd">{mask("≈ $" + conv(spendable, "USD").toLocaleString(undefined, { maximumFractionDigits: 2 }))}</div>}
              <div className="walletfoot">{savings > 0n ? <span>Savings pot {mask(cfmt(savings))}</span> : <span />}<span>{Number(formatEther(gas)).toFixed(3)} MON gas</span></div>
              <div className="shellmark" aria-hidden="true" />
            </section>
            {brand && (<button className="scenebanner" style={{ color: brand.color, borderColor: brand.color }} onClick={() => setBrand(null)}><span className="cdot" style={{ background: brand.color }} /><span>{brand.label}, want this as a monthly plan?</span></button>)}
            {low && !brand && (<button className="lownote" onClick={() => setTab("add")}>You&rsquo;re running low, tap to top up.</button>)}
            {alertCount > 0 && (<button className="remind" onClick={() => setTab("alerts")}><span className="cdot" style={{ background: "var(--brass)" }} /><span>{dueSubs[0].s.service} {dueSubs[0].days <= 0 ? "is due now" : `${dueSubs[0].s.cycleDays > 0 ? "renews" : "due"} in ${dueSubs[0].days} day${dueSubs[0].days === 1 ? "" : "s"}`}, tap to review</span></button>)}
            {earned > 0n && (<button className="earnstrip" onClick={() => setTab("activity")}><span className="ei"><b>{mask(cfmt(earned))} in your Earn vault</b><small>Growing at 10% a year, tap to manage</small></span><span className="earnw">Manage</span></button>)}
            <div className="feats">
              <button className={"feat" + (homePanel === "guardian" ? " on" : "")} onClick={() => setHomePanel(homePanel === "guardian" ? null : "guardian")}><span className="fl">Guardian</span><span className="fv">{clPrices.BTC ? `BTC $${(clPrices.BTC.price / 1000).toFixed(1)}k` : "live via Chainlink"}</span></button>
              <button className={"feat" + (homePanel === "ajo" ? " on" : "")} onClick={() => setHomePanel(homePanel === "ajo" ? null : "ajo")}><span className="fl">Ajo circle</span><span className="fv">{"on-chain, via CRE"}{ajoSummary ? (<><br />{ajoSummary.live ? `${ajoSummary.live} live` : ajoSummary.open ? `${ajoSummary.open} open` : ajoSummary.invited ? `${ajoSummary.invited} to join` : "no live circle"}</>) : null}</span></button>
            </div>
            </>) : (
              <div className="minibar">
                <button className="mbal" onClick={openHero} aria-label="Show wallet"><small>Spendable</small><b>{mask(cfmt(spendable))}</b></button>
                <button className="mpill" onClick={() => setHomePanel("guardian")}>Guardian<span className="mpv">{clPrices.BTC ? ` $${(clPrices.BTC.price / 1000).toFixed(1)}k` : ""}</span></button>
                <button className="mpill" onClick={() => setHomePanel("ajo")}>Ajo</button>
                <button className="mchev" onClick={openHero} aria-label="Show wallet">▾</button>
              </div>
            )}
            {homePanel && <button className="sheetbg" aria-label="Close panel" onClick={() => setHomePanel(null)} />}
            {homePanel === "guardian" && (
              <div className="sheet">
                <div className="sheethead"><span>Guardian</span><button className="xbtn" aria-label="Close" onClick={() => setHomePanel(null)}>✕</button></div>
                <div className="poshead">Guardian <span style={{ color: "var(--brass)", fontWeight: 700 }}>· live via Chainlink</span></div>
                <section className="dashcard">{Object.keys(clPrices).length === 0 ? <div className="ds">Connecting to Chainlink price feeds…</div> : <div className="ds" style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>{clPrices.BTC && <span><b style={{ color: "var(--text)" }}>BTC</b> ${Math.round(clPrices.BTC.price).toLocaleString()}</span>}{clPrices.ETH && <span><b style={{ color: "var(--text)" }}>ETH</b> ${Math.round(clPrices.ETH.price).toLocaleString()}</span>}<span className="muted2">verified by Chainlink</span></div>}</section>
                {guards.length === 0 ? <p className="muted" style={{ marginTop: 2 }}>Say &ldquo;watch bitcoin and alert me if it drops below $90,000&rdquo;. Chainlink is the eyes.</p> : guards.map((g) => (
                  <div className="pcard" key={g.id}><div className="prow" style={{ cursor: "default" }}><span className="prl"><b>{g.asset} {g.op} ${g.price.toLocaleString()}</b><small>{g.done ? "triggered" : "watching via Chainlink"} · {g.act === "notify" ? "alert me" : g.act === "protect" ? "move to savings" : g.act}</small></span><span className="prr">{g.done ? <span style={{ color: "var(--good)", fontWeight: 700, fontSize: 12 }}>✓ fired</span> : <span style={{ color: "var(--brass)", fontSize: 12 }}>● live</span>}<button className="iconbtn" aria-label="Remove" onClick={() => { const n = guards.filter((x) => x.id !== g.id); setGuards(n); if (addr) persist("cowrie.guards." + addr, JSON.stringify(n)); }}><Icon size={15}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></Icon></button></span></div></div>
                ))}
              </div>
            )}
            {homePanel === "ajo" && (
              <div className="sheet">
                <div className="sheethead"><span>Ajo circle</span><button className="xbtn" aria-label="Close" onClick={() => setHomePanel(null)}>✕</button></div>
                <OnchainAjo addr={addr as `0x${string}` | undefined} publicClient={publicClient} run={run} busy={busy} setBusy={setBusy} flash={flash} errText={txErr} fmt={cfmt} toU={(n: number) => toUnits(n, ccy)} symbol={(CURRENCIES[ccy] || CURRENCIES.NGN).symbol} perUsd={(CURRENCIES[ccy] || CURRENCIES.NGN).perUsd} spendable={spendable} book={book} prefill={ajoPrefill} focusId={linkCircle} refresh={refresh} say={say} />
                {true ? null : ajos.length === 0 ? <p className="muted" style={{ marginTop: 2 }}>Tell Cowrie &ldquo;start an ajo of ₦20,000 with Mum and Tunde&rdquo;. Everyone contributes each cycle and takes turns collecting, and the turn order is drawn from a live Chainlink price so no one can rig it.</p> : ajos.map((c) => { const turn = c.round % c.members.length; const recipient = c.members[c.order[turn]]; const done = c.round >= c.members.length; const mine = recipient.name === (firstName || "You"); const daysLeft = c.nextISO ? Math.ceil((new Date(c.nextISO).getTime() - Date.now()) / 86400000) : null; const due = daysLeft !== null && daysLeft <= 0; return (
                  <div className="pcard" key={c.id}>
                    <div className="prow" style={{ cursor: "default" }}><span className="prl"><b>{c.name}</b><small>{amtStr(c.amount, c.currency)} each · {c.members.length} people · cycle {Math.min(c.round + 1, c.members.length)}/{c.members.length}</small></span><button className="iconbtn" aria-label="Remove" onClick={() => removeAjo(c.id)}><Icon size={15}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></Icon></button></div>
                    <div className="posexp">
                      {!done && daysLeft !== null && (<div className={"ajodue" + (due ? " now" : "")}>{due ? "Due now" : `Next cycle in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}<span>every {c.cycleDays || 30} days</span></div>)}
                      <div className="ds" style={{ marginBottom: 6 }}>Turn order <span style={{ color: "var(--brass)" }}>· drawn from Chainlink{c.seedPrice ? ` BTC $${Math.round(c.seedPrice).toLocaleString()}` : ""}</span></div>
                      <div className="ajorder">{c.order.map((idx, pos) => (<span key={pos} className={"ajochip" + (!done && pos === turn ? " on" : "")}>{pos + 1}. {c.members[idx].name}</span>))}</div>
                      {done ? <span className="muted2">Circle complete, everyone has collected.</span> : mine ? (
                        <>
                          <div className="ds" style={{ marginBottom: 6 }}>{c.pinged ? `Pinged the group, waiting on ${c.members.length - 1} ${c.members.length - 1 === 1 ? "payment" : "payments"}. I'll tell you as each one lands.` : `You collect ${amtStr(c.amount * (c.members.length - 1), c.currency)} this cycle. Ping the group to ask for their shares.`}</div>
                          <div className="posacts">
                            <button className="mini pay" onClick={() => collectPot(c.id)} disabled={busy}>{c.pinged ? "Ping again" : `Collect ${amtStr(c.amount * (c.members.length - 1), c.currency)}`}</button>
                            <button className="mini ghost" onClick={() => advanceAjo(c.id)} disabled={busy}>Collected, next cycle</button>
                          </div>
                        </>
                      ) : <div className="posacts"><button className="mini pay" onClick={() => payShare(c.id)} disabled={busy}>Pay {amtStr(c.amount, c.currency)} to {recipient.name}</button></div>}
                    </div>
                  </div>
                ); })}
              </div>
            )}
            {!configured && <p className="hint">Add your contract addresses to web/.env.local and restart.</p>}
            {false && <p className="hint">This wallet needs a little MON to move money. Open the Add tab or fund your address, then try again.</p>}
            {heroOpen && (
              <div className="chips">
                
                {starters.map((q) => (<button key={q} className="chip" onClick={() => setInput(q)}>{q}</button>))}
              </div>
            )}
            <div className="thread" onScroll={() => { if (expanded && hasChat && Date.now() - expandAt.current > 700) setExpanded(false); }}>
              {thread.length === 0 && <p className="empty">Tell Cowrie what to do, in your own words. Try &ldquo;save 10% of everything I receive&rdquo;.</p>}
              {thread.map((m, i) => (
                <div key={i} style={{ display: "contents" }}>
                  <div className={`bubble ${m.who}${m.tone ? " " + m.tone : ""}`}>{m.text}</div>
                  {m.who === "cowrie" && m.demo && <DemoVideo />}
                  {m.who === "cowrie" && m.options && m.options.length > 0 && (<div className="quickrow">{m.options.map((o) => (<button key={o} className="quick" onClick={() => handle(o)} disabled={busy}>{o}</button>))}</div>)}
                </div>
              ))}
              {busy && (<div className="bubble cowrie thinking"><span className="dots"><i /><i /><i /></span></div>)}
              <div ref={endRef} style={{ scrollMarginBottom: 200 }} />
            </div>
            <div className="composer">
              <textarea ref={taRef} value={input} rows={1} placeholder="Tell Cowrie what to do…" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handle(); } }} />
              <button className="send" onClick={() => handle()} disabled={busy} aria-label="Send" title="Send"><Icon size={20}><path d="M22 2 11 13" /><path d="M22 2 15 22 11 13 2 9 22 2Z" /></Icon></button>
            </div>
          </>
        )}
        {tab === "activity" && (
          <div className="panel actpanel">
            <div className="acthead">
              <h2 className="ptitle">Activity</h2>
              <div className="seg"><button className={actView === "portfolio" ? "on" : ""} onClick={() => setActView("portfolio")}>Portfolio</button><button className={actView === "history" ? "on" : ""} onClick={() => setActView("history")}>Payments</button><button className={actView === "chats" ? "on" : ""} onClick={() => setActView("chats")}>Chats</button></div>
            </div>
            {actView === "portfolio" && <section className="dashcard"><span className="dl">Total balance</span><div className="dv">{mask(cfmt(spendable + savings + defiTotal))}</div><div className="ds">{hidden ? "tap the eye on Home to reveal" : `${cfmt(spendable)} spendable${savings > 0n ? ` · ${cfmt(savings)} savings` : ""}${defiTotal > 0n ? ` · ${cfmt(defiTotal)} in DeFi` : ""}`}</div></section>}
            <div className="actscroll">
            {actView === "portfolio" ? (
              <>
                <div className="poshead">Savings</div>
                <div className="pcard">
                  <button className="prow" onClick={() => setOpenPos(openPos === "earn" ? null : "earn")}><span className="prl"><b>Cowrie Earn vault</b><small>10% a year</small></span><span className="prr"><b>{mask(cfmt(earned))}</b><span className="chev">{openPos === "earn" ? "▲" : "▼"}</span></span></button>
                  {openPos === "earn" && (
                    <div className="posexp">
                      <div className="posfield"><input type="number" inputMode="numeric" value={posAmt || ""} placeholder={`Amount in ${ccy}`} onChange={(e) => setPosAmt(Number(e.target.value))} /></div>
                      <div className="posacts">
                        <button className="mini pay" onClick={() => earnMore(posAmt)} disabled={busy || !posAmt || toUnits(posAmt, ccy) > spendable}>Add</button>
                        <button className="mini ghost" onClick={() => withdrawEarn(posAmt)} disabled={busy || !posAmt}>Withdraw</button>
                        <button className="mini ghost" onClick={withdrawEarnings} disabled={busy || earned <= 0n}>All</button>
                      </div>
                    </div>
                  )}
                </div>
                {assets.length > 0 && <div className="poshead">Tokens</div>}
                {assets.map((as) => {
                  const d = assetData[as.addr];
                  const held = !!d && d.holding > 0n;
                  const perUsd = (CURRENCIES[ccy] || CURRENCIES.NGN).perUsd;
                  const priceUsd = d && d.poolTok > 0n ? (Number(d.poolCusd) / 1e6) / (Number(d.poolTok) / 10 ** as.decimals) : 0;
                  const amt = amtByKey[as.addr] || 0;
                  const open = openPos === as.addr;
                  return (
                    <div className="pcard" key={as.addr}>
                      <button className="prow" onClick={() => setOpenPos(open ? null : as.addr)}><span className="prl"><b>{as.symbol}</b><small>{amtStr(Math.round(priceUsd * perUsd))} each</small></span><span className="prr">{held ? <b>{mask(cfmt(d.value))}</b> : <small className="muted2">tap to trade</small>}<span className="chev">{open ? "▲" : "▼"}</span></span></button>
                      {open && (
                        <div className="posexp">
                          <div className="posfield"><input type="number" inputMode="numeric" value={amt || ""} placeholder={`Amount in ${ccy}`} onChange={(e) => setAmtByKey((m) => ({ ...m, [as.addr]: Number(e.target.value) }))} /></div>
                          <div className="posacts">
                            <button className="mini pay" onClick={() => buyAsset(as.addr, amt)} disabled={busy || !amt || toUnits(amt, ccy) > spendable}>Buy</button>
                            <button className="mini ghost" onClick={() => sellAsset(as.addr, amt)} disabled={busy || !held || !amt}>Sell</button>
                          </div>
                          {held && (<div className="pctrow"><span>Sell</span>{[25, 50, 75, 100].map((p) => (<button key={p} className="pct" onClick={() => sellPct(as.addr, p)} disabled={busy}>{p === 100 ? "Max" : `${p}%`}</button>))}</div>)}
                        </div>
                      )}
                    </div>
                  );
                })}
                {markets.length > 0 && <div className="poshead">Predict</div>}
                {markets.map((mk) => {
                  const total = mk.poolYes + mk.poolNo;
                  const yesPct = total > 0n ? Number((mk.poolYes * 100n) / total) : 50;
                  const mine = mk.yes + mk.no;
                  const amt = amtByKey["mkt" + mk.id] || 0;
                  const open = openPos === "mkt" + mk.id;
                  const won = mk.resolved && ((mk.outcome && mk.yes > 0n) || (!mk.outcome && mk.no > 0n));
                  return (
                    <div className="pcard" key={mk.id}>
                      <button className="prow" onClick={() => setOpenPos(open ? null : "mkt" + mk.id)}><span className="prl"><b>{mk.question}</b><small>{mk.resolved ? `Resolved: ${mk.outcome ? "Yes" : "No"}` : `Yes ${yesPct}% · No ${100 - yesPct}%`}{mine > 0n ? ` · you staked ${mask(cfmt(mine))}` : ""}</small></span><span className="prr"><span className="chev">{open ? "▲" : "▼"}</span></span></button>
                      {open && (
                        <div className="posexp">
                          {mk.resolved ? (won ? <button className="mini pay" onClick={() => claimBet(mk.id)} disabled={busy}>Claim winnings</button> : <span className="muted2">{mine > 0n ? "This one didn't go your way." : "Market resolved."}</span>) : (
                            <>
                              <div className="posfield"><input type="number" inputMode="numeric" value={amt || ""} placeholder={`Amount in ${ccy}`} onChange={(e) => setAmtByKey((m) => ({ ...m, ["mkt" + mk.id]: Number(e.target.value) }))} /></div>
                              <div className="posacts"><button className="mini pay" onClick={() => placeBet(mk.id, true, amt)} disabled={busy || !amt || toUnits(amt, ccy) > spendable}>Yes</button><button className="mini ghost" onClick={() => placeBet(mk.id, false, amt)} disabled={busy || !amt || toUnits(amt, ccy) > spendable}>No</button></div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : actView === "chats" ? (
              <>
                <div className="poshead">Your chats <span style={{ color: "var(--dim)", fontWeight: 600 }}>· saved automatically</span></div>
                <button className="mini pay" style={{ marginBottom: 10 }} onClick={newChat}>Start a new chat</button>
                {sessions.length === 0 ? <p className="muted">Your conversations save here on their own as you talk to Cowrie, so you can reopen any of them later.</p> : sessions.map((s) => (
                  <div className="chatrow" key={s.id}>
                    <div className="mid"><b>{s.title}</b><small>{s.id === curSid.current ? "current chat · " : ""}{agoStr(s.ts)} · {s.msgs.length} messages</small></div>
                    {s.id !== curSid.current && <button className="mini ghost" onClick={() => openSession(s.id)}>Open</button>}
                    <button className="iconbtn" aria-label="Delete" onClick={() => deleteSession(s.id)}><Icon size={15}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></Icon></button>
                  </div>
                ))}
              </>
            ) : (
              history.length === 0 ? <p className="muted">No transactions yet. Anything you do with Cowrie shows up here, with a link to the Monad explorer.</p> : (
                <div className="list">
                  {history.map((h) => (<div className="txrow" key={h.hash + h.ts}><div className="ic"><Icon size={16}><path d="M12 2v20M2 12h20" /></Icon></div><div className="mid"><b>{h.title}</b><a href={`${EXPLORER}/tx/${h.hash}`} target="_blank" rel="noreferrer">{new Date(h.ts).toLocaleString()} · view on explorer</a></div><span className={"amt " + h.sign}>{h.sign === "pos" ? "+" : h.sign === "neg" ? "−" : ""}{h.amount}</span></div>))}
                </div>
              )
            )}
            </div>
          </div>
        )}
        {tab === "add" && (
          <div className="panel">
            <h2 className="ptitle">Add money</h2>
            <div className="card3d">
              <div className="cr"><span>Cowrie</span><span>debit</span></div>
              <div className="num">4921 •••• •••• {addr ? addr.slice(-4) : "0000"}</div>
              <div className="cr"><span>{addr ? addr.slice(2, 6).toUpperCase() : "----"} · HOLDER</span><span>12 / 29</span></div>
            </div>
            <div className="amtrow">{[5000, 20000, 50000, 100000].map((a) => (<button key={a} className={addAmt === a ? "on" : ""} onClick={() => setAddAmt(a)}>{amtStr(a)}</button>))}</div>
            <div className="field"><label>Amount ({ccy})</label><input type="number" value={addAmt} onChange={(e) => setAddAmt(Number(e.target.value))} /></div>
            <button className="primary" onClick={addMoney} disabled={busy}>{busy ? "Adding…" : `Add ${amtStr(addAmt)}`}</button>
            <p className="hint" style={{ textAlign: "center" }}>{false ? "Your wallet needs a little MON for gas before you can add money." : "Demo top-up, mints test money on Monad. Gas is covered by Cowrie, so ignore any red balance note on the next screen. No real card is charged. In production this is a card or bank on-ramp."}</p>
          </div>
        )}
        {tab === "alerts" && (
          <div className="panel">
            <h2 className="ptitle">Notifications</h2>
            {notes.length === 0 ? <p className="muted">Nothing yet. Money you receive, Guardian price alerts and Ajo due dates show up here.</p> : (
              <div className="list">
                {notes.map((n) => (
                  <div className="noterow" key={n.id}>
                    <span className={"ndot" + (n.read ? " read" : "")} />
                    <div className="mid"><b>{n.title}</b><span>{n.body}</span><small>{agoStr(n.ts)}</small></div>
                  </div>
                ))}
              </div>
            )}
            <div className="poshead" style={{ marginTop: 18 }}>Reminders</div>
            {subs.length === 0 ? <p className="muted">Nothing to remind you about yet. Tell Cowrie things like &ldquo;remind me to pay rent &#8358;80,000 on the 1st&rdquo; or &ldquo;I subscribed to Netflix for &#8358;4,400 a month&rdquo;, and it will nudge you before each one, to pay or cancel.</p> : (
              <div className="list">
                {dueSubs.map(({ s, days }) => (
                  <div className="subrow" key={s.id}>
                    <div className="mid"><b>{s.service}</b><span className="sub2">{s.amount > 0 ? amtStr(s.amount, s.currency) + " · " : ""}{days <= 0 ? "due now" : `${s.cycleDays > 0 ? "renews" : "due"} in ${days} day${days === 1 ? "" : "s"}`}{s.cycleDays > 0 ? ` · every ${s.cycleDays}d` : ""}</span></div>
                    <div className="subacts">
                      <button className="mini pay" onClick={() => completeReminder(s)} disabled={busy}>{s.amount > 0 ? "Pay" : "Done"}</button>
                      <button className="mini ghost" onClick={() => cancelSub(s.id)}>Cancel</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {tab === "settings" && (
          <div className="panel">
            <h2 className="ptitle">Settings</h2>
            <div className="srow"><div style={{ minWidth: 0 }}><div className="lab">{acctName || firstName}</div><div className="sub">{acctEmail ? `${acctEmail} · signed in with Google` : "signed in"}</div></div>
              <div className="ava" aria-hidden="true">{(acctName || firstName || "?").slice(0, 1).toUpperCase()}</div>
            </div>
            <div className="srow"><div style={{ minWidth: 0 }}><div className="lab">What Cowrie calls you</div><div className="sub">{nickname ? `Using "${nickname}"` : `Using "${firstName}" from your account`}</div></div>
              <input className="nickin" value={nickname} placeholder={firstName} onChange={(e) => setNick(e.target.value.slice(0, 24))} aria-label="Preferred name" />
            </div>
            <div className="srow"><div><div className="lab">Appearance</div><div className="sub">Light, dark, or match your device</div></div>
              <div className="seg">{["light", "dark", "system"].map((t) => (<button key={t} className={theme === t ? "on" : ""} onClick={() => changeTheme(t)}>{t[0].toUpperCase() + t.slice(1)}</button>))}</div>
            </div>
            <div className="srow"><div><div className="lab">Language</div><div className="sub">Auto replies in whatever language you type</div></div>
              <select className="selbox" value={lang} onChange={(e) => changeLang(e.target.value)}>
                {["Auto", "English", "Nigerian Pidgin", "Igbo", "Yoruba", "Hausa", "French", "Swahili", "Arabic", "Portuguese", "Hindi"].map((l) => (<option key={l} value={l}>{l === "Auto" ? "Auto (match my language)" : l}</option>))}
              </select>
            </div>
            <div className="srow"><div><div className="lab">Hide balance</div><div className="sub">Mask amounts for privacy</div></div>
              <div className="seg"><button className={hidden ? "" : "on"} onClick={() => { if (hidden) toggleHidden(); }}>Show</button><button className={hidden ? "on" : ""} onClick={() => { if (!hidden) toggleHidden(); }}>Hide</button></div>
            </div>
            <div className="srow"><div><div className="lab">Your wallet</div><div className="sub">{addr ? addr.slice(0, 10) + "…" + addr.slice(-6) : ""}</div></div>
              <button className="iconbtn" onClick={copyAddr} aria-label="Copy address"><Icon size={16}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></Icon></button>
            </div>
            <div className="srow"><div><div className="lab">What Cowrie remembers</div><div className="sub">{facts.length ? `${facts.length} note${facts.length === 1 ? "" : "s"}, ${facts.slice(-2).join("; ")}` : "nothing yet"}</div></div>{facts.length > 0 && (<button className="mini ghost" onClick={() => { setFacts([]); if (addr) persist("cowrie.facts." + addr, "[]"); }}>Clear</button>)}</div>
            <a className="srow demoentry-settings" href="/demo"><span><span className="lab">Watch the demo</span><span className="sub">See Cowrie in action</span></span><span aria-hidden="true">↗</span></a>
            <button className="linkbtn" onClick={logout}>Sign out</button>
          </div>
        )}
        {tab === "people" && (
          <div className="panel">
            <h2 className="ptitle">People</h2>
            <div className="field"><label>Name</label><input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="e.g. Mum" /></div>
            <div className="field"><label>Wallet address</label><input value={cAddr} onChange={(e) => setCAddr(e.target.value)} placeholder="0x…" /></div>
            <button className="primary" disabled={!cName.trim() || !/^0x[a-fA-F0-9]{40}$/.test(cAddr.trim())} onClick={() => { saveContact(cName.trim(), cAddr.trim()); setCName(""); setCAddr(""); flash("Contact saved"); }}>Save contact</button>
            <div className="list" style={{ marginTop: 16 }}>
              {book.length === 0 ? <p className="muted">No saved people yet. Add someone you pay often, then pay them by name, like &ldquo;send 5,000 to Mum&rdquo;.</p> : book.map((b) => (
                <div className="pcard" key={b.address}>
                  <button className="prow" onClick={() => setOpenPos(openPos === "pay:" + b.address ? null : "pay:" + b.address)}>
                    <span className="prl"><b>{b.name}</b><small>{b.address.slice(0, 6)}…{b.address.slice(-4)}</small></span>
                    <span className="prr"><small className="muted2">Pay</small><span className="chev">{openPos === "pay:" + b.address ? "▲" : "▼"}</span></span>
                  </button>
                  {openPos === "pay:" + b.address && (
                    <div className="posexp">
                      <div className="posfield"><input type="number" inputMode="numeric" value={amtByKey[b.address] || ""} placeholder={`Amount in ${ccy}`} onChange={(e) => setAmtByKey((m) => ({ ...m, [b.address]: Number(e.target.value) }))} /></div>
                      <div className="posacts">
                        <button className="mini pay" onClick={() => payContact(b.address, b.name, amtByKey[b.address] || 0)} disabled={busy || !(amtByKey[b.address] > 0) || toUnits(amtByKey[b.address] || 0, ccy) > spendable}>Pay</button>
                        <button className="mini ghost" onClick={() => { navigator.clipboard.writeText(b.address); flash("Address copied"); }}>Copy</button>
                        <button className="mini ghost" onClick={() => removeContact(b.address)}>Remove</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {requests.length > 0 && (
              <>
                <div className="poshead" style={{ marginTop: 18 }}>Money requests</div>
                <div className="list">
                  {requests.map((r) => (
                    <div className="txrow" key={r.id}>
                      <div className="ic"><Icon size={16}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></Icon></div>
                      <div className="mid"><b>{amtStr(r.amount, r.currency)}{r.who && r.who !== "someone" ? ` from ${r.who}` : ""}</b><span style={{ color: "var(--dim)", fontSize: 12 }}>{r.note ? r.note + " · " : ""}tap copy to share</span></div>
                      <button className="mini pay" onClick={() => { if (addr) { navigator.clipboard.writeText(`Pay ${firstName} ${amtStr(r.amount, r.currency)}${r.note ? ` for ${r.note}` : ""} on Cowrie: ${addr}`); flash("Request copied"); } }}>Copy</button>
                      <button className="iconbtn" aria-label="Remove" onClick={() => removeRequest(r.id)}><Icon size={15}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></Icon></button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <nav className="nav">
          <button className={tab === "home" ? "on" : ""} onClick={() => setTab("home")}><Icon><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></Icon>Home</button>
          <button className={tab === "activity" ? "on" : ""} onClick={() => setTab("activity")}><Icon><path d="M3 12h4l3 8 4-16 3 8h4" /></Icon>Activity</button>
          <button className={tab === "people" ? "on" : ""} onClick={() => setTab("people")}><Icon><circle cx="8.5" cy="8" r="3" /><path d="M2.5 20a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.2" /><path d="M16 14.4a5.5 5.5 0 0 1 5.5 5.6" /></Icon>People</button>
          <button className={tab === "add" ? "on" : ""} onClick={() => setTab("add")}><Icon><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></Icon>Add</button>
          <button className={tab === "settings" ? "on" : ""} onClick={() => setTab("settings")}><Icon><line x1="4" y1="8" x2="20" y2="8" /><line x1="4" y1="16" x2="20" y2="16" /><circle cx="10" cy="8" r="2.4" /><circle cx="15" cy="16" r="2.4" /></Icon>Settings</button>
        </nav>
      </div>
    </div>
  );
}
