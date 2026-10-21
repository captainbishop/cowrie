import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

type Intent =
  | { action: "setAutosave"; percent: number }
  | { action: "setDailyCap"; amount: number; currency: string }
  | { action: "setAllowance"; to: string; amount: number; currency: string }
  | { action: "send"; to: string; amount: number; currency: string }
  | { action: "saveContact"; name: string; address: string }
  | { action: "guardian"; asset: string; op: "below" | "above"; price: number; act: "protect" | "notify" | "buy" | "sell"; amount?: number; currency?: string }
  | { action: "ajo"; name?: string; amount?: number; currency?: string; members?: string[]; minutes?: number }
  | { action: "ajoDo"; what: "pay" | "join" | "withdraw" | "move" | "status"; name?: string }
  | { action: "price"; asset?: string }
  | { action: "setName"; name: string }
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
  const pg = /\b(dey|wetin|abeg|wey|sabi|oga|wahala|comot|unu|wan|jare|biko|oya|gbam|kampe|abi|sef|sha|shey|padi|chop|waka|no be|e go|make we|how far|hw far|howfar|how body|na you|sharp o)\b/i.test(t);
  if (/^\s*(hi+|hey+|hello|yo+|sup|wa?s+up|gm+(onad)?|g'?mornin|good\s+(morning|afternoon|evening|day)|lfg|wagmi|how\s+(far|body|you\s+dey|u\s+dey)|hw\s*far|howfar|wetin\s+(dey|up|sup|you)|abeg|gbam|oya|kedu|bawo|sannu)\b/i.test(t))
    return { action: "reply", message: /\bgm+(onad)?\b|\blfg\b|\bwagmi\b/i.test(t) ? pick([`gmonad, ${you}! Wallet's warm. Sending, saving, swapping or watching a price?`, `gm ${you}. What are we doing onchain today?`]) : pg ? pick([`How far, ${you}! Wetin we go do with your money today, send, save, or set rule?`, `${you}! I dey here. Talk wetin you wan do.`]) : pick([`Hey ${you}. What are we doing with your money today, send, save, or set a rule?`, `${you}! Good to see you. Tell me what you'd like to do.`]) };
  if (/\b(e dey sharp|dey sharp|sharp o|i dey|we dey|e dey|body dey|no wahala|i dey kampe|e dey kampe|i'?m (?:good|fine|okay|alright)|all good|everything (?:good|fine))\b/i.test(t) && !/\d/.test(t) && !/\b(send|pay|save|swap|buy|sell|bet|predict|earn|cap|limit|allowance|add|fund|request|split|borrow|airtime|bill|balance)\b/i.test(t))
    return { action: "reply", message: pg ? pick([`I dey kampe too, ${you}! Wetin you wan make we do, send money, grow savings, or set a rule?`, `Everything dey, ${you}! Talk wetin you wan do with your money.`]) : pick([`Glad to hear it, ${you}. What should we do with your money, send, grow savings, or set a rule?`, `Good to hear, ${you}. Tell me what you'd like to do.`]) };
  if (/\b(pitch yourself|sell yourself|convince me|why.*\bwin\b|why should i (?:use|choose|pick|trust) (?:you|cowrie)|what makes you (?:special|different|unique|better)|who are you|what are you|wetin you be|built for (?:a )?hackathon|\bhackathon\b|your (?:future|roadmap|vision)|coming (?:soon|next)|future features?)\b/i.test(t))
    return { action: "reply", message: `${you}, I'm Cowrie, your talk-to-your-money wallet on Monad. Say what you want in plain words and it happens on-chain in under a second: send money, auto-save, grow your savings at 10% a year, swap tokens, back a prediction, or pay a bill, all inside the app, scam-checked, with no seed phrase and every amount in your own currency. Yes, I was built for the Monad hackathon, and I'm just getting started: borrowing against your own savings, deeper liquidity, scan-to-pay and merchants are next. What would you like to try?` };
  if (/^\s*(thank(?:s| you| u)?|tanks|thanks? (?:a lot|so much)|nice one|well done|good (?:job|work|one)|you(?:'| a)?re the best|appreciate it|ok(?:ay)?|cool|alright|aight|got it|great|perfect|love (?:it|you)|daalu|dalu|o se|na you|nagode|you too much)\b[.! ]*$/i.test(t))
    return { action: "reply", message: pg ? pick([`Anytime, ${you}! Wetin else you wan do?`, `My pleasure, ${you}. Anything else you wan do with your money?`, `Na nothing, ${you}. I dey here whenever you need me.`]) : pick([`Anytime, ${you}. What next?`, `My pleasure, ${you}. Anything else you want to do with your money?`, `Anytime. I'm here whenever you need me, ${you}.`]) };
  if (/^\s*(nvm|nvr\s*mind|never\s*mind|nevermind|forget\s*(it|that)|leave\s*(it|am)|scratch\s*that|cancel(\s*that)?|ignore\s*(me|that)|abeg\s*leave\s*am)\b[.!? ]*$/i.test(t))
    return { action: "reply", message: pg ? pick([`No wahala, ${you}. Talk wetin you wan do when you ready.`, `Ehen, I don leave am, ${you}. I dey here.`]) : pick([`No problem, ${you}. I've dropped it. Tell me whenever you're ready.`, `All good, ${you}. Say the word when you want to try again.`]) };
  if (/^\s*(l+o+l+z*|lmao+|haha+h*|hehe+)[.!? ]*$/i.test(t))
    return { action: "reply", message: pick([`Ha, ${you}! What are we doing with your money today?`, `Glad that landed, ${you}. Anything you want to do?`]) };
  if (/^\s*(mad\s*o+|omo+|chai+|kai+|haba|nawa(?:\s*o+)?|e\s*choke|wow+|whoa+|ehen+|ehn+)\b[.!? ]*$/i.test(t))
    return { action: "reply", message: pick([`I know, ${you}! Wetin we go do next?`, `E sweet me too, ${you}. Wetin you wan make we do?`, `Omo, ${you}! I dey here. Talk wetin you wan do next.`]) };
  { const am = t.match(/0x[a-fA-F0-9]{40}/); if (am && /\b(save|add|store|keep|remember)\b/i.test(t)) { const nm = (t.match(/\b(?:as|called|named)\s+(?:my\s+)?([a-z0-9_.\- ]+?)\s*$/i)?.[1] || t.match(/\b(?:as|called|named)\s+(?:my\s+)?([a-z0-9_.\- ]+)/i)?.[1] || "").trim(); return { action: "saveContact", name: nm, address: am[0] }; } }
  if (/\b(ajo|esusu|susu|adashe|thrift|savings? circle|contribution (?:group|club)|rotating savings)\b/i.test(t)) { const names = (t.match(/\bwith\s+(.+)$/i)?.[1] || "").split(/,|\band\b|&/).map((s) => s.trim()).filter((s) => s && s.length < 20); return { action: "ajo", amount: num(t) || undefined, currency: detectCcy(t), members: names.length ? names : undefined }; }
  { const gm = /\b(watch|guard|alert|monitor|notify|keep an eye)\b/i.test(t) && /\b(bitcoin|btc|eth|ether|ethereum)\b/i.test(t) && /\d/.test(t); if (gm) { const asset = /\b(eth|ether|ethereum|ceth)\b/i.test(t) ? "ethereum" : "bitcoin"; const op: "above" | "below" = /\b(above|over|up|more than|rises?|hits?|reaches?)\b/i.test(t) && !/\b(below|under|down|drops?|falls?|less than)\b/i.test(t) ? "above" : "below"; const act: "protect" | "notify" | "buy" | "sell" = /\bsell\b/i.test(t) ? "sell" : /\bbuy\b/i.test(t) ? "buy" : /\b(protect|safe|safety)\b/i.test(t) ? "protect" : "notify"; return { action: "guardian", asset, op, price: num(t), act }; } }
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
  if (/\b(airtime|data|recharge|electricity|nepa|phcn|light bill|power bill|water bill|rent|tickets?|school fees?|wifi|internet bill|fuel|flights?|air ?fare|plane ticket|hotel|shopping|order|cart|basket|checkout)\b/i.test(t) && /\b(buy|pay|top ?up|recharge|get|settle|book|clear|checkout|for)\b/i.test(t)) {
    const what = t.match(/\b(airtime|data|electricity|nepa|phcn|light|power|water|rent|tickets?|school fees?|wifi|internet|fuel|flights?|air ?fare|hotel|shopping|cart|basket|order)\b/i)?.[0] || "bill";
    return { action: "payBill", what, amount: num(t), currency: detectCcy(t) };
  }
  if (/\b(send|transfer|remit|pay)\b/i.test(t)) {
    const to = t.match(/to\s+(?:my\s+)?([a-z0-9_. ]+)$/i)?.[1] || t.match(/0x[a-fA-F0-9]{40}/)?.[0] || "";
    return { action: "send", to: to.trim(), amount: num(t), currency: detectCcy(t) };
  }
  if (/\b(add|top\s*up|fund|load|mint|deposit)\b/i.test(t)) return { action: "fund", amount: num(t), currency: detectCcy(t) };
  if (/\b(price|worth|cost|rate|how much is|trading at|pump|dump|dip|ath|moon)\b/i.test(t) && /\b(btc|bitcoin|eth|ether|ethereum|cbtc|ceth)\b/i.test(t) && !/\b(buy|sell|swap|send|pay|watch|alert|guard)\b/i.test(t)) return { action: "price", asset: /\b(eth|ether|ethereum|ceth)\b/i.test(t) ? "ethereum" : "bitcoin" };
  if (/\b(i'?m not|i am not|this is not|it'?s not|that'?s not)\b/i.test(t) && /\b(him|her|them|me|captain|[a-z]{2,})\b/i.test(t) && /\bnot\b/i.test(t) && t.length < 90) { const nm = t.match(/\b(?:i'?m|i am|call me|my name is|it'?s)\s+([a-z][a-z0-9 .'-]{1,22})$/i)?.[1]?.trim(); if (nm) return { action: "setName", name: nm }; }
  if (/\b(call me|my name is|i'?m called|name na)\s+/i.test(t)) { const nm = t.match(/\b(?:call me|my name is|i'?m called|name na)\s+([a-z][a-z0-9 .'-]{1,22})/i)?.[1]?.trim(); if (nm) return { action: "setName", name: nm }; }
  if (/\b(balance|how much (?:do|have|'?ve) i|how much i get|wetin i get|what(?:'?s| is) my (?:balance|money)|how much money)\b/i.test(t) && !/unlock|break|withdraw|send|pay|cap|limit|sub/i.test(t)) return { action: "balance" };
  if (/\bremind\b|reminder|don'?t let me forget/i.test(t)) return { action: "addReminder", title: (t.replace(/.*remind me (to |about )?/i, "").trim().slice(0, 40) || "Reminder"), amount: num(t), currency: detectCcy(t), dueInDays: 7, repeatDays: /\b(every|monthly|weekly|each month|each week)\b/i.test(t) ? (/week/i.test(t) ? 7 : 30) : 0 };
  if (/(netflix|spotify|youtube|gotv|dstv|showmax|apple|prime|disney)/i.test(t) && /(pay|sub|subscribe|run|renew|recharge|plan|option|list)/i.test(t) && !/\d/.test(t)) {
    const svc = t.match(/netflix|spotify|youtube|gotv|dstv|showmax|apple|prime|disney/i)![0];
    return { action: "reply", message: `How much is your ${svc[0].toUpperCase() + svc.slice(1)}? Tap one, or type the amount.`, options: ["₦2,200", "₦4,400", "₦7,000", "Another amount"] };
  }
  return { action: "reply", message: pg ? pick([`I hear you, ${you}, but I never catch wetin you wan do. I fit send money, save part of wetin you receive, set allowance or daily cap, add money, grow your savings, or track subscription. Wetin you want?`, `My bad, ${you}, I no too catch dat one. Try "send 5,000 give my friend" or "grow my savings".`]) : pick([`I hear you, ${you}, I just didn't catch what you'd like to do. I can send money, save a percentage, set an allowance or a daily cap, add money, grow your savings, or track a subscription. What would you like?`, `I didn't quite catch that, ${you}. Try "send 5,000 to my friend" or "grow my savings".`]) };
}

const SYS = `You are Cowrie, a warm, concise money companion for everyday people (the user's name is "{{name}}"). You run on the Monad blockchain and move a USD-pegged stablecoin shown in the user's local currency. Vary your wording, use their name sometimes, never sound robotic. You HAVE memory: the recent conversation, saved facts, subscriptions, contacts and live balances are given to you below, so use them.
If the user is ASKING a question (it starts with how, what, which, why, where, who, can, does, is or are, or ends with a question mark), ANSWER it with the reply action; never fire an action like earn, swap or payBill off a question.
Output ONLY one JSON object, no markdown:
{"action":"setAutosave","percent":n}
{"action":"setDailyCap","amount":n,"currency":C}
{"action":"setAllowance","to":s,"amount":n,"currency":C}
{"action":"send","to":s,"amount":n,"currency":C}
{"action":"fund","amount":n,"currency":C}
{"action":"unlockSavings","amount":n,"currency":C}
{"action":"addSubscription","service":s,"amount":n,"currency":C,"cycleDays":n,"startedDaysAgo":n}
{"action":"addReminder","title":s,"amount":n,"currency":C,"dueInDays":n,"repeatDays":n}
{"action":"balance"}
{"action":"price","asset":"bitcoin"|"ethereum"}
{"action":"earn","amount":n,"currency":C}
{"action":"stopEarn","amount":n,"currency":C}
{"action":"swap","asset":s,"amount":n,"currency":C,"direction":"buy"|"sell"}
{"action":"payBill","what":s,"amount":n,"currency":C}
{"action":"request","amount":n,"currency":C,"from":s,"note":s}
{"action":"split","amount":n,"currency":C,"people":n,"names":[s]}
{"action":"predict","side":"yes"|"no","amount":n,"market":s}
{"action":"guardian","asset":s,"op":"below"|"above","price":n,"act":"protect"|"notify"|"buy"|"sell","amount":n}
{"action":"ajo","name":s,"amount":n,"currency":C,"members":[s],"minutes":n}
{"action":"ajoDo","what":"pay"|"join"|"withdraw"|"move"|"status","name":s}
{"action":"saveContact","name":s,"address":s}
{"action":"setName","name":s}
{"action":"reply","message":s,"remember":s,"options":[s]}
C is NGN, USD, GHS, KES, ZAR, GBP, EUR, INR or AUTO.
RULES
- Money: never state a balance or any amount from your own guess. Anything like how much do I have, my balance, savings or gas returns {"action":"balance"} alone and the app fills in the real figures.
- Prices: you DO have live Chainlink BTC and ETH prices (given below). Any price question returns {"action":"price","asset":"bitcoin"} or ethereum. Never invent a price.
- Everything happens INSIDE the app. Never link out or name a third-party app or protocol. Earning, swaps, predictions, Guardian and Ajo all run on Cowrie's own contracts on Monad, viewable on the Monad explorer.
- earn moves spendable into Cowrie's savings vault at 10% a year; stopEarn withdraws (include an amount for part, omit for all). If they gave no amount, use reply to ask and offer three tappable amounts.
- swap: direction buy spends cUSD on an asset, sell returns it to cUSD (omit amount to sell all). asset is whatever they named, like bitcoin, eth or gold.
- payBill is everyday spending Cowrie pays on-chain from their balance, scam-checked and within their daily cap: airtime, data, electricity, cable TV, rent, school fees, event tickets, flights, online shopping and clearing a shopping cart. Put the details in "what". Ask for what is missing FIRST: airtime or data needs the network (MTN, Glo, Airtel or 9mobile) and the phone number; a ticket needs the event and ticket tier; a flight needs the route and travel date; shopping or a cart needs the store and the order or cart total. Never refuse an everyday payment, offer to pay it. You have no live web access, so never invent real prices, events, flights or listings, ask the user instead.
- predict places a bet with side, amount and a few words of the market question. guardian watches a live Chainlink price and acts when it crosses the level. ajo is an on-chain rotating savings circle (start, join and pay from the Ajo sheet on Home) where everyone pays each round and takes turns collecting, and Cowrie draws the turn order from a live Chainlink price so nobody can rig it.
- Cowrie has no loans, borrowing or credit yet; it is on the roadmap as borrowing against your own savings. Say that warmly, offer the savings vault or a swap instead, and never move money as if lending.
- saveContact whenever they give a 0x address to save under a name; return the action, do not merely say you saved it.
- If the user says they are not the person named above, or gives a different name, use setName with that name (or reply asking for it). Do not keep using the old name.
- Crypto lingo is welcome, and Cowrie lives on Monad so the Monad-native greeting "gmonad" (also gm, gm ser, GM) is normal: answer it warmly in kind. Understand and use naturally: gmonad, gm, wagmi, ngmi, lfg, ser, fren, anon, degen, ape in, bags, HODL, diamond hands, paper hands, moon, send it, up only, rug, rekt, dip, buy the dip, pump, dump, ATH, floor, bid, exit liquidity, stables, sats, gwei, gas, onchain, wen, based, probably nothing, few, Nads and Monanimals (the Monad community), and mon or MON for the gas token. Match their slang but stay clear, never hype a trade and never promise returns.
- Meta questions (pitch yourself, why should you win, do you know you are a hackathon build, what is coming next): answer briefly and honestly. Cowrie is a talk-to-your-money wallet on Monad where plain words become real on-chain actions in under a second: sending, auto-save, a 10% savings vault, token swaps, prediction markets, a Chainlink-powered Guardian that watches prices for you, and Ajo savings circles with a Chainlink-drawn fair order; every payment scam-checked, Google sign-in so no seed phrase, balances in their own currency, replies in their own language. Yes, it was built for the Monad hackathon. Next: credit against your savings, deeper liquidity, scan-to-pay and merchants. Never claim a feature that is not built.
- "options": only 2 to 4 short tappable chips when the user must pick a concrete value and tapping one finishes the job. Never on greetings, explanations or capability answers; omit it entirely then.
- "remember": a durable fact worth keeping (a preference, who someone is, a slang meaning), else omit it.
- MULTIPLE QUESTIONS: if the user asks more than one question, or makes more than one request, in a single message, answer every one of them in the same reply, in the order asked, briefly. Count the questions before you reply and never answer only the first. If the user says you missed something, answer exactly what you missed and say sorry in a few words, nothing more. When the user corrects you or says how they like answers, save that in the remember field.
- NEVER-MIND AND SMALL TALK: if the user cancels or drops something (nvm, never mind, forget it, leave it, abeg leave am, scratch that, cancel, ignore me), answer with one short friendly line that drops it and invites them back. Do not ask for the missing detail again and never say you did not catch it. Greetings, thanks, laughter (lol, haha), praise (you bad, you too much, nice one), exclamations (chai, omo, wahala, haba, wow), fillers (hmm, ok, k, bet, aight) and plain chat are all "reply" actions with a warm one-line answer in the user's own style.
- SLANG AND TYPOS: understand typos, abbreviations and slang in English (nvm, idk, tbh, ngl, rn, imo, fr, lowkey, bet, no cap, fire, vibes, bro, bruh, omg, brb, ty, thx, pls, plz, wanna, gonna, gimme), in Nigerian Pidgin (dey, wetin, abeg, oya, sharp sharp, e don do, I dey, na so, make we, how far, you dey play or dey plizzy or you dey joke meaning "you are kidding", often said sarcastically) and in mixed Pidgin and English. Judge the meaning from the whole sentence and the conversation, not from single words, and fix obvious typos silently.
- UNKNOWN SLANG: when a word or phrase is genuinely unfamiliar, do not say you did not catch it and do not list what you can do. Ask in one short line what it means, and when they explain it, save the meaning with "remember".
- NEVER CLAIM AN ACTION: you cannot move money. Never say anything is done, sent, paid, moved, withdrawn or collected. The app asks the user to confirm and then shows its own receipt.
- MEMORY: you are given the recent conversation, the user's recent wallet activity and their saved chats. Before saying you have no record of something, check all three. If a payment, Ajo share or send appears there, it happened; say so plainly with the amount and who.
- HOW COWRIE'S OWN FEATURES WORK, so you explain them correctly and never say a built feature does not exist:
  Ajo (on-chain): an Ajo circle is a real contract on Monad. The creator picks the amount each person pays per round, a security deposit (at least one payment, bigger is safer), the round length and the number of members. Members join from their OWN Cowrie account and lock the deposit, so the creator cannot add people for them. When the circle is full, a Chainlink CRE workflow draws the payout order from the live Chainlink BTC price, so nobody can rig who collects first, and records it on-chain. Each round, everyone pays their share before the timer ends; when it ends, the workflow settles the round and the whole pot goes to that round's collector. A missed payment is taken from the member's deposit so the collector is still paid in full, and the member gets a strike. After the last round everyone withdraws what is left of their deposit. Circles can be invite-only, so only the people the creator names can join. How people join, exactly: there is NO Share button in the chat and no code to type. An open circle shows up in every Cowrie user's Ajo sheet on Home with a Join button. An invite-only circle shows up only for the people the creator invited, and only in their own Cowrie account (the wallet address saved in People must be that account's address); they also get a bell alert when their app is open. The creator of a circle that is still open can tap Share link on the circle's card in the Ajo sheet, which sends a link that opens Cowrie straight to that circle with a Join button. Never invent any other way to join and never say a code exists.
  Starting a circle is done in the Ajo sheet on Home (the "ajo" action opens it with the details filled in). Paying a share, joining a circle, withdrawing a deposit, moving winnings to spendable and checking progress are done right in the chat with the "ajoDo" action ("what" is pay, join, withdraw, move or status, and "name" is the circle name if given). The app asks the user to confirm before any money moves, so never say it has already happened. Examples of what users say for ajoDo (understand any similar wording, in any language, including Pidgin): "pay my ajo", "I want to pay my own for this round", "did I pay yet", "whose turn is it to collect", "how is my ajo going", "join Office Thrift", "withdraw my deposit", "move my ajo money to spendable", "wetin dey happen with my ajo", "abeg make I pay my ajo". If you are not sure what they want to do with their ajo, ask one short question instead of guessing. Do not ask for cycle days or a list of members, and do not say you will set the circle up from the chat. If they give a round length (5 min, 2 hours, daily, weekly), put it in "minutes" (an hour is 60, a day is 1440, a week is 10080, a month is 43200) and never invent one.
  Honest limits: the draw and the payouts are run by a CRE workflow today, in simulation on Monad testnet with test money, not yet deployed live on Chainlink's network. Never claim real money or a live production deployment.
  Incoming money: when anyone sends the user money, Cowrie reads it from the chain, adds it to Payments under Activity and posts it in Notifications under the bell.
  Chats save automatically under Activity, Chats, and can be reopened any time.`;

async function callLLM(base: string, key: string, body: string): Promise<Intent | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    try {
      const r = await fetch(`${base}/chat/completions`, { method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body });
      if (r.status === 429) { console.warn("[cowrie] AI rate-limited, will try fallback"); clearTimeout(timer); return null; }
      if (r.status >= 500) { console.warn("[cowrie] AI busy", r.status, "retry", attempt + 1); clearTimeout(timer); await new Promise((s) => setTimeout(s, 500 * (attempt + 1))); continue; }
      if (!r.ok) { try { console.warn("[cowrie] AI call failed:", r.status, (await r.text()).slice(0, 180)); } catch {} clearTimeout(timer); return null; }
      const j = await r.json(); clearTimeout(timer);
      return extractJson(j?.choices?.[0]?.message?.content) as Intent | null;
    } catch (e) { clearTimeout(timer); console.warn("[cowrie] AI error:", (e as Error)?.message); await new Promise((s) => setTimeout(s, 400)); }
  }
  return null;
}

async function llmParse(text: string, name: string, lang: string, history: { role: string; content: string }[], ctx: string): Promise<Intent | null> {
  const key = process.env.LLM_API_KEY;
  if (!key) return null;
  const base = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const explicit = lang && lang !== "Auto";
  const low = (text || "").toLowerCase();
  const pidgin = /\b(hw\s*far|how\s*far|howfar|hw\s*body|how\s*body|how\s*(?:you|u|yu)\s*dey|wetin|wetin\s*dey|abeg|dey|wey|sabi|oga|wahala|comot|wan|jare|jor+|abi|sef|sha|shey|shebi|na|dem|fit|kampe|gidigba|padi|chop|waka|yarn|gbam|oya|no\s*be|e\s*go|make\s*we|i\s*fit|you\s*fit|no\s*wahala|wahala\s*dey|wetin\s*you|mad\s*o+|omo+|chai+|haba|nawa|e\s*choke|wahala\s*o+)\b/i.test(low) || /\bdon(?=\s|$)/i.test(low);
  const localMarker = pidgin || /[^\x00-\x7f]/.test(text || "") || /\b(unu|biko|kedu|daalu|dalu|nwanne|maka|bawo|jowo|pele|sannu|yaya|kudi|madalla|gini|achoro|achorom|ego|madu|mmadu|ziga|imela|ndewo|nnoo|kwanu|anyi|otu|ihe|nna|nne|nwa|owo|ejowo|bawoni|nagode|kwana|yanzu|kudin)\b/i.test(low);
  const enset = new Set("the a an and or but if then is am are was were be been being to of in on at for with from by as it its this that these those i you he she we they me my mine your yours our ours their his her them him us do does did doing done have has had having can could will would shall should may might must not nt yes what when where why who how which while want wants need needs send sends sent pay pays paid save saves saved swap buy buys sell sells trade money cash balance check checks show tell help please thanks thank hi hey hello good day morning afternoon evening today now more less than into out up down back about over under above below price drop drops fall falls rise rises hit hits reach reaches watch alert so just get got give gives let lets make makes some any all here there dont cant wont im youre thats whats its ive ill wanna gonna".split(/\s+/));
  const words = low.replace(/[^a-z'’]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const enHits = words.filter((w) => enset.has(w.replace(/['’]/g, ""))).length;
  const looksEnglish = !localMarker && words.length > 0 && (enHits / words.length >= 0.6 || (words.length <= 3 && enHits === words.length));
  const langLine = explicit
    ? ` HARD LANGUAGE RULE: write your ENTIRE reply text in ${lang} only. Do not use any other language, and never mix two languages in one reply. ${lang === "English" ? "Use plain, clear English, with no Pidgin words." : `Write it the natural way a ${lang} speaker really talks.`} The JSON keys and action names stay exactly as given.`
    : ` HARD LANGUAGE RULE: choose the reply language from the user's NEWEST message ALONE. The earlier messages, and your own earlier replies, do NOT decide it, so when the user changes language you change with them on the very next reply. ${pidgin ? "Their newest message is NIGERIAN PIDGIN, so write THIS reply fully in natural Nigerian Pidgin. Read it as Pidgin, not as English: \"hw far\" and \"how far\" are a greeting meaning how are you, not a question about distance; \"wetin dey\" means what is happening; \"abeg\" means please; \"mad o\", \"omo\", \"chai\", \"haba\" and \"nawa o\" are exclamations of surprise or amazement, like wow, so react to them warmly instead of treating them as a request. Greet back warmly in Pidgin." : looksEnglish ? "Their newest message is plain English, so write THIS reply in plain, natural English with no Pidgin words, even if the chat was in Pidgin a moment ago." : "Mirror the exact language or variety of that newest message, whether English, Nigerian Pidgin, Igbo, Yoruba, Hausa, French, Swahili, Arabic, Portuguese or Hindi."} Never mix two languages in one reply. The JSON keys and action names stay exactly as given.`;
  const tag = !explicit && looksEnglish ? "\n\n[Instruction, do not repeat this line: write your reply message in plain English only, not Pidgin.]" : "";
  // For an English message after a Pidgin stretch, sending the history as chat turns makes the
  // model keep speaking Pidgin. Dropping it entirely (the old fix) made Cowrie forget what it had
  // just done. So pass it as a plain transcript instead: the facts survive, the language pull does not.
  const asTranscript = !explicit && looksEnglish && history.length > 0;
  const transcript = asTranscript ? ` RECENT CONVERSATION, for facts only (what was said, sent or paid). Use it to answer, but reply in English whatever language it is in:\n${history.map((m) => `${m.role === "user" ? "User" : "Cowrie"}: ${m.content}`).join("\n")}` : "";
  const histForCall = asTranscript ? [] : history;
  const CIRCLE_WORD: Record<string, string> = { Igbo: "esusu", Hausa: "adashe" };
  const termLine = explicit && CIRCLE_WORD[lang] ? ` VOCABULARY: when you write in ${lang}, call a rotating savings circle "${CIRCLE_WORD[lang]}", not "ajo". Keep the word "Ajo" only when you name the app's Ajo sheet or button, which is labelled "Ajo circle".` : "";
  const messages = [{ role: "system", content: SYS.replace("{{name}}", name) + langLine + termLine + ctx + transcript }, ...histForCall, { role: "user", content: text + tag }];
  const mk = (m: string) => JSON.stringify({ model: m, temperature: 0.5, max_tokens: 700, messages });
  const primary = await callLLM(base, key, mk(model));
  if (primary) return primary;
  const fbKey = process.env.LLM2_API_KEY, fbBase = process.env.LLM2_BASE_URL, fbModel = process.env.LLM2_MODEL;
  if (fbKey && fbBase && fbModel) { console.warn("[cowrie] primary LLM unavailable, using fallback brain"); return await callLLM(fbBase, fbKey, mk(fbModel)); }
  return null;
}

export async function POST(req: NextRequest) {
  const { text, name, lang, history, facts, subs, bal, markets, contacts, prices, recent, chats } = await req.json().catch(() => ({ text: "" }));
  if (!text || typeof text !== "string") return NextResponse.json({ ok: false, error: "no text" }, { status: 400 });
  const nm = typeof name === "string" && name ? name : "there";
  const lg = typeof lang === "string" && lang ? lang : "Auto";
  const hist = Array.isArray(history) ? history.filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant")).slice(-8) : [];
  const mkts = typeof markets === "string" && markets.trim() ? markets : "";
  const bk = typeof contacts === "string" && contacts.trim() ? contacts : "";
  const px = typeof prices === "string" && prices.trim() ? prices : "";
  const rc = typeof recent === "string" && recent.trim() ? recent.slice(0, 900) : "";
  const ch = typeof chats === "string" && chats.trim() ? chats.slice(0, 500) : "";
  const ctx = ` The user's CURRENT live balances (authoritative, never contradict these): ${typeof bal === "string" && bal ? bal : "unknown"}. Saved facts about the user: ${Array.isArray(facts) && facts.length ? facts.join("; ") : "none yet"}. Their subscriptions: ${typeof subs === "string" && subs ? subs : "none yet"}. Their saved People contacts (name: address), the authoritative list, use these when they say a name and tell them to open People to see them: ${bk || "none saved yet"}. LIVE Chainlink prices right now (authoritative, this is real data you DO have): ${px || "not loaded yet"}. The user's RECENT WALLET ACTIVITY, newest first (authoritative record of what was sent, paid and received): ${rc || "nothing yet"}. Titles of their earlier saved chats: ${ch || "none yet"}. The ONLY open prediction markets right now are: ${mkts || "none"}. If the user asks to bet on anything else, do not invent a market: use the predict action and the app will show them these, or tell them it is not available and name these.`;
  const llm = await llmParse(text, nm, lg, hist, ctx);
  let intent = llm && (llm as { action?: string }).action ? llm : rulesParse(text, nm);
  // Safety: anything that mentions an Ajo circle must never turn into a payment. Send it to the Ajo form.
  if (/\b(ajo|esusu|susu|adashe|thrift|savings? circle|rotating savings)\b/i.test(text) && !["ajoDo", "reply"].includes((intent as { action?: string }).action || "")) {
    const t0 = text.toLowerCase();
    const a0 = intent as { action?: string; amount?: number; members?: string[]; name?: string };
    const hasDetails = a0.action === "ajo" && ((a0.amount || 0) > 0 || (a0.members?.length || 0) > 0);
    const startVerb = /\b(start|create|new|begin|set ?up)\b/.test(t0);
    const what = /\b(withdraw|refund|get back|take out)\b/.test(t0) ? "withdraw"
      : /\b(move|transfer|send)\b.*\b(spendable|wallet|balance)\b|\bcollect(ed)?\b|\bmy (winnings|pot|payout)\b/.test(t0) ? "move"
      : /\bjoin\b/.test(t0) ? "join"
      : /\b(pay|contribute|settle)\b/.test(t0) ? "pay"
      : /\b(status|how'?s|how is|how far|progress|whose turn|who'?s next|when do i|did i|check|update|wetin|what'?s happening|what is happening|any news)\b/.test(t0) ? "status"
      : "";
    if (startVerb || (hasDetails && !what)) intent = { action: "ajo", name: a0.name, amount: a0.amount, members: a0.members } as unknown as Intent;
    else if (what) intent = { action: "ajoDo", what, name: a0.name } as unknown as Intent;
    else intent = { action: "reply", message: "What would you like to do with your ajo?", options: ["Check my ajo", "Pay my ajo", "Start an ajo"] } as Intent;
  }
  // Commands about an ajo must reach the app as actions, even when the AI answered with a plain reply or the word was mistyped.
  {
    const t1 = text.toLowerCase();
    const a1 = intent as { action?: string; name?: string };
    const ajoWord = /\b(aj+o+|esusu|isusu|susu|adashe|thrift|savings? circle|rotating savings)\b/.test(t1);
    const startVerb = /\b(start|create|new|begin|set ?up)\b/.test(t1);
    const learning = /\b(how (does|do|is an?|are)|what (is|are|does)|explain|meaning|why|tell me about)\b/.test(t1) && !/\bmy\b/.test(t1);
    const w = /\b(withdraw|refund|get back|take out)\b/.test(t1) ? "withdraw"
      : /\b(move|transfer|send)\b.*\b(spendable|wallet|balance)\b|\bcollect(ed)?\b|\bmy (winnings|pot|payout)\b/.test(t1) ? "move"
      : /\bjoin\b/.test(t1) ? "join"
      : /\b(pay|contribute|settle)\b/.test(t1) ? "pay"
      : /\b(status|how'?s|how is|how far|progress|whose turn|who'?s next|when do i|did i|check|update|what'?s happening|what is happening|any news)\b/.test(t1) ? "status"
      : "";
    if (ajoWord && w && !startVerb && !learning && a1.action !== "ajoDo") {
      intent = { action: "ajoDo", what: w, name: a1.name } as unknown as Intent;
    }
  }
  // If the AI service did not answer, say so instead of pretending the message was not understood.
  if (!llm && (intent as { action?: string }).action === "reply" && /\bcatch\b/i.test((intent as { message?: string }).message || "")) {
    (intent as { message?: string }).message = `My thinking service is busy for a moment, ${nm}. Please send that again in a few seconds.`;
  }
  {
    // The AI cannot move money. If it answers a money request with a made-up "done", replace it.
    const r1 = intent as { action?: string; message?: string; options?: string[] };
    const m1 = String(r1.message || "");
    if (r1.action === "reply" && /\b(move|withdraw|collect|claim|pay|transfer|join|refund)\b/i.test(text)
      && /\b(done|sorted|completed|now spendable|has been (moved|sent|paid|withdrawn)|i('| ha)ve (moved|sent|paid|withdrawn)|coming back to you|check activity)\b/i.test(m1)
      && /\b(pot|deposit|withdraw|spendable|ajo|circle|round|payout|share)\b/i.test(m1)) {
      r1.message = `I have not moved anything yet, ${nm}. Say what you want in one line, like "move my pot", "withdraw my deposit" or "pay my share", and I will ask you to confirm before any money moves.`;
      r1.options = ["Move my pot", "Withdraw my deposit", "Pay my share", "Ajo status"];
    }
  }
  const io = intent as { message?: string; reply?: string; reason?: string };
  if (io.message) io.message = deDash(io.message);
  if (io.reply) io.reply = deDash(io.reply);
  if (io.reason) io.reason = deDash(io.reason);
  return NextResponse.json({ ok: true, intent, source: llm ? "llm" : "rules" });
}
