/* eslint-disable @typescript-eslint/no-explicit-any */
// Demo bill payments. Every lookup, price and token in this file is simulated: no real biller is contacted and
// no real token is bought. The money that moves is test money on Monad testnet.

export type BillKind = "electricity" | "airtime" | "data" | "cable";
export type BillState = { kind: BillKind; step: string; d: Record<string, any> };
export type BillSay = { text: string; options?: string[]; tone?: "good" | "bad" };
export type BillOut = {
  state: BillState | null;
  say: BillSay[];
  later?: BillSay[];
  delayMs?: number;
  pay?: { naira: number; title: string; desc: string };
};

const fmtN = (n: number) => "₦" + Math.round(n).toLocaleString("en-US");

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickOf<T>(a: T[], r: () => number): T { return a[Math.floor(r() * a.length)]; }
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The item whose name appears in the text as a whole word; the longest matching name wins. */
function mentions<T>(t: string, list: T[], keys: (x: T) => string[]): T | undefined {
  const s = t.toLowerCase();
  let best: T | undefined;
  let bestLen = 0;
  for (const x of list) {
    for (const k of keys(x)) {
      if (!k) continue;
      if (k.length > bestLen && new RegExp(`(^|[^a-z0-9])${esc(k.toLowerCase())}($|[^a-z0-9])`).test(s)) { best = x; bestLen = k.length; }
    }
  }
  return best;
}
/** Like mentions, but also accepts a partial word the user typed (three letters or more). */
function choose<T>(t: string, list: T[], keys: (x: T) => string[]): T | undefined {
  const m = mentions(t, list, keys);
  if (m) return m;
  const s = t.toLowerCase().trim();
  if (s.length < 3) return undefined;
  return list.find((x) => keys(x).some((k) => k && k.toLowerCase().includes(s)));
}

export function parseAmount(t: string): number {
  const m = t.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(k|m)?/i);
  if (!m) return 0;
  let n = parseFloat(m[1]);
  const u = (m[2] || "").toLowerCase();
  if (u === "k") n *= 1000; else if (u === "m") n *= 1000000;
  return Math.round(n);
}
/** A run of digits (spaces or dashes allowed between them) whose length is min..max, or null. */
function longNum(t: string, min: number, max: number): string | null {
  const m = t.match(/\d(?:[\s-]?\d){8,15}/);
  if (!m) return null;
  const d = m[0].replace(/\D/g, "");
  return d.length >= min && d.length <= max ? d : null;
}
function phoneOf(t: string): string | null {
  const m = t.replace(/[\s-]/g, "").match(/(?:\+?234|0)[789]\d{9}/);
  return m ? m[0].replace(/^\+?234/, "0") : null;
}

const when = () => new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const shortDate = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
function reference(seed: string): string {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `CWR-${String(t.getFullYear()).slice(2)}${p(t.getMonth() + 1)}${p(t.getDate())}-${hash(seed + t.getTime()).toString(36).toUpperCase().slice(0, 6)}`;
}
function token20(seed: string): string {
  const r = rng(hash(seed + Date.now()));
  const d = Array.from({ length: 20 }, () => Math.floor(r() * 10)).join("");
  return d.match(/.{4}/g)!.join("-");
}

// ---------- demo data ----------

type Disco = { id: string; name: string; short: string; word: string; areas: string[] };
const DISCOS: Disco[] = [
  { id: "ikedc", name: "Ikeja Electric", short: "IKEDC", word: "Ikeja", areas: ["Ikeja", "Maryland", "Agege", "Ikorodu"] },
  { id: "ekedc", name: "Eko Electricity", short: "EKEDC", word: "Eko", areas: ["Lekki", "Surulere", "Victoria Island", "Festac"] },
  { id: "ibedc", name: "Ibadan Electricity", short: "IBEDC", word: "Ibadan", areas: ["Bodija", "Ring Road", "Challenge", "Dugbe"] },
  { id: "aedc", name: "Abuja Electricity", short: "AEDC", word: "Abuja", areas: ["Garki", "Wuse", "Gwarinpa", "Maitama"] },
  { id: "phed", name: "Port Harcourt Electricity", short: "PHED", word: "Port Harcourt", areas: ["GRA Phase 2", "Rumuola", "Diobu", "Trans Amadi"] },
  { id: "eedc", name: "Enugu Electricity", short: "EEDC", word: "Enugu", areas: ["Independence Layout", "Trans Ekulu", "Abakpa", "New Haven"] },
  { id: "kedco", name: "Kano Electricity", short: "KEDCO", word: "Kano", areas: ["Nassarawa", "Sabon Gari", "Fagge", "Bompai"] },
  { id: "kaedco", name: "Kaduna Electric", short: "KAEDCO", word: "Kaduna", areas: ["Barnawa", "Ungwan Rimi", "Malali", "Sabon Tasha"] },
  { id: "bedc", name: "Benin Electricity", short: "BEDC", word: "Benin", areas: ["GRA", "Ugbowo", "Sapele Road", "Oregbeni"] },
  { id: "jed", name: "Jos Electricity", short: "JED", word: "Jos", areas: ["Rayfield", "Bukuru", "Angwan Rukuba", "Terminus"] },
  { id: "yedc", name: "Yola Electricity", short: "YEDC", word: "Yola", areas: ["Jimeta", "Karewa", "Nasarawo", "Mubi Road"] },
];
const discoLabel = (z: Disco) => `${z.word} (${z.short})`;
const discoKeys = (z: Disco) => [discoLabel(z), z.short, z.name, z.word];
const BAND_TARIFF: Record<string, number> = { A: 209.5, B: 63, C: 50, D: 32, E: 28 }; // demo tariffs, naira per kWh

const NETWORKS = [
  { name: "MTN", keys: ["mtn"] },
  { name: "Airtel", keys: ["airtel"] },
  { name: "Glo", keys: ["glo", "globacom"] },
  { name: "9mobile", keys: ["9mobile", "9 mobile", "etisalat"] },
];
const netKeys = (z: { name: string; keys: string[] }) => [z.name, ...z.keys];
const DATA_PLANS = [
  { name: "500MB · 7 days", price: 500 },
  { name: "1.5GB · 30 days", price: 1000 },
  { name: "3GB · 30 days", price: 1500 },
  { name: "6GB · 30 days", price: 2500 },
  { name: "12GB · 30 days", price: 4000 },
  { name: "25GB · 30 days", price: 7000 },
];
const planLabel = (p: { name: string; price: number }) => `${p.name} · ${fmtN(p.price)}`;
const planKeys = (p: { name: string; price: number }) => [planLabel(p), p.name, p.name.split(" ")[0]];

const CABLE = [
  { id: "dstv", name: "DStv", keys: ["dstv"], pkgs: [{ name: "Padi", price: 3600 }, { name: "Yanga", price: 5100 }, { name: "Confam", price: 9300 }, { name: "Compact", price: 15700 }, { name: "Compact Plus", price: 25000 }, { name: "Premium", price: 44500 }] },
  { id: "gotv", name: "GOtv", keys: ["gotv"], pkgs: [{ name: "Smallie", price: 1900 }, { name: "Jinja", price: 3900 }, { name: "Jolli", price: 5800 }, { name: "Max", price: 8500 }, { name: "Supa", price: 11400 }] },
  { id: "startimes", name: "StarTimes", keys: ["startimes", "star times"], pkgs: [{ name: "Nova", price: 1900 }, { name: "Basic", price: 3700 }, { name: "Smart", price: 5100 }, { name: "Classic", price: 6500 }, { name: "Super", price: 11000 }] },
];
const cableKeys = (z: { name: string; keys: string[] }) => [z.name, ...z.keys];
const pkgLabel = (p: { name: string; price: number }) => `${p.name} · ${fmtN(p.price)}`;
const pkgKeys = (p: { name: string; price: number }) => [pkgLabel(p), p.name];
const CITIES = ["Lagos", "Abuja", "Ibadan", "Port Harcourt", "Kano", "Enugu", "Benin"];

const FIRST = ["Adebayo", "Chioma", "Ibrahim", "Ngozi", "Emeka", "Fatima", "Tunde", "Amaka", "Yusuf", "Blessing", "Segun", "Zainab", "Chinedu", "Bisi", "Musa", "Ada"];
const LAST = ["Okafor", "Adeyemi", "Bello", "Eze", "Balogun", "Ogunleye", "Danjuma", "Nwosu", "Abubakar", "Afolabi", "Obi", "Lawal", "Okonkwo", "Salami", "Umar", "Ojo"];
const STREETS = ["Ogunlana Drive", "Allen Avenue", "Church Street", "Unity Road", "Station Road", "Adeola Odeku Street", "Market Road", "Peace Avenue"];
/** The same number always gives the same made-up person, whichever company or provider is picked. */
function demoCustomer(digits: string, areas: string[], areaKey: string) {
  const r = rng(hash("who" + digits));
  const name = `${pickOf(FIRST, r)} ${pickOf(LAST, r)} (DEMO)`.toUpperCase();
  const band = pickOf(["A", "B", "B", "C", "C", "D", "E"], r);
  const outstanding = Math.round((2000 + r() * 28000) / 50) * 50;
  const num = 1 + Math.floor(r() * 60);
  const street = pickOf(STREETS, r);
  const area = pickOf(areas, rng(hash(areaKey + digits)));
  return { name, address: `${num} ${street}, ${area}`, band, outstanding };
}

// ---------- shared pieces ----------

const BARE_CANCEL = /^\s*(cancel|stop|exit|abort|nvm|never ?mind|nevermind|forget it|leave it|abeg leave am|not now|no thanks?|nope)\s*[.!]*\s*$/i;
const WRONG = /\b(wrong|incorrect|mistake|not (me|mine|my|right|correct|it)|that'?s not|thats not|nah)\b/i;
const CHANGE = /\b(change|edit|switch|redo|different|another|go back|wrong|incorrect|mistake)\b/i;
const NAME_WORD = /\b(name|address|details|package|current|not me|not mine|that'?s not me)\b/i;
const KIND_OPTIONS = ["Electricity", "Airtime", "Data", "Cable TV"];
const DEMO_NOTE = "Those details come from the demo lookup, which makes them up from the number you type, so they will not match a real account.";

function isPay(t: string, d: Record<string, any>): boolean {
  const c = t.trim();
  if (d.total && new RegExp("^pay\\s*" + esc(fmtN(d.total)) + "\\s*$", "i").test(c)) return true;
  return !/\d/.test(c) && /^(pay|yes|yep|yeah|confirm|ok|okay|proceed|go ahead|go|do it|sure|continue)\b/i.test(c);
}
const stalePay = (t: string) => /^\s*pay\s*₦?\s*[\d,]+\s*$/i.test(t);

export function detectBill(t: string): BillKind | "ask" | null {
  const s = t.toLowerCase().trim();
  if (/0x[a-f0-9]{10,}|\b(aj+o+|esusu|susu|thrift)\b/.test(s)) return null;
  if (/^(pay (a |my |some )?bills?|bills?|pay bill|bill payment)$/.test(s)) return "ask";
  if (/\b(electricity|nepa|phcn|prepaid meter|postpaid meter|buy (light|units|current)|light bill|power bill)\b/.test(s)) return "electricity";
  if (/\b(dstv|gotv|startimes|cable tv|cable|decoder)\b/.test(s)) return "cable";
  if (/\b(airtime|recharge|top ?up (my )?(phone|line))\b/.test(s)) return "airtime";
  if (/^data$|\b(buy data|data bundle|data plan|data subscription|mobile data)\b/.test(s)) return "data";
  return null;
}

export function billStart(kind: BillKind | "ask"): BillOut {
  if (kind === "ask") return { state: { kind: "electricity", step: "category", d: {} }, say: [{ text: "What would you like to pay for?", options: KIND_OPTIONS }] };
  const st: BillState = { kind, step: "", d: {} };
  if (kind === "electricity") return elecAdvance(st, {}, [{ text: "Let's buy electricity." }]);
  if (kind === "airtime") return teleAdvance(st, {}, [{ text: "Let's buy airtime." }]);
  if (kind === "data") return teleAdvance(st, {}, [{ text: "Let's buy data." }]);
  return cableAdvance(st, {}, [{ text: "Let's renew your TV subscription." }]);
}

function payTitle(st: BillState): string {
  const d = st.d;
  if (st.kind === "electricity") return `Electricity · ${DISCOS.find((z) => z.id === d.disco)?.short || ""}`;
  if (st.kind === "airtime") return `${d.net} airtime`;
  if (st.kind === "data") return `${d.net} data`;
  return `${CABLE.find((z) => z.id === d.prov)?.name || "TV"} ${d.pkg || ""}`.trim();
}
function payOut(st: BillState, d: Record<string, any>): BillOut {
  const ns: BillState = { ...st, step: "paying", d };
  return { state: ns, say: [], pay: { naira: d.total, title: payTitle(ns), desc: `Demo biller, test money: ${fmtN(d.total)}` } };
}
const askWhat = (st: BillState, d: Record<string, any>, options: string[]): BillOut => ({ state: { ...st, d }, say: [{ text: "What would you like to change?", options: [...options, "Cancel"] }] });

// ---------- electricity ----------

function elecPrompt(d: Record<string, any>): { step: string; say: BillSay } {
  const disco = DISCOS.find((z) => z.id === d.disco)!;
  if (!d.amount) {
    return d.mtype === "postpaid"
      ? { step: "eamount", say: { text: `Outstanding bill: ${fmtN(d.cust.outstanding)}. How much do you want to pay?`, options: [`Pay ${fmtN(d.cust.outstanding)}`, "Other amount"] } }
      : { step: "eamount", say: { text: "How much electricity do you want to buy? The minimum is ₦1,000.", options: ["₦2,000", "₦5,000", "₦10,000", "₦20,000"] } };
  }
  d.fee = 100;
  d.total = d.amount + d.fee;
  if (d.mtype === "prepaid") d.units = Math.round((d.amount / BAND_TARIFF[d.cust.band]) * 100) / 100; else delete d.units;
  const sum = `Please confirm\n${disco.name} · ${d.mtype}\nMeter ${d.meter} · ${d.cust.name}\nAmount ${fmtN(d.amount)}\nService charge ${fmtN(d.fee)}\nTotal ${fmtN(d.total)}` +
    (d.mtype === "prepaid" ? `\nYou will get about ${d.units} kWh at the demo band ${d.cust.band} tariff` : "");
  return { step: "confirm", say: { text: sum, options: [`Pay ${fmtN(d.total)}`, "Change amount", "Cancel"] } };
}

function elecAdvance(st: BillState, d: Record<string, any>, lead: BillSay[] = []): BillOut {
  const mk = (step: string, say: BillSay[], extra?: Partial<BillOut>): BillOut => ({ state: { ...st, step, d }, say: [...lead, ...say], ...extra });
  const disco = DISCOS.find((z) => z.id === d.disco);
  if (!disco) return mk("disco", [{ text: "Which company (DISCO) supplies your meter?", options: DISCOS.map(discoLabel) }]);
  if (!d.mtype) return mk("mtype", [{ text: `${disco.name}. Is your meter prepaid or postpaid?`, options: ["Prepaid", "Postpaid"] }]);
  if (!d.meter) return mk("meter", [{ text: `Please send your ${d.mtype} meter number, the 11 digits printed on your meter.` }]);
  const key = `${disco.id}:${d.meter}`;
  if (!d.cust || d.custKey !== key) {
    d.cust = demoCustomer(d.meter, disco.areas, disco.id);
    d.custKey = key;
    const info = `Meter verified (demo lookup, not a real account)\n${d.cust.name}\n${d.cust.address}\n${d.mtype === "prepaid" ? "Prepaid" : "Postpaid"} · Tariff band ${d.cust.band}`;
    const nx = elecPrompt(d);
    return { state: { ...st, step: nx.step, d }, say: [...lead, { text: `Checking meter ${d.meter} with ${disco.name}...` }], later: [{ text: info, tone: "good" }, nx.say], delayMs: 1200 };
  }
  const nx = elecPrompt(d);
  return mk(nx.step, [nx.say]);
}

function elecCorrect(st: BillState, d: Record<string, any>, t: string): BillOut | null {
  const say = (text: string): BillSay[] => [{ text }];
  const num = longNum(t, 10, 13);
  if (num && st.step !== "meter") { d.meter = num; delete d.cust; delete d.custKey; return elecAdvance(st, d, say(`Okay, using meter ${num}.`)); }
  const disco = mentions(t, DISCOS, discoKeys);
  if (disco && st.step !== "disco" && disco.id !== d.disco) { d.disco = disco.id; delete d.custKey; return elecAdvance(st, d, say(`Okay, switching to ${disco.name}.`)); }
  const post = /\bpost ?paid\b/i.test(t), pre = /\bpre ?paid\b/i.test(t);
  if (st.step !== "mtype" && d.mtype && (post || pre) && (post ? "postpaid" : "prepaid") !== d.mtype) {
    d.mtype = post ? "postpaid" : "prepaid"; delete d.amount;
    return elecAdvance(st, d, say(`Okay, switching to ${d.mtype}.`));
  }
  if (!(WRONG.test(t) || CHANGE.test(t))) return null;
  if (/\b(company|disco|supplier)\b/i.test(t)) { delete d.disco; delete d.custKey; return elecAdvance(st, d, say("No problem.")); }
  if (/\b(amount|price|how much)\b/i.test(t)) { delete d.amount; return elecAdvance(st, d, say("No problem.")); }
  if (/\b(prepaid|postpaid|type)\b/i.test(t)) { delete d.mtype; delete d.amount; return elecAdvance(st, d, say("No problem.")); }
  if (d.meter && NAME_WORD.test(t) && !/\b(meter|number|digits)\b/i.test(t)) {
    return { state: { ...st, d }, say: [{ text: `${DEMO_NOTE} Send a different meter number to try again, or carry on with this one.`, options: ["Try another meter number", st.step === "confirm" ? `Pay ${fmtN(d.total)}` : "Continue", "Cancel"] }] };
  }
  if (/\b(meter|number|digits|name|address|details)\b/i.test(t)) { delete d.meter; delete d.cust; delete d.custKey; return elecAdvance(st, d, say("No problem.")); }
  return askWhat(st, d, ["Change meter number", "Change company", "Change amount"]);
}

function elecStep(st: BillState, d: Record<string, any>, t: string, skip = false): BillOut {
  if (!skip) { const c = elecCorrect(st, d, t); if (c) return c; }
  const again = (text: string, options?: string[]): BillOut => ({ state: { ...st, d }, say: [{ text, options }] });
  switch (st.step) {
    case "disco": {
      const x = choose(t, DISCOS, discoKeys);
      if (!x) return again("I did not recognise that company. Which one supplies your meter?", DISCOS.map(discoLabel));
      d.disco = x.id; delete d.custKey;
      return elecAdvance(st, d);
    }
    case "mtype": {
      const post = /post/i.test(t), pre = /pre/i.test(t);
      if (!post && !pre) return again("Is your meter prepaid or postpaid?", ["Prepaid", "Postpaid"]);
      d.mtype = post ? "postpaid" : "prepaid";
      return elecAdvance(st, d);
    }
    case "meter": {
      const digits = t.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 13) return again("A meter number has 10 to 13 digits. Please check it and send it again.");
      d.meter = digits; delete d.cust; delete d.custKey;
      return elecAdvance(st, d);
    }
    case "eamount": {
      if (/other/i.test(t) && !/\d/.test(t)) return again("Type the amount you want to pay.");
      const amt = parseAmount(t);
      const min = d.mtype === "prepaid" ? 1000 : 500;
      if (!amt) return again("How much do you want to pay? For example 5000.");
      if (amt < min) return again(`The minimum is ${fmtN(min)}. Please send a higher amount.`);
      if (amt > 200000) return again("The maximum for one payment is ₦200,000. Please send a smaller amount.");
      d.amount = amt;
      return elecAdvance(st, d);
    }
    case "confirm": {
      if (isPay(t, d)) return payOut(st, d);
      if (stalePay(t)) return again(`The total is now ${fmtN(d.total)}. Say "pay" to continue.`, [`Pay ${fmtN(d.total)}`, "Change amount", "Cancel"]);
      if (/\d/.test(t)) return elecStep({ ...st, step: "eamount" }, d, t, true);
      return again('Say "pay" to continue or "cancel" to stop.', [`Pay ${fmtN(d.total)}`, "Change amount", "Cancel"]);
    }
  }
  return again("Something went wrong with that bill, and nothing was paid. Say what you would like to pay and we will start again.");
}

// ---------- airtime and data ----------

function teleAdvance(st: BillState, d: Record<string, any>, lead: BillSay[] = []): BillOut {
  const data = st.kind === "data";
  const mk = (step: string, say: BillSay[]): BillOut => ({ state: { ...st, step, d }, say: [...lead, ...say] });
  if (!d.net) return mk("net", [{ text: "Which network?", options: NETWORKS.map((z) => z.name) }]);
  if (!d.phone) return mk("phone", [{ text: `${d.net}. Which phone number should get the ${data ? "data" : "airtime"}? Send the 11-digit number.` }]);
  if (!data && !d.amount) return mk("aamount", [{ text: `Sending to ${d.phone} on ${d.net}. How much airtime?`, options: ["₦100", "₦200", "₦500", "₦1,000"] }]);
  if (data && !d.plan) return mk("plan", [{ text: `Data bundles for ${d.phone} on ${d.net} (demo plans). Choose one:`, options: DATA_PLANS.map(planLabel) }]);
  d.total = d.amount;
  const sum = data ? `Please confirm\n${d.net} data · ${d.plan}\nTo ${d.phone}\nPrice ${fmtN(d.amount)}` : `Please confirm\n${d.net} airtime\nTo ${d.phone}\nAmount ${fmtN(d.amount)}`;
  return mk("confirm", [{ text: sum, options: [`Pay ${fmtN(d.total)}`, data ? "Change plan" : "Change amount", "Cancel"] }]);
}

function teleCorrect(st: BillState, d: Record<string, any>, t: string): BillOut | null {
  const data = st.kind === "data";
  const say = (text: string): BillSay[] => [{ text }];
  const ph = phoneOf(t);
  if (ph && st.step !== "phone") { d.phone = ph; return teleAdvance(st, d, say(`Okay, using ${ph}.`)); }
  const net = mentions(t, NETWORKS, netKeys);
  if (net && st.step !== "net" && net.name !== d.net) { d.net = net.name; return teleAdvance(st, d, say(`Okay, switching to ${net.name}.`)); }
  if (data && st.step !== "plan") {
    const pl = mentions(t, DATA_PLANS, planKeys);
    if (pl && pl.name !== d.plan && d.net) { d.plan = pl.name; d.amount = pl.price; return teleAdvance(st, d, say(`Okay, ${pl.name}.`)); }
  }
  if (!(WRONG.test(t) || CHANGE.test(t))) return null;
  if (/\b(network|sim)\b/i.test(t)) { delete d.net; return teleAdvance(st, d, say("No problem.")); }
  if (/\b(phone|number|digits|line)\b/i.test(t)) { delete d.phone; return teleAdvance(st, d, say("No problem.")); }
  if (data && /\b(plan|bundle|data)\b/i.test(t)) { delete d.plan; delete d.amount; return teleAdvance(st, d, say("No problem.")); }
  if (/\b(amount|price|how much)\b/i.test(t)) { delete d.amount; if (data) delete d.plan; return teleAdvance(st, d, say("No problem.")); }
  return askWhat(st, d, ["Change number", "Change network", data ? "Change plan" : "Change amount"]);
}

function teleStep(st: BillState, d: Record<string, any>, t: string, skip = false): BillOut {
  if (!skip) { const c = teleCorrect(st, d, t); if (c) return c; }
  const again = (text: string, options?: string[]): BillOut => ({ state: { ...st, d }, say: [{ text, options }] });
  switch (st.step) {
    case "net": {
      const n = choose(t, NETWORKS, netKeys);
      if (!n) return again("Which network?", NETWORKS.map((z) => z.name));
      d.net = n.name;
      return teleAdvance(st, d);
    }
    case "phone": {
      const p = phoneOf(t) || t.replace(/[\s-]/g, "").replace(/^\+?234/, "0");
      if (!/^0[789]\d{9}$/.test(p)) return again("That does not look like a Nigerian mobile number. It should be 11 digits, like 08031234567.");
      d.phone = p;
      return teleAdvance(st, d);
    }
    case "aamount": {
      const amt = parseAmount(t);
      if (!amt) return again("How much airtime? For example 500.");
      if (amt < 50) return again("The minimum airtime is ₦50.");
      if (amt > 50000) return again("The maximum airtime in one go is ₦50,000.");
      d.amount = amt;
      return teleAdvance(st, d);
    }
    case "plan": {
      const p = choose(t, DATA_PLANS, planKeys);
      if (!p) return again("Which data plan?", DATA_PLANS.map(planLabel));
      d.plan = p.name; d.amount = p.price;
      return teleAdvance(st, d);
    }
    case "confirm": {
      if (isPay(t, d)) return payOut(st, d);
      if (stalePay(t)) return again(`The total is now ${fmtN(d.total)}. Say "pay" to continue.`, [`Pay ${fmtN(d.total)}`, st.kind === "data" ? "Change plan" : "Change amount", "Cancel"]);
      if (/\d/.test(t) && st.kind === "airtime") return teleStep({ ...st, step: "aamount" }, d, t, true);
      return again('Say "pay" to continue or "cancel" to stop.', [`Pay ${fmtN(d.total)}`, st.kind === "data" ? "Change plan" : "Change amount", "Cancel"]);
    }
  }
  return again("Something went wrong with that bill, and nothing was paid. Say what you would like to pay and we will start again.");
}

// ---------- cable TV ----------

function cablePrompt(d: Record<string, any>): BillSay {
  const prov = CABLE.find((z) => z.id === d.prov)!;
  if (!d.pkg) return { text: "Which package do you want to pay for? These are demo prices.", options: prov.pkgs.map(pkgLabel) };
  d.total = d.amount;
  return { text: `Please confirm\n${prov.name} ${d.pkg}\nCard ${d.card} · ${d.cust.name}\nPrice ${fmtN(d.amount)}`, options: [`Pay ${fmtN(d.total)}`, "Change package", "Cancel"] };
}

function cableAdvance(st: BillState, d: Record<string, any>, lead: BillSay[] = []): BillOut {
  const mk = (step: string, say: BillSay[]): BillOut => ({ state: { ...st, step, d }, say: [...lead, ...say] });
  const prov = CABLE.find((z) => z.id === d.prov);
  if (!prov) return mk("prov", [{ text: "Which provider?", options: CABLE.map((z) => z.name) }]);
  if (!d.card) return mk("card", [{ text: `${prov.name}. Please send your smartcard or IUC number, 10 digits.` }]);
  const key = `${prov.id}:${d.card}`;
  if (!d.cust || d.custKey !== key) {
    const r = rng(hash(prov.id + d.card));
    d.cust = demoCustomer(d.card, CITIES, prov.id);
    d.custKey = key;
    d.current = pickOf(prov.pkgs, r).name;
    const due = shortDate(Date.now() - Math.floor(r() * 5) * 86400000);
    const nx = cablePrompt(d);
    return { state: { ...st, step: d.pkg ? "confirm" : "pkg", d }, say: [...lead, { text: `Checking ${prov.name} card ${d.card}...` }], later: [{ text: `Card verified (demo lookup, not a real account)\n${d.cust.name}\nCurrent package: ${d.current}\nDue ${due}`, tone: "good" }, nx], delayMs: 1100 };
  }
  return mk(d.pkg ? "confirm" : "pkg", [cablePrompt(d)]);
}

function cableCorrect(st: BillState, d: Record<string, any>, t: string): BillOut | null {
  const say = (text: string): BillSay[] => [{ text }];
  const num = longNum(t, 10, 11);
  if (num && st.step !== "card") { d.card = num; delete d.cust; delete d.custKey; return cableAdvance(st, d, say(`Okay, using card ${num}.`)); }
  const prov = mentions(t, CABLE, cableKeys);
  if (prov && st.step !== "prov" && prov.id !== d.prov) { d.prov = prov.id; delete d.pkg; delete d.amount; delete d.custKey; return cableAdvance(st, d, say(`Okay, switching to ${prov.name}.`)); }
  const cur = CABLE.find((z) => z.id === d.prov);
  if (cur && st.step !== "pkg") {
    const pk = mentions(t, cur.pkgs, pkgKeys);
    if (pk && pk.name !== d.pkg && d.card) { d.pkg = pk.name; d.amount = pk.price; return cableAdvance(st, d, say(`Okay, ${pk.name}.`)); }
  }
  if (!(WRONG.test(t) || CHANGE.test(t))) return null;
  if (d.card && NAME_WORD.test(t) && !/\b(card|smartcard|iuc|number)\b/i.test(t)) {
    return { state: { ...st, d }, say: [{ text: `${DEMO_NOTE} Send a different card number to try again, or carry on with this one.`, options: ["Try another card number", st.step === "confirm" ? `Pay ${fmtN(d.total)}` : "Continue", "Cancel"] }] };
  }
  if (/\b(card|smartcard|iuc|number|name|details)\b/i.test(t)) { delete d.card; delete d.cust; delete d.custKey; return cableAdvance(st, d, say("No problem.")); }
  if (/\b(provider|decoder)\b/i.test(t)) { delete d.prov; delete d.pkg; delete d.amount; delete d.custKey; return cableAdvance(st, d, say("No problem.")); }
  if (/\b(package|pack|bouquet|plan|price|amount)\b/i.test(t)) { delete d.pkg; delete d.amount; return cableAdvance(st, d, say("No problem.")); }
  return askWhat(st, d, ["Change card number", "Change provider", "Change package"]);
}

function cableStep(st: BillState, d: Record<string, any>, t: string): BillOut {
  const c = cableCorrect(st, d, t);
  if (c) return c;
  const again = (text: string, options?: string[]): BillOut => ({ state: { ...st, d }, say: [{ text, options }] });
  switch (st.step) {
    case "prov": {
      const p = choose(t, CABLE, cableKeys);
      if (!p) return again("Which TV provider?", CABLE.map((z) => z.name));
      d.prov = p.id; delete d.pkg; delete d.amount; delete d.custKey;
      return cableAdvance(st, d);
    }
    case "card": {
      const digits = t.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 11) return again("A smartcard number has 10 digits. Please check it and send it again.");
      d.card = digits; delete d.cust; delete d.custKey;
      return cableAdvance(st, d);
    }
    case "pkg": {
      const prov = CABLE.find((z) => z.id === d.prov)!;
      const p = choose(t, prov.pkgs, pkgKeys);
      if (!p) return again("Which package?", prov.pkgs.map(pkgLabel));
      d.pkg = p.name; d.amount = p.price;
      return cableAdvance(st, d);
    }
    case "confirm": {
      if (isPay(t, d)) return payOut(st, d);
      if (stalePay(t)) return again(`The total is now ${fmtN(d.total)}. Say "pay" to continue.`, [`Pay ${fmtN(d.total)}`, "Change package", "Cancel"]);
      return again('Say "pay" to continue or "cancel" to stop.', [`Pay ${fmtN(d.total)}`, "Change package", "Cancel"]);
    }
  }
  return again("Something went wrong with that bill, and nothing was paid. Say what you would like to pay and we will start again.");
}

// ---------- entry point ----------

export function billNext(st: BillState, raw: string): BillOut {
  const t = raw.trim();
  if (st.step === "paying") return { state: st, say: [{ text: "One moment, your payment is still going through." }] };
  if (BARE_CANCEL.test(t) || (st.step === "confirm" && /^\s*no\s*[.!]*\s*$/i.test(t))) return { state: null, say: [{ text: "Okay, I cancelled that. Nothing was paid." }] };
  if (st.step === "category") {
    const k = detectBill(t);
    return k && k !== "ask" ? billStart(k) : { state: st, say: [{ text: "Pick one: electricity, airtime, data or cable TV.", options: KIND_OPTIONS }] };
  }
  const d: Record<string, any> = { ...st.d };
  if (st.kind === "electricity") return elecStep(st, d, t);
  if (st.kind === "cable") return cableStep(st, d, t);
  return teleStep(st, d, t);
}

export function billReceipt(st: BillState, hash0: string): string {
  const d = st.d;
  const ref = reference(JSON.stringify(d) + hash0);
  const tx = `${hash0.slice(0, 10)}…${hash0.slice(-6)}`;
  const foot = "\n──────────\nDemo biller · test money on Monad testnet · no real bill was paid";
  if (st.kind === "electricity") {
    const disco = DISCOS.find((z) => z.id === d.disco)!;
    if (d.mtype === "prepaid") {
      return `✓ Payment successful\nElectricity token (demo)\n${disco.name} · Prepaid\nMeter ${d.meter}\n${d.cust.name}\nToken ${token20(d.meter + hash0)}\nUnits ${d.units} kWh\nAmount ${fmtN(d.amount)} + ${fmtN(d.fee)} charge\nReference ${ref}\n${when()}\nOn-chain tx ${tx}${foot}`;
    }
    return `✓ Payment successful\n${disco.name} · Postpaid\nMeter ${d.meter}\n${d.cust.name}\n${fmtN(d.amount)} credited to your account\nReference ${ref}\n${when()}\nOn-chain tx ${tx}${foot}`;
  }
  if (st.kind === "airtime") {
    return `✓ Airtime sent (demo)\n${d.net} · ${d.phone}\nAmount ${fmtN(d.amount)}\nReference ${ref}\n${when()}\nOn-chain tx ${tx}${foot}`;
  }
  if (st.kind === "data") {
    return `✓ Data bundle sent (demo)\n${d.net} · ${d.phone}\n${d.plan}\nAmount ${fmtN(d.amount)}\nReference ${ref}\n${when()}\nOn-chain tx ${tx}${foot}`;
  }
  const prov = CABLE.find((z) => z.id === d.prov)!;
  return `✓ Subscription renewed (demo)\n${prov.name} ${d.pkg}\nCard ${d.card} · ${d.cust.name}\nAmount ${fmtN(d.amount)}\nActive until ${shortDate(Date.now() + 30 * 86400000)}\nReference ${ref}\n${when()}\nOn-chain tx ${tx}${foot}`;
}
