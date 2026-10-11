"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivy, useWallets, useSendTransaction } from "@privy-io/react-auth";
import { createPublicClient, createWalletClient, http, custom, formatUnits, formatEther, encodeFunctionData } from "viem";
import { monadTestnet } from "../lib/chain";
import { addresses, vaultAbi, scamAbi, usdAbi } from "../lib/contracts";

const RATE = Number(process.env.NEXT_PUBLIC_NGN_PER_USD || 1600);
const CURRENCIES: Record<string, { symbol: string; perUsd: number }> = {
  NGN: { symbol: "₦", perUsd: RATE }, USD: { symbol: "$", perUsd: 1 },
  GHS: { symbol: "₵", perUsd: 15.5 }, KES: { symbol: "KSh", perUsd: 129 },
  ZAR: { symbol: "R", perUsd: 18.2 }, GBP: { symbol: "£", perUsd: 0.79 },
  EUR: { symbol: "€", perUsd: 0.92 }, INR: { symbol: "₹", perUsd: 83 },
};
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

type Msg = { who: "you" | "cowrie"; tone?: "good" | "bad"; text: string; options?: string[]; links?: DApp[] };
type Tx = { hash: string; title: string; amount: string; sign: "pos" | "neg" | ""; ts: number };
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
  const { ready, authenticated, login, logout, user } = usePrivy();
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
  const [actView, setActView] = useState<"portfolio" | "history">("portfolio");
  const [openPos, setOpenPos] = useState<string | null>(null);
  const [requests, setRequests] = useState<{ id: string; who: string; amount: number; currency: string; note: string; ts: number }[]>([]);
  const [markets, setMarkets] = useState<{ id: number; question: string; resolved: boolean; outcome: boolean; poolYes: bigint; poolNo: bigint; yes: bigint; no: bigint }[]>([]);
  const [addAmt, setAddAmt] = useState(50000);
  const [book, setBook] = useState<{ name: string; address: `0x${string}` }[]>([]);
  const [cName, setCName] = useState("");
  const [cAddr, setCAddr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const addr = (user?.wallet?.address || wallets[0]?.address) as `0x${string}` | undefined;
  const configured = addresses.vault?.length === 42;
  const anyU = user as unknown as { google?: { name?: string }; email?: { address?: string }; farcaster?: { displayName?: string }; discord?: { username?: string } } | null;
  const rawName = anyU?.google?.name || anyU?.farcaster?.displayName || anyU?.discord?.username || anyU?.email?.address?.split("@")[0] || "there";
  const firstName = rawName.split(/[ ._@]/)[0].replace(/^./, (ch) => ch.toUpperCase());
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
      } catch { setEarned(0n); setEarnP(0n); }
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
        for (let i = 0; i < mc; i++) {
          const mk = (await publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "markets", args: [BigInt(i)] })) as { question: string; resolved: boolean; outcome: boolean; poolYes: bigint; poolNo: bigint };
          const pos = (await publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "predictionOf", args: [BigInt(i), addr] })) as { yes: bigint; no: bigint };
          ms.push({ id: i, question: mk.question, resolved: mk.resolved, outcome: mk.outcome, poolYes: mk.poolYes, poolNo: mk.poolNo, yes: pos.yes, no: pos.no });
        }
        setMarkets(ms);
      } catch {}
    } catch {}
  }, [addr, configured, assets]);
  useEffect(() => { refresh(); const t = setInterval(refresh, 4000); return () => clearInterval(t); }, [refresh]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread, busy]);
  useEffect(() => { const el = taRef.current; if (!el) return; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 140) + "px"; el.style.overflowY = el.scrollHeight > 140 ? "auto" : "hidden"; }, [input]);
  useEffect(() => { const p = [...CHIP_POOL]; for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } setStarters(p.slice(0, 3)); }, []);
  useEffect(() => {
    if (!addr || !configured) return;
    (async () => {
      try {
        const n = (await publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "listedTokensCount", args: [] })) as bigint;
        const list: { addr: `0x${string}`; symbol: string; decimals: number }[] = [];
        for (let i = 0n; i < n; i++) {
          const a = (await publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "listedTokens", args: [i] })) as `0x${string}`;
          let symbol = a.slice(0, 6); let decimals = 18;
          try { symbol = (await publicClient.readContract({ address: a, abi: usdAbi, functionName: "symbol", args: [] })) as string; } catch {}
          try { decimals = Number(await publicClient.readContract({ address: a, abi: usdAbi, functionName: "decimals", args: [] })); } catch {}
          list.push({ addr: a, symbol, decimals });
        }
        setAssets(list);
      } catch {}
    })();
  }, [addr, configured]);
  useEffect(() => { if (authenticated && configured && !greeted.current) { greeted.current = true; const h = new Date().getHours(); const tod = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; setThread((t) => (t.length ? t : [{ who: "cowrie", text: pick([`${tod}, ${firstName}. Your money's ready, tell me what to do, or tap a suggestion.`, `${tod}, ${firstName}. What should we do with your money today?`]) }])); } }, [authenticated, configured, firstName]);
  useEffect(() => { const s = localStorage.getItem("cowrie.ccy"); if (s && CURRENCIES[s]) setCcy(s); setHidden(localStorage.getItem("cowrie.hidden") === "1"); const th = localStorage.getItem("cowrie.theme"); if (th) setTheme(th); const lg = localStorage.getItem("cowrie.lang"); if (lg) setLang(lg); }, []);
  useEffect(() => { if (!addr) return; try { const s = localStorage.getItem("cowrie.tx." + addr); setHistory(s ? JSON.parse(s) : []); } catch {} }, [addr]);
  useEffect(() => { if (!addr) return; try { const s = localStorage.getItem("cowrie.book." + addr); setBook(s ? JSON.parse(s) : []); } catch {} }, [addr]);
  useEffect(() => { if (!addr) return; try { const s = localStorage.getItem("cowrie.subs." + addr); setSubs(s ? JSON.parse(s) : []); const f = localStorage.getItem("cowrie.facts." + addr); setFacts(f ? JSON.parse(f) : []); const r = localStorage.getItem("cowrie.req." + addr); setRequests(r ? JSON.parse(r) : []); } catch {} }, [addr]);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { const eff = theme === "system" ? (mq.matches ? "dark" : "light") : theme; document.documentElement.dataset.theme = eff; };
    apply(); mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, [theme]);
  const persist = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };
  const changeCcy = (c: string) => { setCcy(c); persist("cowrie.ccy", c); };
  const changeTheme = (t: string) => { setTheme(t); persist("cowrie.theme", t); };
  const changeLang = (l: string) => { setLang(l); persist("cowrie.lang", l); };
  const toggleHidden = () => setHidden((h) => { persist("cowrie.hidden", h ? "0" : "1"); return !h; });
  const copyAddr = async () => { if (addr) { await navigator.clipboard.writeText(addr); flash("Address copied"); } };
  const logTx = (e: Omit<Tx, "ts">) => setHistory((prev) => { const next = [{ ...e, ts: Date.now() }, ...prev].slice(0, 50); if (addr) persist("cowrie.tx." + addr, JSON.stringify(next)); return next; });
  const saveContact = (name: string, address: string) => setBook((prev) => { const next = [...prev.filter((x) => x.address.toLowerCase() !== address.toLowerCase()), { name, address: address as `0x${string}` }]; if (addr) persist("cowrie.book." + addr, JSON.stringify(next)); return next; });
  const removeContact = (address: string) => setBook((prev) => { const next = prev.filter((x) => x.address !== address); if (addr) persist("cowrie.book." + addr, JSON.stringify(next)); return next; });
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
  async function run(fn: string, args: unknown[], ui?: { description?: string; successHeader?: string; title?: string }) {
    const data = encodeFunctionData({ abi: vaultAbi, functionName: fn as never, args: args as never });
    let hash: `0x${string}`;
    try {
      const r = await sendTransaction(
        { to: addresses.vault, data, chainId: monadTestnet.id },
        { uiOptions: { showWalletUIs: true, buttonText: "Approve", successHeader: ui?.successHeader || "All done", successDescription: ui?.description || "", transactionInfo: { title: ui?.title || "Cowrie" } } }
      );
      hash = r.hash as `0x${string}`;
    } catch (e) {
      const m = (e as { message?: string })?.message || "";
      if (/reject|denied|declined|cancel/i.test(m)) throw e;
      const client = await getWallet();
      hash = (await client.writeContract({ address: addresses.vault, abi: vaultAbi, functionName: fn as never, args: args as never })) as `0x${string}`;
    }
    const rcpt = await publicClient.waitForTransactionReceipt({ hash });
    if (rcpt.status === "reverted") throw new Error("reverted on-chain");
    return hash as string;
  }
  function txErr(e: unknown) { const msg = (e as { shortMessage?: string; message?: string })?.shortMessage || (e as Error)?.message || "something went wrong"; if (/abort|timed? ?out|timeout/i.test(msg)) return `That took longer than expected, ${firstName}. Mind trying again?`; if (/insufficient funds/i.test(msg)) return `Your wallet's out of MON for gas, ${firstName}. Top it up and I'll try again.`; if (/user rejected|denied|rejected the request/i.test(msg)) return `No problem,I cancelled that. Nothing left your wallet.`; if (/reverted/i.test(msg)) return `That didn't go through, ${firstName}, it reverted on-chain. Your balance might be short, or the pool or market isn't ready yet. Want to try again?`; return `That didn't go through: ${msg.slice(0, 110)}. Want to try again?`; }
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
    try { const h = await run("swapCusdForToken", [a, units], { description: `Swap ${amtStr(n)} into ${symOf(a)}.`, successHeader: "Swapped", title: "Swap" }); logTx({ hash: h, title: `Bought ${symOf(a)}`, amount: amtStr(n), sign: "neg" }); say({ who: "cowrie", tone: "good", text: `Swapped ${amtStr(n)} into ${symOf(a)}. It's in your holdings under Activity.` }); setAmtByKey((m) => ({ ...m, [a]: 0 })); await refresh(); }
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
    try { const h = await run("swapTokenForCusd", [a, tokIn], { description: `Sell ${symOf(a)} back to spendable.`, successHeader: "Sold", title: "Swap" }); logTx({ hash: h, title: `Sold ${symOf(a)}`, amount: whole ? cfmt(d.value) : amtStr(nValue), sign: "pos" }); say({ who: "cowrie", tone: "good", text: `Sold ${whole ? cfmt(d.value) : amtStr(nValue)} of ${symOf(a)} back to spendable.` }); setAmtByKey((m) => ({ ...m, [a]: 0 })); await refresh(); }
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
    setInput(""); const history = thread.slice(-8).map((mm) => ({ role: mm.who === "you" ? "user" : "assistant", content: mm.text })); say({ who: "you", text }); const b = detectBrand(text); if (b) setBrand(b); setBusy(true);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000);
      let it: any;
      try { const res = await fetch("/api/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, name: firstName, lang, history, facts, bal: `spendable ${cfmt(spendable)} (about $${conv(spendable, "USD").toFixed(2)}), savings ${cfmt(savings)}, gas ${Number(formatEther(gas)).toFixed(3)} MON`, subs: subs.map((s) => `${s.service} ${amtStr(s.amount, s.currency)} every ${s.cycleDays}d, renews ${new Date(s.nextISO).toDateString()}`).join("; ") }), signal: ctrl.signal }); it = (await res.json()).intent; }
      finally { clearTimeout(timer); }
      const c = it.currency && it.currency !== "AUTO" && CURRENCIES[it.currency] ? it.currency : ccy;
      const amt = (n: number) => amtStr(n, c);
      if (it.action === "reply") { if (it.remember) remember(it.remember); say({ who: "cowrie", text: it.message || it.text || it.reply || "Okay.", options: Array.isArray(it.options) ? it.options.slice(0, 4) : undefined }); }
      else if (it.action === "discover") { say({ who: "cowrie", text: `It all lives right here in Cowrie, ${firstName}, no leaving the app. You can grow money in the Earn vault, swap into cBTC, cETH or cGOLD, send, or pay a bill. What would you like to do?` }); }
      else if (it.action === "earn") { const units = toUnits(it.amount || 0, c); if (!it.amount || units <= 0n) { say({ who: "cowrie", text: `How much would you like to move into earning, ${firstName}?`, options: ["Earn ₦10,000", "Earn ₦50,000", "Earn ₦100,000", "Another amount"] }); } else if (units > spendable) { say({ who: "cowrie", tone: "bad", text: `You've got ${cfmt(spendable)} spendable right now, ${firstName}. Pick an amount up to that and I'll move it into your Earn vault.` }); } else { const h = await run("startEarning", [units], { description: `Move ${amt(it.amount)} into your Earn vault at 10% a year.`, successHeader: "Now earning", title: "Earn" }); logTx({ hash: h, title: "Started earning", amount: amt(it.amount), sign: "" }); say({ who: "cowrie", tone: "good", text: `Done, ${firstName}. ${amt(it.amount)} is in your Cowrie Earn vault now, growing at 10% a year. Pull it out anytime with the Withdraw button on the home screen.` }); } }
      else if (it.action === "swap") { const found = resolveAsset((it.asset || "").toString()); if (!found) { say({ who: "cowrie", tone: "bad", text: `I don't have a pool for "${it.asset || "that"}" yet, ${firstName}. Right now you can trade ${assets.map((a) => a.symbol).join(", ") || "nothing yet"}.` }); } else if (it.direction === "sell") { await sellAsset(found.addr, it.amount || 0); } else if (!it.amount) { say({ who: "cowrie", text: `How much do you want to put into ${found.symbol}, ${firstName}?`, options: [`Buy ₦10,000 of ${found.symbol}`, `Buy ₦50,000 of ${found.symbol}`, `Buy ₦100,000 of ${found.symbol}`, "Another amount"] }); } else { await buyAsset(found.addr, it.amount); } }
      else if (it.action === "balance") { say({ who: "cowrie", text: `${firstName}, you've got ${cfmt(spendable)} to spend${savings > 0n ? `, with ${cfmt(savings)} tucked away in savings` : ""}. ${gas === 0n ? "Your wallet needs a little MON for gas before you can move it." : `You've ${Number(formatEther(gas)).toFixed(3)} MON left for gas.`}` }); }
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
        const what = (it.what || "that").toString();
        const isAir = /airtime|data|recharge/i.test(what) || /\b(airtime|data|recharge)\b/i.test(text);
        const hasNet = /\b(mtn|glo|airtel|9 ?mobile|etisalat)\b/i.test(what);
        const hasNum = /\d{10,}/.test(what);
        if (isAir && !hasNet) { say({ who: "cowrie", text: `Which network, ${firstName}?`, options: ["MTN", "Glo", "Airtel", "9mobile"] }); }
        else if (isAir && !hasNum) { say({ who: "cowrie", text: `What number is getting the airtime, ${firstName}? Send the 11-digit phone number.` }); }
        else if (!it.amount) { say({ who: "cowrie", text: `How much for ${what}, ${firstName}?` }); }
        else { const units = toUnits(it.amount, c); if (units > spendable) { say({ who: "cowrie", tone: "bad", text: `You've got ${cfmt(spendable)} to spend right now, ${firstName}. Add money or try a smaller amount.` }); } else { const h = await run("send", [MERCHANT, units], { description: `Pay ${amt(it.amount)} for ${what}.`, successHeader: "Paid", title: what }); logTx({ hash: h, title: `Paid ${what}`, amount: amt(it.amount), sign: "neg" }); say({ who: "cowrie", tone: "good", text: `Sent ${amt(it.amount)} for ${what}, ${firstName}. Sorted.` }); } }
      }
      else if (it.action === "request") { const who = (it.from || "someone").toString(); addRequest(who, it.amount || 0, c, (it.note || "").toString()); say({ who: "cowrie", tone: "good", text: `Done, ${firstName}. I've set up a request for ${amt(it.amount || 0)}${it.note ? ` for ${it.note}` : ""}${it.from ? ` from ${it.from}` : ""}. It's under People, tap Copy to share it.` }); }
      else if (it.action === "split") { const names = Array.isArray(it.names) ? it.names.filter(Boolean).map((x: unknown) => String(x)) : []; const n = names.length || it.people || 2; const share = Math.round((it.amount || 0) / n); if (names.length) names.forEach((nm: string) => addRequest(nm, share, c, "split bill")); say({ who: "cowrie", tone: "good", text: `${amt(it.amount || 0)} split ${n} way${n === 1 ? "" : "s"} is ${amt(share)} each.${names.length ? ` I've made a request for ${names.join(", ")}, under People.` : " Tell me the names and I'll make each request."}` }); }
      else if (it.action === "predict") { const side = String(it.side || "yes").toLowerCase() !== "no"; const hint = (it.market || "").toString().toLowerCase(); const mk = markets.find((x) => !x.resolved && hint.length > 1 && x.question.toLowerCase().includes(hint)) || markets.find((x) => !x.resolved); if (!mk) { say({ who: "cowrie", text: `No open prediction markets right now, ${firstName}. They live under Predict in the Activity tab.` }); } else if (!it.amount) { say({ who: "cowrie", text: `How much do you want to stake on "${mk.question}", ${firstName}? Open Activity and tap it under Predict to place your bet.` }); } else { await placeBet(mk.id, side, it.amount); } }
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
          {authenticated && (<button className="iconbtn bell" onClick={() => setTab("alerts")} aria-label="Reminders"><Icon size={17}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></Icon>{alertCount > 0 && <span className="badge">{alertCount}</span>}</button>)}
          {addr && (
            <button className="addrchip" onClick={copyAddr} title="Copy your wallet address" aria-label="Copy address">
              <span>{addr.slice(0, 6)}…{addr.slice(-4)}</span>
              <Icon size={15}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></Icon>
            </button>
          )}
        </header>
        {tab === "home" && (
          <>
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
            {!configured && <p className="hint">Add your contract addresses to web/.env.local and restart.</p>}
            {gas === 0n && <p className="hint">This wallet needs a little MON to move money. Open the Add tab or fund your address, then try again.</p>}
            <div className="chips">
              {starters.map((q) => (<button key={q} className="chip" onClick={() => setInput(q)}>{q}</button>))}
            </div>
            <div className="thread">
              {thread.length === 0 && <p className="empty">Tell Cowrie what to do, in your own words. Try &ldquo;save 10% of everything I receive&rdquo;.</p>}
              {thread.map((m, i) => (
                <div key={i} style={{ display: "contents" }}>
                  <div className={`bubble ${m.who}${m.tone ? " " + m.tone : ""}`}>{m.text}</div>
                  {m.who === "cowrie" && m.options && m.options.length > 0 && (<div className="quickrow">{m.options.map((o) => (<button key={o} className="quick" onClick={() => handle(o)} disabled={busy}>{o}</button>))}</div>)}
                </div>
              ))}
              {busy && (<div className="bubble cowrie thinking"><span className="dots"><i /><i /><i /></span></div>)}
              <div ref={endRef} />
            </div>
            <div className="composer">
              <textarea ref={taRef} value={input} rows={1} placeholder="Tell Cowrie what to do…" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handle(); } }} />
              <button className="send" onClick={() => handle()} disabled={busy} aria-label="Send" title="Send"><Icon size={20}><path d="M22 2 11 13" /><path d="M22 2 15 22 11 13 2 9 22 2Z" /></Icon></button>
            </div>
          </>
        )}
        {tab === "activity" && (
          <div className="panel">
            <div className="acthead">
              <h2 className="ptitle">Activity</h2>
              <div className="seg"><button className={actView === "portfolio" ? "on" : ""} onClick={() => setActView("portfolio")}>Portfolio</button><button className={actView === "history" ? "on" : ""} onClick={() => setActView("history")}>History</button></div>
            </div>
            {actView === "portfolio" ? (
              <>
                <section className="dashcard"><span className="dl">In DeFi</span><div className="dv">{mask(cfmt(defiTotal))}</div><div className="ds">{earned > 0n ? `${mask(cfmt(earned))} earning` : "nothing earning yet"}{heldCount > 0 ? ` · ${heldCount} holding${heldCount === 1 ? "" : "s"}` : ""}</div></section>
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
                            {held && <button className="mini ghost" onClick={() => sellAsset(as.addr, 0)} disabled={busy}>Sell all</button>}
                          </div>
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
            ) : (
              history.length === 0 ? <p className="muted">No transactions yet. Anything you do with Cowrie shows up here, with a link to the Monad explorer.</p> : (
                <div className="list">
                  {history.map((h) => (<div className="txrow" key={h.hash + h.ts}><div className="ic"><Icon size={16}><path d="M12 2v20M2 12h20" /></Icon></div><div className="mid"><b>{h.title}</b><a href={`${EXPLORER}/tx/${h.hash}`} target="_blank" rel="noreferrer">{new Date(h.ts).toLocaleString()} · view on explorer</a></div><span className={"amt " + h.sign}>{h.sign === "pos" ? "+" : h.sign === "neg" ? "−" : ""}{h.amount}</span></div>))}
                </div>
              )
            )}
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
            <button className="primary" onClick={addMoney} disabled={busy || gas === 0n}>{busy ? "Adding…" : `Add ${amtStr(addAmt)}`}</button>
            <p className="note">{gas === 0n ? "Your wallet needs a little MON for gas before you can add money." : "Demo top-up, mints test money on Monad. No real card is charged. In production this is a card or bank on-ramp."}</p>
          </div>
        )}
        {tab === "alerts" && (
          <div className="panel">
            <h2 className="ptitle">Reminders</h2>
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
                <div className="txrow" key={b.address}>
                  <div className="ic">{b.name.slice(0, 1).toUpperCase()}</div>
                  <div className="mid"><b>{b.name}</b><span style={{ color: "var(--dim)", fontSize: 12 }}>{b.address.slice(0, 6)}…{b.address.slice(-4)}</span></div>
                  <button className="iconbtn" aria-label="Remove" onClick={() => removeContact(b.address)}><Icon size={15}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></Icon></button>
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
