import { getAjoState, type Circle } from "./ajoStore";

export type AjoStep = { kind: "pay" | "join" | "settle" | "withdraw" | "move" | "backup"; id?: number };
export type AjoPlan = { type: "status"; name?: string } | { type: "do"; kinds: AjoStep["kind"][]; name?: string };

/** Money set aside in the wallet for auto-pay. It must not be swept back into spendable. */
export function reserveOf(circles: Circle[]): bigint {
  let r = 0n;
  for (const c of circles) {
    if (!c.isMember || !c.autopayOn || c.status > 2) continue;
    const left = c.status === 2 ? Math.max(0, c.members.length - c.round + 1 - (c.paidNow ? 1 : 0)) : c.maxMembers;
    r += c.contribution * BigInt(left);
  }
  return r;
}
export function movableOf(circles: Circle[], bal: bigint): bigint {
  const r = reserveOf(circles);
  return bal > r ? bal - r : 0n;
}

const CUE = /\b(aj+o+|esusu|isusu|susu|adashe|thrift|circle|pot|payout|winnings?|deposits?|round|share|contribution|withdrawals?)\b/;
const OTHER = /\b(earn|earning|savings?|vault|yield|predict|bet|stake|swap|buy|sell|bill|airtime|data|electricity|dstv|gotv|startimes|allowance|cap|guardian)\b/;
const ORDER: AjoStep["kind"][] = ["pay", "join", "settle", "withdraw", "move"];

/**
 * Reads a chat message about an ajo and returns what the user wants, using their live circles.
 * The AI is never asked to act on money: this is checked first, and the app asks for one confirmation.
 */
function parseCore(text: string): AjoPlan | null {
  const t = text.toLowerCase();
  if (/0x[a-f0-9]{8,}/.test(t)) return null;
  // Let the conversational parser distinguish a walkthrough from a wallet action.
  if (/\b(demo|video|walkthrough)\b/.test(t)) return null;
  const st = getAjoState();
  const nowSec = Math.floor(Date.now() / 1000);
  const mine = st.circles.filter((c) => c.isMember);
  const cue = CUE.test(t);
  const other = OTHER.test(t);
  const hasNum = /\d/.test(t);
  const dueAny = mine.some((c) => c.status === 2 && !c.paidNow && c.roundEndsAt > nowSec);
  const withdrawAny = mine.some((c) => c.status >= 3 && c.myDeposit > 0n);
  const joinAny = st.circles.some((c) => !c.isMember && c.status === 0);
  const movableNow = movableOf(st.circles, st.bal) > 0n;
  const name = st.circles.find((c) => c.name && t.includes(c.name.toLowerCase()))?.name;
  const question = /\?\s*$/.test(t) || /^(do|did|does|is|are|was|were|have|has|what|how much|how many|any|which|where|when|why)\b/.test(t);
  const learning = /\b(how (does|do|is an?|are)|what (is|are|does)|explain|meaning|tell me about)\b/.test(t) && !/\bmy\b/.test(t);
  const hot = Date.now() - topicAt < 240000;
  const verb = /\b(pay|contribute|join|withdraw|refund|collect|claim|move|transfer|take out|get back)\b/.test(t);
  if (learning) return null;
  if (question && t.length < 90 && !other && !hasNum && !verb && (cue || hot) && (cue || /\b(deposits?|pots?|payouts?|winnings?|withdrawals?|pending|waiting|locked|stuck|owe|anything|there|that|only|else)\b/.test(t))) return { type: "status", name };
  const want = new Set<AjoStep["kind"]>();

  if (/\b(collect|claim)\b|\btake (my|the) (pot|payout|winnings?)\b/.test(t) && !hasNum && !/\bfrom\b/.test(t) && (cue || !other)) { want.add("settle"); want.add("move"); }
  if (/\b(withdraw|refund|get back|take out|release)\b/.test(t) && (cue || withdrawAny) && !(other && !/\b(deposit|aj+o+|circle|pot|esusu|thrift)\b/.test(t))) want.add("withdraw");
  if (/\b(move|transfer|bring|put)\b/.test(t) && /\b(spendable|balance|wallet|pot|winnings?|payout|ajo money|deposit)\b/.test(t) && !hasNum && (cue || movableNow) && !other) want.add("move");
  if (/\b(pay|contribute)\b/.test(t) && (/\b(share|aj+o+|circle|round|contribution|thrift|esusu)\b/.test(t) || (dueAny && /^\s*(pay|contribute)( now| it| mine| my own| for me)?\s*[.!?]*\s*$/.test(t)))) want.add("pay");
  if (/\bjoin\b/.test(t) && (/\b(aj+o+|circle|thrift|esusu)\b/.test(t) || (joinAny && !other))) want.add("join");

  if (want.size === 0) {
    if (/\b(status|how'?s|how is|how far|progress|whose turn|who'?s next|when do i|did i (pay|collect)|any news)\b/.test(t) && /\b(aj+o+|circle|round|pot|payout|esusu|thrift)\b/.test(t)) return { type: "status", name };
    if (/^\s*(my )?aj+o+( status)?\s*[?.!]*\s*$/.test(t)) return { type: "status", name };
    if (hot && cue && !other && !hasNum && !verb && t.length < 70) return { type: "status", name };
    return null;
  }
  return { type: "do", kinds: ORDER.filter((k) => want.has(k)), name };
}

let topicAt = 0;

/** Reads a chat message about an ajo. Remembers that ajo is the topic, so a short follow-up still means ajo. */
export function parseAjoText(text: string): AjoPlan | null {
  const p = parseCore(text);
  if (p) topicAt = Date.now();
  return p;
}

/** A plain-language summary of the user's circles and Ajo money, handed to the AI so it never has to guess. */
export function ajoFacts(fmt: (v: bigint) => string): string {
  const st = getAjoState();
  if (!st.loaded) return "";
  const now = Math.floor(Date.now() / 1000);
  const names = ["open", "full, waiting for the draw", "live", "completed", "cancelled", "ended early"];
  const parts: string[] = [];
  for (const c of st.circles) {
    const joinable = c.status === 0 && c.joinDeadline > now && (!c.inviteOnly || c.isInvited);
    if (!c.isMember && !joinable) continue;
    let line = `"${c.name}" #${c.id} is ${names[c.status] || "unknown"}, ${fmt(c.contribution)} each, ${c.members.length}/${c.maxMembers} members`;
    if (c.isMember) {
      if (c.myDeposit > 0n) line += c.status >= 3 ? `, YOUR ${fmt(c.myDeposit)} DEPOSIT IS READY TO WITHDRAW` : `, your ${fmt(c.myDeposit)} deposit is locked until the circle ends`;
      if (c.status === 2) {
        const left = c.roundEndsAt - now;
        line += `, round ${c.round} of ${c.members.length}, ${c.paidNow ? "you have paid" : "you have not paid"}, ${left > 0 ? `ends in ${Math.round(left / 60)} min` : "time is up"}`;
      }
      if (c.autopayOn) line += ", auto-pay is on";
      if (c.myStrikes > 0) line += `, ${c.myStrikes} missed payment${c.myStrikes === 1 ? "" : "s"}`;
    } else line += ", you can join";
    parts.push(line);
  }
  const free = movableOf(st.circles, st.bal);
  parts.push(free > 0n ? `${fmt(free)} is waiting in the wallet and can be moved to spendable` : "nothing is waiting in the wallet");
  return parts.join("; ");
}
