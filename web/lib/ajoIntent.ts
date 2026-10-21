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

const CUE = /\b(aj+o+|esusu|isusu|susu|adashe|thrift|circle|pot|payout|winnings?|deposit|round|share|contribution)\b/;
const OTHER = /\b(earn|earning|savings?|vault|yield|predict|bet|stake|swap|buy|sell|bill|airtime|data|electricity|dstv|gotv|startimes|allowance|cap|guardian)\b/;
const ORDER: AjoStep["kind"][] = ["pay", "join", "settle", "withdraw", "move"];

/**
 * Reads a chat message about an ajo and returns what the user wants, using their live circles.
 * The AI is never asked to act on money: this is checked first, and the app asks for one confirmation.
 */
export function parseAjoText(text: string): AjoPlan | null {
  const t = text.toLowerCase();
  if (/0x[a-f0-9]{8,}/.test(t)) return null;
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
  const want = new Set<AjoStep["kind"]>();

  if (/\b(collect|claim)\b|\btake (my|the) (pot|payout|winnings?)\b/.test(t) && !hasNum && !/\bfrom\b/.test(t) && (cue || !other)) { want.add("settle"); want.add("move"); }
  if (/\b(withdraw|refund|get back|take out|release)\b/.test(t) && (cue || withdrawAny) && !(other && !/\b(deposit|aj+o+|circle|pot|esusu|thrift)\b/.test(t))) want.add("withdraw");
  if (/\b(move|transfer|bring|put)\b/.test(t) && /\b(spendable|balance|wallet|pot|winnings?|payout|ajo money|deposit)\b/.test(t) && !hasNum && (cue || movableNow) && !other) want.add("move");
  if (/\b(pay|contribute)\b/.test(t) && (/\b(share|aj+o+|circle|round|contribution|thrift|esusu)\b/.test(t) || (dueAny && !other && !hasNum && !/\b(to|for)\b/.test(t)))) want.add("pay");
  if (/\bjoin\b/.test(t) && (/\b(aj+o+|circle|thrift|esusu)\b/.test(t) || (joinAny && !other))) want.add("join");

  if (want.size === 0) {
    if (/\b(status|how'?s|how is|how far|progress|whose turn|who'?s next|when do i|did i (pay|collect)|any news)\b/.test(t) && /\b(aj+o+|circle|round|pot|payout|esusu|thrift)\b/.test(t)) return { type: "status", name };
    if (/^\s*(my )?aj+o+( status)?\s*[?.!]*\s*$/.test(t)) return { type: "status", name };
    return null;
  }
  return { type: "do", kinds: ORDER.filter((k) => want.has(k)), name };
}
