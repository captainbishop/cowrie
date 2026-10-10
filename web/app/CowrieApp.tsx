"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivy, useWallets, useSendTransaction } from "@privy-io/react-auth";
import { createPublicClient, createWalletClient, http, custom, formatUnits, formatEther, encodeFunctionData } from "viem";
import { monadTestnet } from "../lib/chain";
import { addresses, vaultAbi, scamAbi } from "../lib/contracts";

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
const CHIP_POOL = ["Send ₦5,000 to a friend", "Save 10% of what I receive", "Grow my savings", "What's my balance?", "Cap my spending at ₦20,000 a day", "Give my son ₦2,000 a day", "Remind me before Netflix renews", "Pay ₦7,500 to a seller", "Where can I earn yield?"];
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

  const refresh = useCallback(async () => {
    if (!addr || !configured) return;
    try {
      const [sp, sv, g] = await Promise.all([
        publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "spendable", args: [addr] }),
        publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "savings", args: [addr] }),
        publicClient.getBalance({ address: addr }),
      ]);
      setSpendable(sp as bigint); setSavings(sv as bigint); setGas(g as bigint);
      try { const en = await publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: "earnedOf", args: [addr] }); setEarned(en as bigint); } catch { setEarned(0n); }
    } catch {}
  }, [addr, configured]);
  useEffect(() => { refresh(); const t = setInterval(refresh, 4000); return () => clearInterval(t); }, [refresh]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread, busy]);
  useEffect(() => { const el = taRef.current; if (!el) return; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 140) + "px"; el.style.overflowY = el.scrollHeight > 140 ? "auto" : "hidden"; }, [input]);
  useEffect(() => { const p = [...CHIP_POOL]; for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } setStarters(p.slice(0, 3)); }, []);
  useEffect(() => { if (authenticated && configured && !greeted.current) { greeted.current = true; const h = new Date().getHours(); const tod = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; setThread((t) => (t.length ? t : [{ who: "cowrie", text: pick([`${tod}, ${firstName}. Your money's ready, tell me what to do, or tap a suggestion.`, `${tod}, ${firstName}. What should we do with your money today?`]) }])); } }, [authenticated, configured, firstName]);
  useEffect(() => { const s = localStorage.getItem("cowrie.ccy"); if (s && CURRENCIES[s]) setCcy(s); setHidden(localStorage.getItem("cowrie.hidden") === "1"); const th = localStorage.getItem("cowrie.theme"); if (th) setTheme(th); const lg = localStorage.getItem("cowrie.lang"); if (lg) setLang(lg); }, []);
  useEffect(() => { if (!addr) return; try { const s = localStorage.getItem("cowrie.tx." + addr); setHistory(s ? JSON.parse(s) : []); } catch {} }, [addr]);
  useEffect(() => { if (!addr) return; try { const s = localStorage.getItem("cowrie.book." + addr); setBook(s ? JSON.parse(s) : []); } catch {} }, [addr]);
  useEffect(() => { if (!addr) return; try { const s = localStorage.getItem("cowrie.subs." + addr); setSubs(s ? JSON.parse(s) : []); const f = localStorage.getItem("cowrie.facts." + addr); setFacts(f ? JSON.parse(f) : []); } catch {} }, [addr]);
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
    try {
      const { hash } = await sendTransaction(
        { to: addresses.vault, data, chainId: monadTestnet.id },
        { uiOptions: { showWalletUIs: true, buttonText: "Approve", successHeader: ui?.successHeader || "All done", successDescription: ui?.description || "", transactionInfo: { title: ui?.title || "Cowrie" } } }
      );
      try { await publicClient.waitForTransactionReceipt({ hash }); } catch {}
      return hash as string;
    } catch (e) {
      const m = (e as { message?: string })?.message || "";
      if (/reject|denied|declined|cancel/i.test(m)) throw e;
      const client = await getWallet();
      const hash = await client.writeContract({ address: addresses.vault, abi: vaultAbi, functionName: fn as never, args: args as never });
      await publicClient.waitForTransactionReceipt({ hash });
      return hash as string;
    }
  }
  function txErr(e: unknown) { const msg = (e as { shortMessage?: string; message?: string })?.shortMessage || (e as Error)?.message || "something went wrong"; if (/abort|timed? ?out|timeout/i.test(msg)) return `That took longer than expected, ${firstName}. Mind trying again?`; if (/insufficient funds/i.test(msg)) return `Your wallet's out of MON for gas, ${firstName}. Top it up and I'll try again.`; if (/user rejected|denied|rejected the request/i.test(msg)) return `No problem,I cancelled that. Nothing left your wallet.`; return `That didn't go through: ${msg.slice(0, 110)}. Want to try again?`; }
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
      else if (it.action === "discover") { const cat = ["earn", "predict", "trade"].includes(it.category) ? it.category : "earn"; const d = DAPPS[cat]; say({ who: "cowrie", text: d.intro, links: d.apps }); }
      else if (it.action === "earn") { const units = toUnits(it.amount || 0, c); if (!it.amount || units <= 0n) { say({ who: "cowrie", text: `How much would you like to move into earning, ${firstName}?`, options: ["Earn ₦10,000", "Earn ₦50,000", "Earn ₦100,000", "Another amount"] }); } else if (units > spendable) { say({ who: "cowrie", tone: "bad", text: `You've got ${cfmt(spendable)} spendable right now, ${firstName}. Pick an amount up to that and I'll move it into your Earn vault.` }); } else { const h = await run("startEarning", [units], { description: `Move ${amt(it.amount)} into your Earn vault at 10% a year.`, successHeader: "Now earning", title: "Earn" }); logTx({ hash: h, title: "Started earning", amount: amt(it.amount), sign: "" }); say({ who: "cowrie", tone: "good", text: `Done, ${firstName}. ${amt(it.amount)} is in your Cowrie Earn vault now, growing at 10% a year. Pull it out anytime with the Withdraw button on the home screen.` }); } }
      else if (it.action === "stopEarn") { if (earned <= 0n) { say({ who: "cowrie", text: `You don't have anything earning right now, ${firstName}.` }); } else { const h = await run("stopAllEarning", [], { description: "Move your earnings back to spendable.", successHeader: "Withdrawn", title: "Earn" }); logTx({ hash: h, title: "Withdrew earnings", amount: cfmt(earned), sign: "pos" }); say({ who: "cowrie", tone: "good", text: `Moved your earnings back to spendable, ${firstName}, principal and the yield it made.` }); } }
      else if (it.action === "balance") { say({ who: "cowrie", text: `${firstName}, you've got ${cfmt(spendable)} to spend${savings > 0n ? `, with ${cfmt(savings)} tucked away in savings` : ""}. ${gas === 0n ? "Your wallet needs a little MON for gas before you can move it." : `You've ${Number(formatEther(gas)).toFixed(3)} MON left for gas.`}` }); }
      else if (it.action === "addSubscription") { const s = addSub(it.service || "Subscription", it.amount || 0, it.currency, it.cycleDays, it.startedDaysAgo); const d = Math.ceil((new Date(s.nextISO).getTime() - Date.now()) / 86400000); say({ who: "cowrie", tone: "good", text: `Got it, ${firstName}, I'm now tracking your ${s.service}${s.amount ? ` at ${amtStr(s.amount, s.currency)}` : ""}. ${d <= 0 ? "It's due now" : `Next renewal in ${d} day${d === 1 ? "" : "s"}`}. I'll nudge you to renew or cancel, tap the bell up top.` }); }
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
              <div className="walletfoot"><span>Savings pot {mask(cfmt(savings))}</span><span>{Number(formatEther(gas)).toFixed(3)} MON gas</span></div>
              <div className="shellmark" aria-hidden="true" />
            </section>
            {brand && (<button className="scenebanner" style={{ color: brand.color, borderColor: brand.color }} onClick={() => setBrand(null)}><span className="cdot" style={{ background: brand.color }} /><span>{brand.label}, want this as a monthly plan?</span></button>)}
            {low && !brand && (<button className="lownote" onClick={() => setTab("add")}>You&rsquo;re running low, tap to top up.</button>)}
            {alertCount > 0 && (<button className="remind" onClick={() => setTab("alerts")}><span className="cdot" style={{ background: "var(--brass)" }} /><span>{dueSubs[0].s.service} {dueSubs[0].days <= 0 ? "is due now" : `${dueSubs[0].s.cycleDays > 0 ? "renews" : "due"} in ${dueSubs[0].days} day${dueSubs[0].days === 1 ? "" : "s"}`}, tap to review</span></button>)}
            {earned > 0n && (<div className="earnstrip"><div className="ei"><b>Earning {mask(cfmt(earned))}</b><small>Cowrie vault · 10% a year</small></div><button className="earnw" onClick={withdrawEarnings} disabled={busy}>Withdraw</button></div>)}
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
                  {m.who === "cowrie" && m.links && m.links.length > 0 && (<div className="dapps">{m.links.map((d) => (<a key={d.url + d.label} className="dapp" href={d.url} target="_blank" rel="noreferrer"><span className="dapptop"><b>{d.label}</b><span className="daptag">{d.tag}</span></span><span className="dapdesc">{d.desc}</span></a>))}</div>)}
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
            <h2 className="ptitle">Activity</h2>
            {history.length === 0 ? <p className="muted">No transactions yet. Anything you do with Cowrie shows up here, with a link to the Monad explorer.</p> : (
              <div className="list">
                {history.map((h) => (
                  <div className="txrow" key={h.hash + h.ts}>
                    <div className="ic"><Icon size={16}><path d="M12 2v20M2 12h20" /></Icon></div>
                    <div className="mid"><b>{h.title}</b><a href={`${EXPLORER}/tx/${h.hash}`} target="_blank" rel="noreferrer">{new Date(h.ts).toLocaleString()} · view on explorer</a></div>
                    <span className={"amt " + h.sign}>{h.sign === "pos" ? "+" : h.sign === "neg" ? "−" : ""}{h.amount}</span>
                  </div>
                ))}
              </div>
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
            <div className="srow"><div><div className="lab">Language</div><div className="sub">Cowrie replies in this language</div></div>
              <select className="selbox" value={lang} onChange={(e) => changeLang(e.target.value)}>
                {["Auto", "English", "Nigerian Pidgin", "Igbo", "Yoruba", "Hausa", "French", "Swahili", "Arabic", "Portuguese", "Hindi"].map((l) => (<option key={l} value={l}>{l}</option>))}
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
