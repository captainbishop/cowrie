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
  if (/\b(send|transfer|remit|pay)\b/i.test(t)) {
    const to = t.match(/to\s+(?:my\s+)?([a-z0-9_. ]+)$/i)?.[1] || t.match(/0x[a-fA-F0-9]{40}/)?.[0] || "";
    return { action: "send", to: to.trim(), amount: num(t), currency: detectCcy(t) };
  }
  if (/\b(add|top\s*up|fund|load|mint|deposit)\b/i.test(t)) return { action: "fund", amount: num(t), currency: detectCcy(t) };
  if (/\bremind\b|reminder|don'?t let me forget/i.test(t)) return { action: "addReminder", title: (t.replace(/.*remind me (to |about )?/i, "").trim().slice(0, 40) || "Reminder"), amount: num(t), currency: detectCcy(t), dueInDays: 7, repeatDays: /\b(every|monthly|weekly|each month|each week)\b/i.test(t) ? (/week/i.test(t) ? 7 : 30) : 0 };
  if (/(netflix|spotify|youtube|gotv|dstv|showmax|apple|prime|disney)/i.test(t) && /(pay|sub|subscribe|run|renew|recharge|plan|option|list)/i.test(t) && !/\d/.test(t)) {
    const svc = t.match(/netflix|spotify|youtube|gotv|dstv|showmax|apple|prime|disney/i)![0];
    return { action: "reply", message: `How much is your ${svc[0].toUpperCase() + svc.slice(1)}? Tap one, or type the amount.`, options: ["₦2,200", "₦4,400", "₦7,000", "Another amount"] };
  }
  return { action: "reply", message: pick([`I'm not sure I caught that, ${you}. I can send money, save a percentage, set an allowance or a daily cap, add money, or track a subscription, what would you like?`, `Hmm, I didn't quite get that. Try "send 5,000 to my friend" or "remind me about my Netflix".`]) };
}

const SYS = `You are Cowrie, a warm, concise money companion for everyday people (the user's name is "{{name}}"). Never sound robotic; vary your wording; use their name sometimes. You run on the Monad blockchain and move a USD-pegged stablecoin shown in the user's local currency.
You HAVE memory: the recent conversation is included as prior messages, plus saved facts and the user's subscriptions below. If the user says "I told you before" or references earlier chat, use that history. Output ONLY JSON, exactly one action, no markdown:
{"action":"setAutosave","percent":number}
{"action":"setDailyCap","amount":number,"currency":CODE}
{"action":"setAllowance","to":string,"amount":number,"currency":CODE}
{"action":"send","to":string,"amount":number,"currency":CODE}
{"action":"fund","amount":number,"currency":CODE}
{"action":"unlockSavings","amount":number,"currency":CODE}
{"action":"addSubscription","service":string,"amount":number,"currency":CODE,"cycleDays":number,"startedDaysAgo":number}
{"action":"addReminder","title":string,"amount":number,"currency":CODE,"dueInDays":number,"repeatDays":number}
{"action":"reply","message":string,"remember":string,"options":string[]}
CODE is NGN,USD,GHS,KES,ZAR,GBP,EUR,INR, or "AUTO". For a subscription (Netflix, GOtv, DStv, Spotify, YouTube, Apple, Prime, Disney, X): cycleDays 30=monthly,7=weekly,365=yearly; startedDaysAgo from phrases like "3 weeks ago"=21, else 0; amount if stated else 0. For any other "remind me to..." (a bill, rent, airtime, a task): use addReminder with dueInDays until it's due and repeatDays 0 for one-time, 7 weekly, 30 monthly; amount only if money is involved. For anything conversational use "reply"; put a durable fact worth keeping (a slang meaning, a preference, who someone is) in "remember", else omit it. You can: send money (blocking flagged scam addresses), auto-save a %, set allowances and daily caps, add funds, track subscriptions, and set reminders for bills and tasks. When a specific amount or choice would help the user (a subscription price, a yes/no, which person to pay), include 2 to 4 short tappable options in "options" so they can select instead of typing (e.g. asking a Netflix price, options ["₦2,200","₦4,400","₦7,000","Another amount"]). Prefer offering options over asking an open question.`;

async function llmParse(text: string, name: string, lang: string, history: { role: string; content: string }[], ctx: string): Promise<Intent | null> {
  const key = process.env.LLM_API_KEY;
  if (!key) return null;
  const base = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const langLine = lang && lang !== "Auto" ? ` Always write your reply text in ${lang}.` : " Reply in the same language or dialect the user wrote in (including Nigerian Pidgin).";
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
  const { text, name, lang, history, facts, subs } = await req.json().catch(() => ({ text: "" }));
  if (!text || typeof text !== "string") return NextResponse.json({ ok: false, error: "no text" }, { status: 400 });
  const nm = typeof name === "string" && name ? name : "there";
  const lg = typeof lang === "string" && lang ? lang : "Auto";
  const hist = Array.isArray(history) ? history.filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant")).slice(-10) : [];
  const ctx = ` Saved facts about the user: ${Array.isArray(facts) && facts.length ? facts.join("; ") : "none yet"}. Their subscriptions: ${typeof subs === "string" && subs ? subs : "none yet"}.`;
  const llm = await llmParse(text, nm, lg, hist, ctx);
  const intent = llm && (llm as { action?: string }).action ? llm : rulesParse(text, nm);
  return NextResponse.json({ ok: true, intent, source: llm ? "llm" : "rules" });
}
