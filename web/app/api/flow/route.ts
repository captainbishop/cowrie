import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const SYS = `You are Cowrie, a warm and concise wallet assistant, in the middle of a guided bill payment (electricity, airtime, data or cable TV). A rule-based flow asks questions one at a time. You are called only when the user wrote something the flow could not read. Reply with ONE JSON object and nothing else.

FACTS YOU MUST RESPECT
- The customer name, address, current package and tariff shown in the flow come from a DEMO lookup that makes them up from the number typed. No real biller is contacted, so these details can never match a real account, and retyping the same number shows the same demo name. If the user doubts the name or asks to recheck it, say that plainly and offer to try a different number or continue.
- Nothing is paid until the user confirms on the summary. Never say anything was paid, sent or bought.
- Never invent account details, prices or tokens.

CHOOSE ONE
{"op":"answer","text":"..."} the user is answering the current question in their own words. Put the clean answer the flow expects: digits only for a meter, phone or card number, a plain amount like 5000, a company, network, plan, package or provider name, "prepaid" or "postpaid". Use "pay" only if the user clearly agrees to pay in this very message.
{"op":"redo","what":"meter|company|amount|type|network|number|plan|card|provider|package"} they want to correct an earlier answer.
{"op":"say","text":"..."} they ask a question, doubt something, complain or chat. Answer in one or two short sentences in their own style (plain English or Nigerian Pidgin, matching them), honestly, then invite them to continue.
{"op":"cancel"} they want to stop.`;

async function ask(base: string, key: string, model: string, messages: unknown[]): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(`${base.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, temperature: 0.3, max_tokens: 260, messages }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function pickJson(s: string | null): { op?: string; text?: string; what?: string } | null {
  if (!s) return null;
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b < a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.slice(0, 300) : "";
  if (!text || !body?.flow) return NextResponse.json({ ok: false }, { status: 400 });
  const nm = typeof body?.name === "string" ? body.name.slice(0, 30) : "there";
  const lang = typeof body?.lang === "string" && body.lang !== "Auto" ? ` Write any reply in ${body.lang}.` : "";
  const messages = [
    { role: "system", content: `${SYS}\nThe user's name is ${nm}.${lang}` },
    { role: "user", content: `FLOW STATE: ${JSON.stringify(body.flow).slice(0, 1500)}\nUSER SAID: ${text}` },
  ];
  const tries: [string | undefined, string | undefined, string | undefined][] = [
    [process.env.LLM_BASE_URL, process.env.LLM_API_KEY, process.env.LLM_MODEL || "gpt-4o-mini"],
    [process.env.LLM2_BASE_URL, process.env.LLM2_API_KEY, process.env.LLM2_MODEL],
  ];
  for (const [base, key, model] of tries) {
    if (!base || !key || !model) continue;
    const out = pickJson(await ask(base, key, model, messages));
    if (out && ["answer", "say", "redo", "cancel"].includes(String(out.op))) {
      const clean = (v: unknown) => String(v ?? "").replace(/\s*[—–]\s*/g, ", ").slice(0, 600);
      return NextResponse.json({ ok: true, op: out.op, text: clean(out.text), what: String(out.what ?? "") });
    }
  }
  return NextResponse.json({ ok: false });
}
