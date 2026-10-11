import { NextRequest, NextResponse } from "next/server";

type Intent =
  | { action: "setAutosave"; percent: number }
  | { action: "setDailyCap"; amount: number; currency: string }
  | { action: "setAllowance"; to: string; amount: number; currency: string }
  | { action: "send"; to: string; amount: number; currency: string }
  | { action: "fund"; amount: number; currency: string }
  | { action: "unlockSavings"; amount: number; currency: string }
  | { action: "addSubscription"; service: string; amount: number; currency: string; cycleDays?: number; startedDaysAgo?: number }
  | { action: "addReminder"; title: string; amount: number; currency: string; dueInDays?: number; repeatDays?: number }
  | { action: "discover"; category: "earn" | "predict" | "trade" }
  | { action: "balance" }
  | { action: "earn"; amount: number; currency: string }
  | { action: "stopEarn"; amount?: number; currency?: string }
  | { action: "swap"; asset: string; amount?: number; currency?: string; direction?: "buy" | "sell" }
  | { action: "payBill"; what: string; amount: number; currency: string }
  | { action: "request"; amount: number; currency: string; from?: string; note?: string }
  | { action: "split"; amount: number; currency: string; people?: number; names?: string[] }
  | { action: "predict"; side?: string; amount?: number; market?: string; currency?: string }
  | { action: "reply"; message: string; remember?: string; options?: string[] }
  | { action: "unknown"; reason: string };

const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
function detectCcy(s: string): string {
  const t = s.toLowerCase();
  if (/\$|usd|dollar/.test(t)) return "USD";
  if (/₦|ngn|naira/.test(t)) return "NGN";
  if (/£|gbp|pound/.test(t)) return "GBP";
  if (/€|eur|euro/.test(t)) return "EUR";
  if (/₵|ghs|cedi/.test(t)) return "GHS";
  if (/ksh|kes|shilling/.test(t)) return "KES";
  if (/zar|rand/.test(t)) return "ZAR";
  if (/₹|inr|rupee/.test(t)) return "INR";
  return "AUTO";
}
function num(s: string): number { const m = s.replace(/,/g, "").match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : 0; }
function resolveLang(text: string, lang: string): string {
  if (lang && lang !== "Auto") return lang;
  const t = (text || "").toLowerCase();
  if (/\b(kedu|biko|daalu|dalu|nnoo|ndewo|nwanne|maka)\b/.test(t)) return "Igbo";
  if (/\b(bawo|jowo|pele)\b/.test(t)) return "Yoruba";
  if (/\b(sannu|yaya|nawa|kudi|madalla)\b/.test(t)) return "Hausa";
  if (/\b(dey|wetin|abeg|wey|sabi|oga|wahala|comot|unu|no be|e go|make we|no wahala|you fit|i fit)\b/.test(t) || /\bhow far\b/.test(t)) return "Nigerian Pidgin";
  return "English";
}
function deDash(s: string): string { return typeof s === "string" ? s.replace(/\s*[—–]\s*/g, ", ").replace(/ {2,}/g, " ") : s; }
function extractJson(s: string): unknown {
  if (!s) return null;
  const str = s.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(str); } catch {}
  const a = str.indexOf("{"), b = str.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(str.slice(a, b + 1)); } catch {} }
  return null;
}

function rulesParse(text: string, name: string): Intent {
  const t = text.trim();
  const you = name || "there";
  if (/^\s*(hi+|hey+|hello|yo|sup|gm|good\s+(morning|afternoon|evening|day)|how\s+far|how\s+body|gbam|oya)\b/i.test(t))
    return { action: "reply", message: pick([`Hey ${you}. What are we doing with your money today, send, save, or set a rule?`, `${you}! Good to see you. Tell me what you'd like to do.`]) };
  if (/\b(stop earning|stop earn|withdraw (?:my )?earnings|take out (?:my )?earnings|cash out|unstake)\b/i.test(t)) { const a = num(t); return a > 0 ? { action: "stopEarn", amount: a, currency: detectCcy(t) } : { action: "stopEarn" }; }
  if (/\b(earn|yield|interest|invest|investing|staking|stake|apy|apr|grow my (?:money|savings)|put (?:it|my money|them) to work)\b/i.test(t) && !/\d+\s*(?:%|percent)/.test(t) && !/^(how|what|which|why|where|who|can|does|do|is|are)\b/i.test(t) && !/\?\s*$/.test(t)) {
    const earnAmt = num(t);
    if (earnAmt > 0) return { action: "earn", amount: earnAmt, currency: detectCcy(t) };
    return { action: "reply", message: "How much would you like to move into earning?", options: ["Earn ₦10,000", "Earn ₦50,000", "Earn ₦100,000", "Another amount"] };
  }
  if (/\b(predict|prediction|bet|gamble|gambling|wager|odds)\b/i.test(t) && !/^(how|what|which|why|where|who|can|does|do|is|are)\b/i.test(t) && !/\?\s*$/.test(t)) { const side = /\bno\b/i.test(t) && !/\byes\b/i.test(t) ? "no" : "yes"; return { action: "predict", side, amount: num(t), currency: detectCcy(t) }; }
  if (/\b(request|ask for|invoice|collect)\b/i.test(t) && /\d/.test(t)) { const from = t.match(/from\s+(?:my\s+)?([a-z0-9_. ]+?)(?:\s+for\b|[.,]|$)/i)?.[1]?.trim(); const note = t.match(/\bfor\s+(.+)$/i)?.[1]?.trim(); return { action: "request", amount: num(t), currency: detectCcy(t), from, note }; }
  if (/\bsplit\b/i.test(t) && /\d/.test(t)) { const ppl = Number(t.match(/(\d+)\s*(?:people|persons|ways|friends|of us)/i)?.[1] || 0) || undefined; return { action: "split", amount: num(t), currency: detectCcy(t), people: ppl }; }
  if (/\b(swap|buy|sell|trade|convert|dex|degen)\b/i.test(t) && /\b(btc|bitcoin|eth|ether|ethereum|gold|xau|cbtc|ceth|cgold)\b/i.test(t)) {
    const dir = /\b(sell|cash out|cashout|back to (?:cash|cusd|naira|spendable))\b/i.test(t) ? "sell" : "buy";
    const asset = (t.match(/\b(bitcoin|btc|ethereum|ether|eth|gold|xau|cbtc|ceth|cgold)\b/i) || [""])[0];
    return { action: "swap", asset, amount: num(t), currency: detectCcy(t), direction: dir };
  }
  let m: RegExpMatchArray | null;
  if ((m = t.match(/save\s+(\d+(?:\.\d+)?)\s*(?:%|percent)/i))) return { action: "setAutosave", percent: parseFloat(m[1]) };
  if (/unlock|break|withdraw/i.test(t) && /saving|pot/i.test(t)) return { action: "unlockSavings", amount: num(t), currency: detectCcy(t) };
  if (/(subscribe|subscription|renew|recharge)/i.test(t) && /(netflix|spotify|youtube|gotv|dstv|showmax|apple|prime|disney|x premium)/i.test(t)) {
    const svc = (t.match(/netflix|spotify|youtube|gotv|dstv|showmax|apple|prime|disney/i)?.[0] || "subscription");
    return { action: "addSubscription", service: svc.toUpperCase() === "GOTV" ? "GOtv" : svc[0].toUpperCase() + svc.slice(1), amount: num(t), currency: detectCcy(t), cycleDays: 30, startedDaysAgo: 0 };
  }
  if (/(allowance|pocket money)/i.test(t) || /give\s+.+\s+\d.+\b(?:a|per)\s+day/i.test(t)) {
    const to = t.match(/(?:to|give)\s+(?:my\s+)?([a-z0-9_. ]+?)\s+(?:[₦$£€₵₹]|\d)/i)?.[1] || t.match(/0x[a-fA-F0-9]{40}/)?.[0] || "";
    return { action: "setAllowance", to: to.trim(), amount: num(t), currency: detectCcy(t) };
  }
  if (/\b(cap|limit)\b/i.test(t) || /don'?t\s+(?:let\s+me\s+)?spend\s+more\s+than/i.test(t)) return { action: "setDailyCap", amount: num(t), currency: detectCcy(t) };
  if (/\b(airtime|data|recharge|electricity|nepa|phcn|light bill|power bill|water bill|rent|tickets?|school fees?|wifi|internet bill|fuel)\b/i.test(t) && /\b(buy|pay|top ?up|recharge|get|settle|book|for)\b/i.test(t)) {
    const what = t.match(/\b(airtime|data|electricity|nepa|phcn|light|power|water|rent|tickets?|school fees?|wifi|internet|fuel)\b/i)?.[0] || "bill";
    return { action: "payBill", what, amount: num(t), currency: detectCcy(t) };
  }
  if (/\b(send|transfer|remit|pay)\b/i.test(t)) {
    const to = t.match(/to\s+(?:my\s+)?([a-z0-9_. ]+)$/i)?.[1] || t.match(/0x[a-fA-F0-9]{40}/)?.[0] || "";
    return { action: "send", to: to.trim(), amount: num(t), currency: detectCcy(t) };
  }
  if (/\b(add|top\s*up|fund|load|mint|deposit)\b/i.test(t)) return { action: "fund", amount: num(t), currency: detectCcy(t) };
  if (/\b(balance|how much (?:do|have|'?ve) i|how much i get|wetin i get|what(?:'?s| is) my (?:balance|money)|how much money)\b/i.test(t) && !/unlock|break|withdraw|send|pay|cap|limit|sub/i.test(t)) return { action: "balance" };
  if (/\bremind\b|reminder|don'?t let me forget/i.test(t)) return { action: "addReminder", title: (t.replace(/.*remind me (to |about )?/i, "").trim().slice(0, 40) || "Reminder"), amount: num(t), currency: detectCcy(t), dueInDays: 7, repeatDays: /\b(every|monthly|weekly|each month|each week)\b/i.test(t) ? (/week/i.test(t) ? 7 : 30) : 0 };
  if (/(netflix|spotify|youtube|gotv|dstv|showmax|apple|prime|disney)/i.test(t) && /(pay|sub|subscribe|run|renew|recharge|plan|option|list)/i.test(t) && !/\d/.test(t)) {
    const svc = t.match(/netflix|spotify|youtube|gotv|dstv|showmax|apple|prime|disney/i)![0];
    return { action: "reply", message: `How much is your ${svc[0].toUpperCase() + svc.slice(1)}? Tap one, or type the amount.`, options: ["₦2,200", "₦4,400", "₦7,000", "Another amount"] };
  }
  return { action: "reply", message: pick([`I'm not sure I caught that, ${you}. I can send money, save a percentage, set an allowance or a daily cap, add money, or track a subscription, what would you like?`, `Hmm, I didn't quite get that. Try "send 5,000 to my friend" or "remind me about my Netflix".`]) };
}

const SYS = `You are Cowrie, a warm, concise money companion for everyday people (the user's name is "{{name}}"). Never sound robotic; vary your wording; use their name sometimes. If the user is ASKING a question (it begins with how, what, which, why, where, who, can, does, is or are, or ends with a question mark), ANSWER it with the reply action, never fire an action like earn, swap or payBill off a question. You run on the Monad blockchain and move a USD-pegged stablecoin shown in the user's local currency.
You HAVE memory: the recent conversation is included as prior messages, plus saved facts and the user's subscriptions below. If the user says "I told you before" or references earlier chat, use that history. Output ONLY JSON, exactly one action, no markdown:
{"action":"setAutosave","percent":number}
{"action":"setDailyCap","amount":number,"currency":CODE}
{"action":"setAllowance","to":string,"amount":number,"currency":CODE}
{"action":"send","to":string,"amount":number,"currency":CODE}
{"action":"fund","amount":number,"currency":CODE}
{"action":"unlockSavings","amount":number,"currency":CODE}
{"action":"addSubscription","service":string,"amount":number,"currency":CODE,"cycleDays":number,"startedDaysAgo":number}
{"action":"addReminder","title":string,"amount":number,"currency":CODE,"dueInDays":number,"repeatDays":number}
{"action":"discover","category":"earn"|"predict"|"trade"}
{"action":"balance"}
{"action":"earn","amount":number,"currency":CODE}
{"action":"stopEarn","amount":number,"currency":CODE}
{"action":"swap","asset":string,"amount":number,"currency":CODE,"direction":"buy"|"sell"}
{"action":"payBill","what":string,"amount":number,"currency":CODE}
{"action":"request","amount":number,"currency":CODE,"from":string,"note":string}
{"action":"split","amount":number,"currency":CODE,"people":number,"names":string[]}
{"action":"predict","side":"yes"|"no","amount":number,"market":string}
{"action":"reply","message":string,"remember":string,"options":string[]}
CODE is NGN,USD,GHS,KES,ZAR,GBP,EUR,INR, or "AUTO". For a subscription (Netflix, GOtv, DStv, Spotify, YouTube, Apple, Prime, Disney, X): cycleDays 30=monthly,7=weekly,365=yearly; startedDaysAgo from phrases like "3 weeks ago"=21, else 0; amount if stated else 0. For any other "remind me to..." (a bill, rent, airtime, a task): use addReminder with dueInDays until it's due and repeatDays 0 for one-time, 7 weekly, 30 monthly; amount only if money is involved. For anything conversational use "reply"; put a durable fact worth keeping (a slang meaning, a preference, who someone is) in "remember", else omit it. You can: send money (blocking flagged scam addresses), auto-save a %, set allowances and daily caps, add funds, grow their money in a savings vault that earns yield, buy and sell tokens, pay everyday things like airtime, data, electricity, cable TV, rent and event tickets, track subscriptions, request money from someone, split a bill with friends, and set reminders. You are a real wallet that DOES these things, and everything happens INSIDE the app with no links out: never tell the user you cannot make an everyday payment (use payBill), and never send them to an outside website or app. To grow or earn on the user's OWN balance inside Cowrie (earn, yield, interest, stake, invest, grow savings), use earn with the amount if they gave one: money moves from their spendable into Cowrie's own savings vault at a fixed 10% a year and keeps growing, and they can withdraw anytime with stopEarn (include an amount in stopEarn to take out part, omit it to take out everything). If they gave no amount, use reply to ask how much and offer a few tappable amount options. For an in-app swap use swap: direction "buy" moves spendable cUSD into an asset (amount is the cUSD to spend), direction "sell" moves an asset back to cUSD (amount is the cUSD value to sell, or omit to sell all); asset is the token the user named (bitcoin, cBTC, eth, gold, and so on). Only tokens with a pool can be traded, and if unsure still return swap, the app will say what is tradable. Prediction markets live right inside Cowrie: to place a bet use predict with side ("yes" or "no"), the amount, and market set to a few words of the question when the user names one. If they ask to bet but give no side or amount, point them to the Predict section in Activity. Never send them to an outside website or app. Everything Cowrie does stays inside the app. Cowrie's Earn and swap run on Cowrie's OWN on-chain contracts (its savings vault and its own cUSD/token pools on Monad), not a third-party dApp. If the user asks which app, dApp or protocol powers a DeFi action, tell them plainly it is Cowrie's own on-chain vault or pool and they can view it on the Monad explorer; never claim it routes through Aave, Kintsu or any outside protocol. For everyday spending, airtime, data, electricity or other utility bills, cable TV, rent, event or concert tickets, school fees, or paying a vendor, use payBill with "what" set to the item (for example "airtime" or "concert ticket") and the amount; Cowrie pays it on-chain from the user's balance, scam-checked and within their daily cap. If they didn't give an amount, use reply to ask how much. Cowrie cannot literally deliver a physical ticket or a SIM top-up, but it CAN make the payment, so offer to pay rather than refusing. For airtime or data, first ask which network (MTN, Glo, Airtel or 9mobile) and the phone number, then the amount, and include them in "what" (for example "MTN airtime to 08012345678"). For an event or concert ticket, ask which event and which ticket type and include them in "what" (for example "Asake concert, VIP"). Cowrie has no live web access, so never invent real events, prices or listings, ask the user for the details. To request money, use request with the amount (plus from and note if given). To split a bill, use split with the amount and the number of people, or their names. Both are handled inside Cowrie. If the user asks how much they have, their balance, savings or gas, reply with {"action":"balance"} and nothing else, the app fills in the exact live figures, so never state a money amount or balance from your own guess. Keep "options" rare: only add 2 to 4 short tappable chips when the user must pick a concrete value or confirm a specific action and tapping one would finish the job, for example a subscription price (["₦2,200","₦4,400","₦7,000","Another amount"]). Never put options on greetings, explanations, or answers about what you can do, leave "options" out entirely then. When unsure, omit it.`;

async function llmParse(text: string, name: string, lang: string, history: { role: string; content: string }[], ctx: string): Promise<Intent | null> {
  const key = process.env.LLM_API_KEY;
  if (!key) return null;
  const base = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const target = resolveLang(text, lang);
  const langLine = ` HARD LANGUAGE RULE: write your ENTIRE reply text in ${target} only. Do not use any other language, and never mix two languages in one reply. ${target === "English" ? "Use plain, clear English, with no Pidgin words." : `Write it the natural way a ${target} speaker really talks.`} The JSON keys and action names stay exactly as given.`;
  const messages = [{ role: "system", content: SYS.replace("{{name}}", name) + langLine + ctx }, ...history, { role: "user", content: text }];
  const body = JSON.stringify({ model, temperature: 0.5, max_tokens: 600, messages });
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    try {
      const r = await fetch(`${base}/chat/completions`, { method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body });
      if (r.status === 429 || r.status >= 500) { console.warn("[cowrie] AI busy", r.status, "retry", attempt + 1); clearTimeout(timer); await new Promise((s) => setTimeout(s, 500 * (attempt + 1))); continue; }
      if (!r.ok) { try { console.warn("[cowrie] AI call failed:", r.status, (await r.text()).slice(0, 180)); } catch {} clearTimeout(timer); return null; }
      const j = await r.json();
      clearTimeout(timer);
      return extractJson(j?.choices?.[0]?.message?.content) as Intent | null;
    } catch (e) { clearTimeout(timer); console.warn("[cowrie] AI error:", (e as Error)?.message); await new Promise((s) => setTimeout(s, 400)); }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { text, name, lang, history, facts, subs, bal } = await req.json().catch(() => ({ text: "" }));
  if (!text || typeof text !== "string") return NextResponse.json({ ok: false, error: "no text" }, { status: 400 });
  const nm = typeof name === "string" && name ? name : "there";
  const lg = typeof lang === "string" && lang ? lang : "Auto";
  const hist = Array.isArray(history) ? history.filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant")).slice(-10) : [];
  const ctx = ` The user's CURRENT live balances (authoritative, never contradict these): ${typeof bal === "string" && bal ? bal : "unknown"}. Saved facts about the user: ${Array.isArray(facts) && facts.length ? facts.join("; ") : "none yet"}. Their subscriptions: ${typeof subs === "string" && subs ? subs : "none yet"}.`;
  const llm = await llmParse(text, nm, lg, hist, ctx);
  const intent = llm && (llm as { action?: string }).action ? llm : rulesParse(text, nm);
  const io = intent as { message?: string; reply?: string; reason?: string };
  if (io.message) io.message = deDash(io.message);
  if (io.reply) io.reply = deDash(io.reply);
  if (io.reason) io.reason = deDash(io.reason);
  return NextResponse.json({ ok: true, intent, source: llm ? "llm" : "rules" });
}
