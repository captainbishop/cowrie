import json, sys, time, urllib.request

URL = "https://cowrie-amber.vercel.app/api/parse"
Q = [{"role": "user", "content": "send some money"}, {"role": "assistant", "content": "Who should I send it to?"}]

# (group, text, accepted actions separated by |, optional history)
CASES = [
 ("cancel", "nvm", "reply", Q), ("cancel", "never mind", "reply", Q), ("cancel", "abeg leave am", "reply", Q),
 ("cancel", "forget it", "reply", Q), ("cancel", "scratch that", "reply", Q),
 ("greeting", "yo", "reply", None), ("greeting", "wassup bro", "reply", None), ("greeting", "how far", "reply", None),
 ("greeting", "hw far na", "reply", None), ("greeting", "gm ser", "reply", None), ("greeting", "wagwan", "reply", None),
 ("thanks", "ty", "reply", None), ("thanks", "thx fam", "reply", None), ("thanks", "oshey", "reply", None), ("thanks", "daalu", "reply", None),
 ("praise", "you bad", "reply", None), ("praise", "you too much", "reply", None), ("praise", "omo you sabi work", "reply", None),
 ("praise", "this app is fire", "reply", None), ("praise", "lowkey love this", "reply", None),
 ("exclaim", "chai", "reply", None), ("exclaim", "omo", "reply", None), ("exclaim", "lol", "reply", None),
 ("exclaim", "\U0001F602\U0001F602", "reply", None), ("exclaim", "hmm", "reply", None),
 ("tease", "you dey play", "reply", None), ("tease", "stop dey play", "reply", None), ("tease", "e don do", "reply", None),
 ("money", "sned 5k to ike", "send", None), ("money", "send 5k 2 ike", "send", None), ("money", "snd 5000 to mum", "send", None),
 ("money", "abeg send 5k give mum", "send", None), ("money", "make you send 5k to tunde", "send", None),
 ("money", "pay mum 5k", "send", None), ("money", "transfer 10k to ike", "send", None),
 ("balance", "chek my balanse", "balance", None), ("balance", "wats my balance", "balance", None),
 ("balance", "wetin be my balance", "balance", None), ("balance", "how much i get", "balance", None),
 ("balance", "gimme my balance", "balance", None),
 ("save", "grow my savigns", "earn|reply", None), ("save", "put 20k for earn", "earn", None),
 ("save", "make my money dey grow", "earn|reply|discover", None),
 ("price", "btc price", "price", None), ("price", "how much be bitcoin", "price", None), ("price", "eth now", "price", None),
 ("crypto", "lfg", "reply", None), ("crypto", "wagmi", "reply", None), ("crypto", "gm", "reply", None),
 ("crypto", "ape 10k into cbtc", "swap", None),
 ("ajo", "start an ajo of 20k every week", "ajo", None), ("ajo", "hows my ajo", "ajoDo", None),
 ("ajo", "pay my ajoo", "ajoDo", None), ("ajo", "esusu", "ajo|reply", None), ("ajo", "i wan join ajo", "ajoDo|ajo", None),
 ("unknown", "dey plizzy", "reply", None),
 ("multi", "what's my balance and what's the btc price", "balance|price|reply", None),
]

BAD = ("didn't quite catch", "didn't catch", "did not catch", "try \"send")

def ask(text, history):
    body = {
        "text": text, "name": "Anadu", "lang": "Auto", "history": history or [], "facts": [],
        "bal": "spendable N4,948,000 (about $3,092.50), savings 0, gas 5.0 MON", "subs": "",
        "markets": "Will Bitcoin close above $100k this year?",
        "contacts": "Ike: 0x37082dbcBdef4c4b0c9fe99579f85E38786407B2; Mum: 0x" + "1" * 40 + "; Tunde: 0x" + "2" * 40,
        "prices": "BTC $81,500, ETH $2,450", "recent": "", "chats": "",
    }
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "User-Agent": "cowrie-test"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())

passed, groups = 0, {}
for group, text, expect, hist in CASES:
    try:
        intent = (ask(text, hist) or {}).get("intent") or {}
        action = intent.get("action", "none")
        msg = intent.get("message") or intent.get("text") or intent.get("reply") or ""
        low = msg.lower()
        ok = action != "unknown" and not any(b in low for b in BAD) and action in expect.split("|")
    except Exception as e:
        action, msg, ok = "ERROR", str(e)[:80], False
    g = groups.setdefault(group, [0, 0])
    g[1] += 1
    if ok:
        g[0] += 1
        passed += 1
    print(("PASS" if ok else "FAIL"), group, repr(text), "->", action, "|", msg.replace("\n", " ")[:100])
    time.sleep(2.5)

print()
for g, (a, b) in groups.items():
    print(f"{g}: {a}/{b}")
print(f"Passed {passed} of {len(CASES)}")
