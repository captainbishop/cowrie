<p align="center">
  <img src="docs/banner.svg" alt="Cowrie, talk to your money, on Monad" width="100%">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Monad-testnet-836EF9?style=flat-square" alt="Monad testnet">
  <img src="https://img.shields.io/badge/Solidity-0.8.28-363636?style=flat-square" alt="Solidity 0.8.28">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square" alt="TypeScript 5">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/CSS-663399?style=flat-square&logo=css&logoColor=white" alt="CSS">
  <img src="https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=next.js" alt="Next.js 14">
  <img src="https://img.shields.io/badge/Hardhat-2-FFF100?style=flat-square&logo=hardhat&logoColor=black" alt="Hardhat 2">
  <img src="https://img.shields.io/badge/Chainlink-CRE-375BD2?style=flat-square&logo=chainlink&logoColor=white" alt="Chainlink CRE">
  <img src="https://img.shields.io/badge/license-MIT-22c55e?style=flat-square" alt="MIT license">
  <img src="https://img.shields.io/badge/PRs-welcome-6c4ae6?style=flat-square" alt="PRs welcome">
</p>

# Cowrie

Live app: https://cowrie-amber.vercel.app

Cowrie turns a sentence into money moving. You type what you want, in plain language, in your own currency, and it happens on-chain. That sounds like a chat trick until you look at what has to exist underneath it for the sentence to be safe to act on.

Four pieces of infrastructure carry that weight, and each one is doing work you would notice if it disappeared.

| Piece | What it carries in Cowrie | Where it is used |
|---|---|---|
| **Privy** | Google sign-in, an embedded wallet and sponsored gas. No seed phrase, no extension, no MON to buy before a first payment | Every user, every transaction |
| **Qwen 3.8** | The conversation: turning "abeg send 5k give my mama" into a contract call, in whichever language the user typed | The intent layer behind every message |
| **Chainlink** | A Chainlink CRE workflow that draws ajo payout orders from a live BTC price and settles rounds when their timers end, plus the price feeds behind Guardian | `cowrie-cre/`, `AjoKeeper`, `AjoCircle` |
| **Monad** | Settlement in roughly 300ms, so saying a thing and watching it happen feel like one action | Every contract call |

Take Privy away and every new user needs a seed phrase and a gas token before they can be paid. Take Qwen away and the app becomes a form with too many fields. Take Chainlink away and an ajo circle is back to trusting whoever is holding the pot. The details are in [what each integration does](#what-each-integration-does).

The first users are Nigerians. Cowrie defaults to naira, answers in Pidgin, and puts ajo on the home screen, because a product that works here tends to work elsewhere. Facebook spent its first year inside one university before it opened up. Amazon sold books before it sold anything else. M-Pesa proved itself through Kenyan corner-shop agents long before other countries copied the model. Cowrie is built the same way. Get one place right, then widen.

## About

Most people here never touch crypto, and the friction is the reason. There is a seed phrase to lose, a gas token to buy before you can move a cent, and a 42-character address where one wrong character hands your money to a stranger. Bank apps are not much kinder. They show you the damage after it happens, and they will not stop you overspending, save on your behalf, or warn you before a subscription bills again.

Cowrie is a stablecoin wallet you talk to. You say what you want, in English, Pidgin, Igbo, Yoruba, Hausa, or any of the languages supported, and it happens on-chain in under a second: send money, save a slice of everything you earn, cap your spending, pay an allowance, grow your balance in a savings vault, swap into bitcoin, back a prediction, start or join an ajo circle, or have Chainlink watch a price for you. Every payment is checked against a scam list before it leaves. You sign in with Google, so there is no seed phrase, gas is sponsored, and every amount shows in your own currency.

It runs on Monad, where blocks land in about 300ms, fast enough that saying a thing and watching it happen feels like the same moment.

## What Cowrie does

Cowrie puts a whole financial life behind one sentence. What normally takes a bank app, a bureau de change, a bills app and a crypto exchange, Cowrie does from a single chat and settles each on-chain.

Paying and getting paid is the core. Say "send 5,000 to Mum", "buy 500 airtime for 0803...", "pay my light bill", "book a flight to Lagos", "clear my shopping cart", "request 3,000 from Tunde", or "split 30,000 three ways", and Cowrie makes the payment. Anything with missing details gets a question first, so airtime collects a network and a number and a ticket collects an event and a tier before a kobo moves. People you pay often get saved by name, and from then on their name is enough. When money arrives from someone else, Cowrie reads it off the chain and tells you, so a credit shows up in your history instead of appearing silently in your balance.

Rules are the part a bank app never gives you. Say "save 10% of everything I receive", "don't let me spend more than 20,000 a day", or "give my son 2,000 a day", and those rules live inside `PolicyVault` in Solidity instead of on the honour system.

Growing money happens in the app, not somewhere else. Say "grow my savings" or "earn 50,000" and Cowrie moves that into its own on-chain savings vault, which accrues at 10% a year in this demo and lets you withdraw any time, in part or in full. Say "swap 10,000 into bitcoin" and it trades through a constant-product pool inside the contract, giving you cBTC, cETH or cGOLD to hold and sell back. Say "bet 5,000 that Bitcoin tops $100k" and you take a side on a parimutuel market you settle and claim yourself. Ask for a price and you get Chainlink's live number, not a guess.

Ajo is one feature among several, and the one that pushed me to build Cowrie in the first place. It is the rotating savings circle Nigeria already runs on trust, rebuilt so the turn order is drawn by Chainlink and each round settles on-chain. A member creates a circle in a sheet on Home: name, contribution per round, a security deposit, the round length and how many people. They can lock it to an invite list so only named addresses can join, and every member joins from their own wallet and locks their own deposit, so nobody gets signed up by somebody else. Paying your share, joining, withdrawing a deposit and moving a win into spendable all work from the chat, with one confirmation before money moves. Cowrie also watches your circles in the background and speaks up two minutes before a round closes, when you have collected a pot, and when a circle ends and your deposit is ready to pull back. A missed payment comes out of that member's deposit so the collector still gets paid in full, and the member picks up a strike.

Safety is on by default. Every send goes through `ScamRegistry.isFlagged()` before leaving, and an address is blocked once the owner flags it or three people report it.

The assistant speaks like the person using it. It mirrors whatever language you wrote in, switches the moment you switch, and understands both market slang and the local kind, so "gmonad" and "abeg send 5k give my mama" both land. It remembers what matters, keeps your saved facts and contacts in view, and conversations worth keeping can be reopened from the Chats tab.

## At a glance

| | |
|---|---|
| Privy | Google login, embedded wallet, sponsored gas on every transaction |
| Qwen 3.8 | Alibaba's model on Groq's free tier, with Gemini as an automatic fallback and a rules parser if no key is set |
| Chainlink | A CRE workflow (TypeScript, one-minute cron) drawing Ajo payout orders from BTC/USD and settling ended rounds, plus mainnet price feeds behind Guardian |
| Chain | Monad testnet (chain ID 10143), blocks in about 300ms |
| Contracts | PolicyVault, ScamRegistry, MockUSD, MockAsset, AjoCircle, AjoKeeper |
| DeFi inside Cowrie | Savings vault (10% APR), constant-product swap pools (cBTC, cETH, cGOLD), parimutuel prediction markets |
| Everyday actions | Airtime, bills, flights, online shopping and carts, ticket payments, money requests, bill splitting |
| Social saving | Invite-only ajo circles with deposits, strikes, timed rounds and an auto-settling payout order |
| Currencies shown | NGN by default, plus USD, GHS, KES, ZAR, GBP, EUR, INR |
| Languages | English, Nigerian Pidgin, Igbo, Yoruba, Hausa, French, Swahili, Arabic, Portuguese, Hindi |

## What each integration does

### Chainlink: fairness and facts Cowrie cannot fake

Chainlink gets bolted onto trading contracts to read a price. Cowrie points it at two things an ordinary user feels, and it uses more of the platform than a feed read.

**Guardian** is a price watch you set in words. Say "watch bitcoin and alert me if it drops below $90,000" and Cowrie checks Chainlink's BTC/USD and ETH/USD feeds every 45 seconds, then acts the moment your level is crossed: telling you, moving money into savings, or offering the trade. The Guardian card on the home screen shows the live feed value, so the number on screen is the oracle's number rather than something Cowrie made up.

**The ajo draw and settlement** are a Chainlink CRE workflow, and this is the part that could not be built honestly any other way. The workflow runs on a one-minute cron. For any circle that has filled, it reads BTC/USD on Monad mainnet, turns that reading into the seed for a shuffle over the member list, and delivers the resulting order as a signed report to `AjoKeeper`. The keeper forwards it to `AjoCircle`, which stores both the order and the seed, so the payout order on the card can be checked against the price that produced it. Nobody in the circle controls the number and nobody can predict it in advance. The same workflow watches for rounds whose timer has ended and settles them, so collection does not depend on anyone remembering to press a button.

The workflow is TypeScript against the CRE SDK, with a schema-validated config, an EVM read capability for the price and an EVM write capability for the report. It lives in `cowrie-cre/` and runs through `cre workflow simulate`.

One honest limitation: this runs in CRE simulation against a mock forwarder on Monad testnet, with test money. The contracts, the report format and the forwarder check are the production shape, and the workflow reads a real Chainlink feed, but the workflow has not been registered on Chainlink's network.

Chainlink's push feeds are live on Monad mainnet rather than testnet, so Cowrie reads them from mainnet with a read-only client while your money stays on testnet. The read costs no gas and needs no credentials.

| Feed | Address on Monad mainnet |
|---|---|
| BTC / USD | `0x187efD8ba8483105f2735740D956f7CD23723deC` |
| ETH / USD | `0x38057D0458ca56068e1A57E62D3874cA129A7A78` |

### Privy: a wallet nobody has to know they have

The hardest part of onboarding someone who has never touched crypto is not teaching them about crypto. It is getting them paid without handing them a secret they cannot recover and a gas token they have never heard of.

Cowrie signs people in with Google through Privy. Privy creates an embedded wallet in the browser, so there is no extension, no seed phrase to write down, and no import step. Transactions go through Privy's `useSendTransaction` with gas sponsorship on, so a first payment works from an account holding zero MON. The approval sheet is customised per action, with wording like "Send ₦5,000 to Mum" instead of a raw hex confirmation, and every send falls back to a direct viem write if the Privy path throws, so a wallet-UI failure cannot strand someone mid-payment.

### Qwen 3.8: the part that turns a sentence into a transaction

The assistant is Qwen 3.8, served on Groq's free tier through an OpenAI-compatible endpoint. It does two jobs that are easy to conflate and hard to do together.

It holds the conversation. It reads the last eight turns, the user's saved facts, their contacts, their open ajo circles and their live balances, and it answers in whichever language the user wrote in. A deterministic language resolver sits in front of it and picks English, Pidgin, Igbo, Yoruba or Hausa from the newest message, so a reply does not drift into the previous turn's language.

It also compiles intent. The endpoint returns one JSON object naming an action and its arguments, and the client executes that against a contract. The model never states a balance or an amount from its own guess. Anything involving money that came from it is checked against real state before a transaction is built. If the provider is down or no key is set, a rules parser takes over and the app keeps working.

Gemini is wired as a second provider through `LLM2_BASE_URL`, and the Qwen endpoint can be swapped for any OpenAI-compatible host by changing three environment variables.

### Monad: why any of this feels instant

Every payment, contribution and settlement above lands on Monad testnet (chain ID 10143). Blocks arrive in roughly 300ms, which is the difference between a chat that answers a question and a chat that finishes a task. The vault holds balances and enforces the rules in Solidity rather than in the UI, so a spending cap cannot be bypassed by a client that decides to ignore it.

## How the contracts work

**`PolicyVault`** holds each user's cUSD balance and enforces their rules directly in Solidity:

- `spendable` and `savings` are separate internal balances per address.
- `setAutosave(bps)` stores a basis-point percentage; every incoming `send` or `claimAllowance` call splits that share into `savings` automatically.
- `setDailyCap(cap)` resets each calendar day (by `block.timestamp / 1 days`) and reverts any send that would exceed the cap.
- `setAllowance(to, ratePerDay)` starts a streaming allowance; the beneficiary calls `claimAllowance(from)` to pull what has accrued since the last claim.
- `startEarning(amount)` moves spendable balance into the earn vault. `_accrueEarn` mints yield tokens at `EARN_APR_BPS = 1000` (10% a year) before every deposit or withdrawal.
- `swapCusdForToken` and `swapTokenForCusd` are a constant-product AMM with a 0.3% swap fee. `seedPool` populates the reserve pairs on testnet.
- `predict`, `resolveMarket`, and `claimPrediction` implement a parimutuel market: winnings are proportional to each user's share of the winning side's pool.
- Every `send` calls `scam.isFlagged(to)` and reverts if the recipient is on the blocklist.

**`AjoCircle`** is the rotating savings circle. The creator sets the contribution, the deposit, the round length and the member cap, and can lock the circle to a named invite list. `join` pulls each member's own deposit into the contract. Once the circle fills, the drawer records a payout order with `setOrder`, which starts round 1. Members call `contribute` before the round closes; when the timer ends, `settleRound` pays the round's collector the whole pot. Any member who has not paid has that round's contribution taken from their deposit and picks up a strike, so the collector is made whole either way. The next round's clock starts at settlement, which means a late keeper never eats into anyone's payment window. When the last round settles, or if a circle never fills and is cancelled, members call `withdrawDeposit` to take back what is left.

**`AjoKeeper`** is the bridge from Chainlink into the circle. It implements CRE's `onReport` receiver interface and accepts reports only from the configured forwarder. A report carries an action code (settle a round, or record a draw), and the keeper calls the matching `AjoCircle` function. `setForwarder` is owner-gated so the mock forwarder used in simulation can be swapped for the production one without redeploying anything else.

**`ScamRegistry`** is the on-chain blocklist. The owner can flag or clear any address with `setFlag`. Anyone can `report` an address; three reports auto-flag it. `PolicyVault` reads `isFlagged()` before every send.

**`MockUSD`** is a 6-decimal test stablecoin (cUSD) that anyone can mint on testnet. `PolicyVault` uses the same `IMintableUSD` interface to mint yield rewards directly into itself. **`MockAsset`** is a plain mintable ERC20 used for the cBTC, cETH and cGOLD pools.

## Deployed on Monad testnet

| Contract | Address |
|---|---|
| PolicyVault | `0x9EE0a2cA7916374Cb13ED323132fD8832D5ddd9F` |
| ScamRegistry | `0x7502309ec1462Db5720C68464DeB942AA2e8d2ED` |
| MockUSD (cUSD) | `0x1ED39f9810ceB817F48Bf576784F76cdc74ddcee` |
| AjoCircle | `0xECAB8b09c60a595fC88d699FD53877a5b8aB10b5` |
| AjoKeeper | `0x1E75Ead5Efd5A60354eDA9BFB18667E67b147143` |
| MockForwarder (CRE simulation) | `0xB9F79d863261869B234c481D1f9A7af84AeAd192` |

Newest deployment addresses are in `deployments.json`, which `deploy.js`, `deploy-ajo.js` and `deploy-keeper.js` update as they run.

Explorer: https://testnet.monadexplorer.com
RPC: https://testnet-rpc.monad.xyz
Faucet: https://faucet.monad.xyz

## Run the contracts locally

### Step 1: Install dependencies

From the repo root:

```bat
npm install
```

### Step 2: Generate a deployer account

```bat
node scripts\newkey.js
```

`newkey.js` creates a throwaway testnet wallet and writes `PRIVATE_KEY` and `MONAD_RPC` into `.env`. If `.env` already has a valid key it prints the existing address and exits without changing anything. The output will print your address:

```
YOUR ADDRESS:  0xYourAddressHere
```

### Step 3: Fund the deployer with test MON

Go to https://faucet.monad.xyz, paste the address from Step 2, and request test MON. You need a small amount for gas.

### Step 4: Compile

```bat
npm run compile
```

Hardhat compiles everything in `contracts/` with Solidity 0.8.28 and the `cancun` EVM target.

### Step 5: Run the tests

```bat
npx hardhat test
```

This covers `AjoCircle`, the invite-only path and `AjoKeeper`: a full circle paying each collector in turn, deposits coming back, a missed payment covered from the deposit with a strike recorded, an invalid order rejected, a late keeper not shortening the next payment window, and only the forwarder being able to deliver a report.

### Step 6: Deploy the vault stack

```bat
npm run deploy
```

This runs `scripts/deploy.js`, which deploys `MockUSD`, `ScamRegistry` and `PolicyVault`, writes their addresses to `deployments.json`, and calls `scripts/syncenv.js` to copy them into `web/.env.local`.

### Step 7: Deploy the Ajo contracts

```bat
npx hardhat run scripts\deploy-ajo.js --network monadTestnet
npx hardhat run scripts\deploy-keeper.js --network monadTestnet
```

`deploy-ajo.js` deploys `AjoCircle` against the cUSD token. `deploy-keeper.js` deploys `AjoKeeper` with the mock forwarder, points `AjoCircle`'s drawer at it, and saves both addresses. Add the circle address to `web/.env.local` as `NEXT_PUBLIC_AJO_CIRCLE`.

### Step 8: Seed the demo state

```bat
npm run seed
```

`scripts/seed.js` mints 500 cUSD into your vault spendable balance, flags `0x000000000000000000000000000000000000dEaD` as a scam address, sets your auto-save rule to 10%, deploys the three mock asset tokens and seeds a pool for each, and creates two prediction markets if none exist yet. It is safe to re-run: it skips anything that already exists.

### Step 9: Try an ajo circle end to end

```bat
node scripts\demo-ajo.js
node scripts\ajo-helper.js
```

`demo-ajo.js` creates a three-person circle with throwaway wallets so you can watch a full draw and settlement without inviting anyone. `ajo-helper.js` prints circle state, deposits and recent sends so you can confirm what happened on-chain. `check-money.js` does the same for two real addresses you put in `.who`.

## Run the web app

### Step 1: Copy the environment file

```bat
cd web
copy .env.local.example .env.local
```

After deploying, `syncenv.js` has already written the contract addresses, so you only need the values below.

### Step 2: Add your Privy app ID

Sign in at https://dashboard.privy.io and create an app, then paste its App ID:

```
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
```

### Step 3: Point the app at your Ajo circle

```
NEXT_PUBLIC_AJO_CIRCLE=0xYourAjoCircleAddress
```

Without this the Ajo sheet shows a message instead of the circle list.

### Step 4: Add an AI key (optional)

The app works without a key using its built-in rules parser. To use an LLM, set any OpenAI-compatible endpoint:

```
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=your-key-here
LLM_MODEL=qwen/qwen3.8-27b
```

A second provider can be set through `LLM2_BASE_URL`, `LLM2_API_KEY` and `LLM2_MODEL` as a fallback.

### Step 5: Install and start

```bat
npm install
npm run dev
```

Open http://localhost:3000.

## Run the Chainlink workflow

The workflow lives in `cowrie-cre/` and needs the Chainlink CRE CLI.

```bash
cre workflow simulate my-workflow
```

It reads `config.staging.json`, which points at the live `AjoCircle` and `AjoKeeper` on Monad testnet and the BTC/USD feed on Monad mainnet, and it delivers reports through the mock forwarder. `config.production.json` still holds the CRE template defaults and needs the same Monad entries before it means anything.

## Where Cowrie is going

Cowrie today is a working consumer wallet with real on-chain DeFi inside it, real ajo circles with contract-enforced payouts, and a Chainlink workflow doing the parts a group would otherwise have to trust each other for. The larger aim is to be how ordinary people reach Monad DeFi at all.

**Credit.** You would borrow against what you already hold. Your savings and token balances back an over-collateralised line of credit, drawn and repaid in plain language ("borrow 50,000 against my savings"), with the loan's health tracked for you so a position is not liquidated out from under you.

**Deeper markets.** The swap pools and prediction market ship seeded with faucet liquidity for the demo, and `resolveMarket` is open to anyone on testnet so the market can be demoed end to end. In production they move to real liquidity across Monad venues, the resolver moves behind an oracle or a committee, and the question book opens up so anyone can take a side on anything.

**Payments network.** Requesting money, splitting a bill, and paying another Cowrie user already work. After that comes QR scan-to-pay at a till, recurring payouts like payroll, and a merchant side that settles instantly in stablecoin while the customer still thinks in naira.

**Protocol routing.** Because every action is a sentence first and a contract call second, Cowrie can route someone into any protocol on Monad without them knowing it is there. Staking, lending, new markets, and whatever launches next become things you ask for rather than apps you hunt down.

What is live and what is planned stays honest throughout. The savings vault, swap pools, prediction market, payments, bills, caps, allowances, auto-save, Guardian's Chainlink watches, and the ajo circles with their Chainlink-drawn order and automatic settlement are all built and running on Monad testnet. Three things are still simulation-grade: the ajo draw and settlement run through CRE in simulation against a mock forwarder rather than on Chainlink's network, the yield in the savings vault is faucet-funded test money rather than a real source of return, and the prediction market's resolver is deliberately open on testnet. Credit, real liquidity routing and merchant rails are the roadmap.

## Repo layout

| Path | What is in it |
|---|---|
| `contracts/` | Solidity source: PolicyVault, ScamRegistry, MockUSD, MockAsset, AjoCircle, AjoKeeper |
| `test/` | Hardhat tests for AjoCircle, invite-only circles and AjoKeeper |
| `scripts/` | Deploy, seed, env sync, and the ajo demo and inspection helpers |
| `cowrie-cre/` | Chainlink CRE project: the cron workflow that draws orders and settles rounds |
| `web/` | Next.js 14 app with Privy auth, viem, the chat interface and the Ajo agent |
| `docs/` | Banner SVG |
| `hardhat.config.js` | Hardhat setup: Solidity 0.8.28, cancun EVM, monadTestnet network |
| `deployments.json` | Written by the deploy scripts; holds the live contract addresses |

## License

MIT. See [LICENSE](LICENSE).
