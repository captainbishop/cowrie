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
function pickBy<T>(t: string, list: T[], keys: (x: T) => string[]): T | undefined {
  const s = t.toLowerCase().trim();
  return list.find((x) => keys(x).some((k) => k && (s.includes(k.toLowerCase()) || (s.length >= 3 && k.toLowerCase().includes(s)))));
}
export function parseAmount(t: string): number {
  const m = t.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(k|m)?/i);
  if (!m) return 0;
  let n = parseFloat(m[1]);
  const u = (m[2] || "").toLowerCase();
  if (u === "k") n *= 1000; else if (u === "m") n *= 1000000;
  return Math.round(n);
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
const BAND_TARIFF: Record<string, number> = { A: 209.5, B: 63, C: 50, D: 32, E: 28 }; // demo tariffs, naira per kWh

const NETWORKS = [
  { name: "MTN", keys: ["mtn"] },
  { name: "Airtel", keys: ["airtel"] },
  { name: "Glo", keys: ["glo", "globacom"] },
  { name: "9mobile", keys: ["9mobile", "9 mobile", "etisalat"] },
];
const DATA_PLANS = [
  { name: "500MB · 7 days", price: 500 },
  { name: "1.5GB · 30 days", price: 1000 },
  { name: "3GB · 30 days", price: 1500 },
  { name: "6GB · 30 days", price: 2500 },
  { name: "12GB · 30 days", price: 4000 },
  { name: "25GB · 30 days", price: 7000 },
];
const planLabel = (p: { name: string; price: number }) => `${p.name} · ${fmtN(p.price)}`;

const CABLE = [
  { id: "dstv", name: "DStv", keys: ["dstv"], pkgs: [{ name: "Padi", price: 3600 }, { name: "Yanga", price: 5100 }, { name: "Confam", price: 9300 }, { name: "Compact", price: 15700 }, { name: "Compact Plus", price: 25000 }, { name: "Premium", price: 44500 }] },
  { id: "gotv", name: "GOtv", keys: ["gotv"], pkgs: [{ name: "Smallie", price: 1900 }, { name: "Jinja", price: 3900 }, { name: "Jolli", price: 5800 }, { name: "Max", price: 8500 }, { name: "Supa", price: 11400 }] },
  { id: "startimes", name: "StarTimes", keys: ["startimes", "star times"], pkgs: [{ name: "Nova", price: 1900 }, { name: "Basic", price: 3700 }, { name: "Smart", price: 5100 }, { name: "Classic", price: 6500 }, { name: "Super", price: 11000 }] },
];
const pkgLabel = (p: { name: string; price: number }) => `${p.name} · ${fmtN(p.price)}`;

const FIRST = ["Adebayo", "Chioma", "Ibrahim", "Ngozi", "Emeka", "Fatima", "Tunde", "Amaka", "Yusuf", "Blessing", "Segun", "Zainab", "Chinedu", "Bisi", "Musa", "Ada"];
const LAST = ["Okafor", "Adeyemi", "Bello", "Eze", "Balogun", "Ogunleye", "Danjuma", "Nwosu", "Abubakar", "Afolabi", "Obi", "Lawal", "Okonkwo", "Salami", "Umar", "Ojo"];
const STREETS = ["Ogunlana Drive", "Allen Avenue", "Church Street", "Unity Road", "Station Road", "Adeola Odeku Street", "Market Road", "Peace Avenue"];
function demoCustomer(seed: string, areas: string[]) {
  const r = rng(hash(seed));
  return {
    name: `${pickOf(FIRST, r)} ${pickOf(LAST, r)}`.toUpperCase(),
    address: `${1 + Math.floor(r() * 60)} ${pickOf(STREETS, r)}, ${pickOf(areas, r)}`,
    band: pickOf(["A", "B", "B", "C", "C", "D", "E"], r),
    outstanding: Math.round((2000 + r() * 28000) / 50) * 50,
  };
}

// ---------- the flows ----------

const CANCEL = /^\s*(cancel|stop|exit|abort|nope|no|not now|nvm|never ?mind|leave it|forget it|abeg leave am)\b/i;
const KIND_OPTIONS = ["Electricity", "Airtime", "Data", "Cable TV"];

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
  if (kind === "ask") {
    return { state: { kind: "electricity", step: "category", d: {} }, say: [{ text: "What would you like to pay for?", options: KIND_OPTIONS }] };
  }
  if (kind === "electricity") return { state: { kind, step: "disco", d: {} }, say: [{ text: "Let's buy electricity. Which company (DISCO) supplies your meter?", options: DISCOS.map(discoLabel) }] };
  if (kind === "airtime") return { state: { kind, step: "net", d: {} }, say: [{ text: "Let's buy airtime. Which network?", options: NETWORKS.map((z) => z.name) }] };
  if (kind === "data") return { state: { kind, step: "net", d: {} }, say: [{ text: "Let's buy data. Which network?", options: NETWORKS.map((z) => z.name) }] };
  return { state: { kind, step: "prov", d: {} }, say: [{ text: "Let's renew your TV subscription. Which provider?", options: CABLE.map((z) => z.name) }] };
}

function payTitle(st: BillState): string {
  const d = st.d;
  if (st.kind === "electricity") return `Electricity · ${DISCOS.find((z) => z.id === d.disco)?.short || ""}`;
  if (st.kind === "airtime") return `${d.net} airtime`;
  if (st.kind === "data") return `${d.net} data`;
  return `${CABLE.find((z) => z.id === d.prov)?.name || "TV"} ${d.pkg || ""}`.trim();
}

export function billNext(st: BillState, raw: string): BillOut {
  const t = raw.trim();
  if (CANCEL.test(t)) return { state: null, say: [{ text: "Okay, I cancelled that. Nothing was paid." }] };
  if (st.step === "category") {
    const k = detectBill(t);
    return k && k !== "ask" ? billStart(k) : { state: st, say: [{ text: "Pick one: electricity, airtime, data or cable TV.", options: KIND_OPTIONS }] };
  }
  const d: Record<string, any> = { ...st.d };
  const again = (text: string, options?: string[]): BillOut => ({ state: st, say: [{ text, options }] });
  const go = (step: string, say: BillSay[], extra?: Partial<BillOut>): BillOut => ({ state: { ...st, step, d }, say, ...extra });
  const confirmStep = (): BillOut => {
    if (/^(pay|yes|confirm|ok|okay|proceed|go|do it|sure)\b/i.test(t)) {
      return { state: { ...st, step: "paying" }, say: [], pay: { naira: d.total, title: payTitle(st), desc: `Demo biller, test money: ${fmtN(d.total)}` } };
    }
    return again('Say "pay" to continue or "cancel" to stop.', [`Pay ${fmtN(d.total)}`, "Cancel"]);
  };

  if (st.kind === "electricity") {
    switch (st.step) {
      case "disco": {
        const x = pickBy(t, DISCOS, (z) => [discoLabel(z), z.short, z.name, z.word]);
        if (!x) return again("I did not recognise that company. Which one supplies your meter?", DISCOS.map(discoLabel));
        d.disco = x.id;
        return go("mtype", [{ text: `${x.name}. Is your meter prepaid or postpaid?`, options: ["Prepaid", "Postpaid"] }]);
      }
      case "mtype": {
        const post = /post/i.test(t), pre = /pre/i.test(t);
        if (!post && !pre) return again("Is your meter prepaid or postpaid?", ["Prepaid", "Postpaid"]);
        d.mtype = post ? "postpaid" : "prepaid";
        return go("meter", [{ text: `Please send your ${d.mtype} meter number, the 11 digits printed on your meter.` }]);
      }
      case "meter": {
        const digits = t.replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 13) return again("A meter number has 10 to 13 digits. Please check it and send it again.");
        const disco = DISCOS.find((z) => z.id === d.disco)!;
        const cu = demoCustomer(disco.id + digits, disco.areas);
        d.meter = digits;
        d.cust = cu;
        const info = `Meter verified (demo lookup)\n${cu.name}\n${cu.address}\n${d.mtype === "prepaid" ? "Prepaid" : "Postpaid"} · Tariff band ${cu.band}`;
        const ask: BillSay = d.mtype === "postpaid"
          ? { text: `Outstanding bill: ${fmtN(cu.outstanding)}. How much do you want to pay?`, options: [`Pay ${fmtN(cu.outstanding)}`, "Other amount"] }
          : { text: "How much electricity do you want to buy? The minimum is ₦1,000.", options: ["₦2,000", "₦5,000", "₦10,000", "₦20,000"] };
        return go("eamount", [{ text: `Checking meter ${digits} with ${disco.name}...` }], { later: [{ text: info, tone: "good" }, ask], delayMs: 1200 });
      }
      case "eamount": {
        if (/other/i.test(t) && !/\d/.test(t)) return again("Type the amount you want to pay.");
        const amt = parseAmount(t);
        const min = d.mtype === "prepaid" ? 1000 : 500;
        if (!amt) return again("How much do you want to pay? For example 5000.");
        if (amt < min) return again(`The minimum is ${fmtN(min)}. Please send a higher amount.`);
        if (amt > 200000) return again("The maximum for one payment is ₦200,000. Please send a smaller amount.");
        const disco = DISCOS.find((z) => z.id === d.disco)!;
        d.amount = amt; d.fee = 100; d.total = amt + 100;
        if (d.mtype === "prepaid") d.units = Math.round((amt / BAND_TARIFF[d.cust.band]) * 100) / 100;
        const sum = `Please confirm\n${disco.name} · ${d.mtype}\nMeter ${d.meter} · ${d.cust.name}\nAmount ${fmtN(amt)}\nService charge ${fmtN(100)}\nTotal ${fmtN(d.total)}` +
          (d.mtype === "prepaid" ? `\nYou will get about ${d.units} kWh at the demo band ${d.cust.band} tariff` : "");
        return go("confirm", [{ text: sum, options: [`Pay ${fmtN(d.total)}`, "Cancel"] }]);
      }
      case "confirm": return confirmStep();
    }
  }

  if (st.kind === "airtime" || st.kind === "data") {
    switch (st.step) {
      case "net": {
        const n = pickBy(t, NETWORKS, (z) => [z.name, ...z.keys]);
        if (!n) return again("Which network?", NETWORKS.map((z) => z.name));
        d.net = n.name;
        return go("phone", [{ text: `${n.name}. Which phone number should get the ${st.kind === "data" ? "data" : "airtime"}? Send the 11-digit number.` }]);
      }
      case "phone": {
        const p = t.replace(/[\s-]/g, "").replace(/^\+?234/, "0");
        if (!/^0[789]\d{9}$/.test(p)) return again("That does not look like a Nigerian mobile number. It should be 11 digits, like 08031234567.");
        d.phone = p;
        if (st.kind === "airtime") return go("aamount", [{ text: `Sending to ${p} on ${d.net}. How much airtime?`, options: ["₦100", "₦200", "₦500", "₦1,000"] }]);
        return go("plan", [{ text: `Data bundles for ${p} on ${d.net} (demo plans). Choose one:`, options: DATA_PLANS.map(planLabel) }]);
      }
      case "aamount": {
        const amt = parseAmount(t);
        if (!amt) return again("How much airtime? For example 500.");
        if (amt < 50) return again("The minimum airtime is ₦50.");
        if (amt > 50000) return again("The maximum airtime in one go is ₦50,000.");
        d.amount = amt; d.total = amt;
        return go("confirm", [{ text: `Please confirm\n${d.net} airtime\nTo ${d.phone}\nAmount ${fmtN(amt)}`, options: [`Pay ${fmtN(amt)}`, "Cancel"] }]);
      }
      case "plan": {
        const p = pickBy(t, DATA_PLANS, (z) => [planLabel(z), z.name]);
        if (!p) return again("Which data plan?", DATA_PLANS.map(planLabel));
        d.plan = p.name; d.amount = p.price; d.total = p.price;
        return go("confirm", [{ text: `Please confirm\n${d.net} data · ${p.name}\nTo ${d.phone}\nPrice ${fmtN(p.price)}`, options: [`Pay ${fmtN(p.price)}`, "Cancel"] }]);
      }
      case "confirm": return confirmStep();
    }
  }

  if (st.kind === "cable") {
    switch (st.step) {
      case "prov": {
        const p = pickBy(t, CABLE, (z) => [z.name, ...z.keys]);
        if (!p) return again("Which TV provider?", CABLE.map((z) => z.name));
        d.prov = p.id;
        return go("card", [{ text: `${p.name}. Please send your smartcard or IUC number, 10 digits.` }]);
      }
      case "card": {
        const digits = t.replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 11) return again("A smartcard number has 10 digits. Please check it and send it again.");
        const prov = CABLE.find((z) => z.id === d.prov)!;
        const r = rng(hash(prov.id + digits));
        const cu = demoCustomer(prov.id + digits, ["Lagos", "Abuja", "Ibadan", "Port Harcourt", "Kano", "Enugu", "Benin"]);
        const cur = pickOf(prov.pkgs, r);
        d.card = digits; d.cust = cu; d.current = cur.name;
        const due = shortDate(Date.now() - Math.floor(r() * 5) * 86400000);
        return go("pkg", [{ text: `Checking ${prov.name} card ${digits}...` }], {
          later: [{ text: `Card verified (demo lookup)\n${cu.name}\nCurrent package: ${cur.name}\nDue ${due}`, tone: "good" }, { text: "Which package do you want to pay for? These are demo prices.", options: prov.pkgs.map(pkgLabel) }],
          delayMs: 1100,
        });
      }
      case "pkg": {
        const prov = CABLE.find((z) => z.id === d.prov)!;
        const p = pickBy(t, prov.pkgs, (z) => [pkgLabel(z), z.name]);
        if (!p) return again("Which package?", prov.pkgs.map(pkgLabel));
        d.pkg = p.name; d.amount = p.price; d.total = p.price;
        return go("confirm", [{ text: `Please confirm\n${prov.name} ${p.name}\nCard ${d.card} · ${d.cust.name}\nPrice ${fmtN(p.price)}`, options: [`Pay ${fmtN(p.price)}`, "Cancel"] }]);
      }
      case "confirm": return confirmStep();
    }
  }
  return { state: null, say: [{ text: "Something went wrong with that bill, and nothing was paid. Say what you would like to pay and we will start again." }] };
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
