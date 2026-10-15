<p align="center">
  <img src="docs/banner.svg" alt="Cowrie, talk to your money, on Monad" width="100%">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Monad-testnet-836EF9?style=flat-square" alt="Monad testnet">
  <img src="https://img.shields.io/badge/Solidity-0.8.28-363636?style=flat-square" alt="Solidity 0.8.28">
  <img src="https://img.shields.io/badge/Next.js-14-000000?style=flat-square" alt="Next.js 14">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square" alt="TypeScript 5">
  <img src="https://img.shields.io/badge/license-MIT-22c55e?style=flat-square" alt="MIT license">
  <img src="https://img.shields.io/badge/PRs-welcome-6c4ae6?style=flat-square" alt="PRs welcome">
</p>

# Cowrie

Live app: https://cowrie-amber.vercel.app

Cowrie began as a question I wanted an honest answer to. Can the serious infrastructure in crypto right now, Monad for speed, Privy for sign-in and Chainlink for verifiable data, survive contact with ordinary Nigerian life? Not life as a whitepaper imagines it, but the version where someone sends ₦5,000 to their mother, buys MTN airtime for a cousin, runs an ajo with three friends, and has never once wanted to see a seed phrase.

So I built for that person first, in their language and their currency, around savings habits they already have, and let the technology prove itself there.

The order matters. Facebook was a Harvard student directory before it was a global network. Amazon sold only books, in one country. M-Pesa moved money between Kenyan kiosks for years before it became the reference for mobile money everywhere. Things that last usually go narrow and deep somewhere real, then widen. Cowrie is deliberately narrow: naira on the balance by default, Pidgin in the chat, ajo on the home screen.

## About

Most people here never touch crypto, and wallets are the reason. There is a seed phrase to lose, a gas token you have to buy before you can move a single cent, and a 42-character address where one wrong letter hands your money to a stranger. A normal bank app is not much kinder. It shows you the damage after the fact, and it will not stop you overspending, save on your behalf, or warn you before a subscription bills again.

Cowrie is a stablecoin wallet you talk to. You say what you want, in English, Pidgin, Igbo, Yoruba, Hausa or your own language, and it happens on-chain in under a second: send money, save a slice of everything you earn, cap your spending, pay an allowance, grow your balance in a savings vault, swap into bitcoin, back a prediction, run an ajo circle, or have Chainlink watch a price for you. Every payment is checked against a scam list before it leaves. You sign in with Google, so there is no seed phrase, gas is sponsored, and every amount shows in your own currency.

It runs on Monad, where everything settles in well under a second, fast enough that saying a thing and watching it happen feel like the same moment.

## What Cowrie does

Cowrie puts a whole financial life behind one sentence. What normally takes a bank app, a bureau de change, a bills app and a crypto exchange, Cowrie does from a single chat and settles each one on-chain in under a second.

Paying and getting paid is the core. Say "send 5,000 to Mum", "buy 500 airtime for 0803...", "pay my light bill", "book a flight to Lagos", "clear my shopping cart", "request 3,000 from Tunde", or "split 30,000 three ways", and Cowrie makes the payment. For anything with missing details it asks first, so airtime gets a network and a number and a ticket gets an event and a tier before a kobo moves. People you pay often get saved by name, either from the People tab or by telling Cowrie "0x12…ab save as Mum", and from then on their name is enough. When money arrives from someone else, Cowrie reads it off the chain and tells you, so a credit shows up in your history instead of appearing silently in your balance.

Rules are the part a bank app never gives you. Say "save 10% of everything I receive", "don't let me spend more than 20,000 a day", or "give my son 2,000 a day", and those rules live inside `PolicyVault` in Solidity rather than on the honour system.

Growing money happens in the app, not somewhere else. Say "grow my savings" or "earn 50,000" and Cowrie moves that into its own on-chain savings vault, which accrues at 10% a year in this demo and lets you withdraw any time. Say "swap 10,000 into bitcoin" and it trades through a constant-product pool inside the contract, giving you cBTC, cETH or cGOLD to hold and sell back. Say "bet 5,000 that Bitcoin tops $100k" and you take a side on a parimutuel market you settle and claim yourself. Ask for a price and you get Chainlink's live number, not a guess.

Ajo is the feature I most wanted to exist. It is the rotating savings circle Nigerians already run with people they trust, rebuilt so the turn order cannot be rigged and each contribution settles on-chain. There is a countdown to the next cycle, one tap to pay the person whose turn it is, and when your turn comes Cowrie pings the rest of the group with a request each.

Safety is on by default. Every send goes through `ScamRegistry.isFlagged()` before leaving, and an address is blocked once the owner flags it or three people report it.

The assistant speaks like the person using it. It mirrors whatever language you wrote in, switches the moment you switch, and understands both market slang and the local kind, so "gmonad" and "abeg send 5k give my mama" both land. It remembers what matters, keeps your saved facts and contacts in view, and conversations worth keeping can be saved and reopened from the Chats tab.

## At a glance

| | |
|---|---|
| Chain | Monad testnet (chain ID 10143) |
| Contracts | PolicyVault, ScamRegistry, MockUSD |
| App | Next.js 14, Privy, viem |
| AI assistant | Qwen 3.8 (Alibaba) served on Groq's free tier, with Gemini as an automatic fallback and a rules parser if no key is set |
| Oracle | Chainlink price feeds on Monad mainnet, read-only, powering Guardian and the Ajo draw |
| DeFi inside Cowrie | Savings vault (10% APR), constant-product swap pools (cBTC, cETH, cGOLD), parimutuel prediction markets |
| Everyday actions | Airtime, bills, flights, online shopping and carts, ticket payments, money requests, bill splitting |
| Social saving | Ajo circles with a Chainlink-drawn turn order and a cycle countdown |
| Currencies shown | NGN by default, plus USD, GHS, KES, ZAR, GBP, EUR, INR |
| Languages | English, Nigerian Pidgin, Igbo, Yoruba, Hausa, French, Swahili, Arabic, Portuguese, Hindi |

## Chainlink inside Cowrie

Chainlink usually gets bolted onto a trading contract to read a price. Cowrie points it at two things an ordinary user actually feels.

Guardian is a price watch you set in words. Say "watch bitcoin and alert me if it drops below $90,000" and Cowrie checks Chainlink's BTC/USD and ETH/USD feeds every 45 seconds, then acts the moment your level is crossed: telling you, moving money into savings, or offering the trade. The Guardian card on the home screen shows the live feed value, so the number on screen is the oracle's number rather than something Cowrie made up.

Ajo uses Chainlink as a fairness beacon, which is the part I am proudest of. In a rotating savings circle the only thing people really argue about is who collects first. Cowrie decides that with a seeded shuffle whose seed is the live Chainlink BTC price at the moment the circle is created, a public figure no member controls or can predict, and the card shows the exact price it used. Nobody has to trust the organiser, and that is a tool crypto can offer a very old Nigerian habit.

Chainlink's push feeds are live on Monad mainnet rather than testnet, so Cowrie reads them from mainnet with a read-only client while your money stays on testnet. The read costs no gas and needs no credentials.

| Feed | Address on Monad mainnet |
|---|---|
| BTC / USD | `0x187efD8ba8483105f2735740D956f7CD23723deC` |
| ETH / USD | `0x38057D0458ca56068e1A57E62D3874cA129A7A78` |

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

**`ScamRegistry`** is the on-chain blocklist. The owner can flag or clear any address with `setFlag`. Anyone can `report` an address; three reports auto-flag it. `PolicyVault` reads `isFlagged()` before every send.

**`MockUSD`** is a 6-decimal test stablecoin (cUSD) that anyone can mint on testnet. `PolicyVault` uses the same `IMintableUSD` interface to mint yield rewards directly into itself.

## Deployed on Monad testnet

| Contract | Address |
|---|---|
| PolicyVault | `0x9EE0a2cA7916374Cb13ED323132fD8832D5ddd9F` |
| ScamRegistry | `0x7502309ec1462Db5720C68464DeB942AA2e8d2ED` |
| MockUSD (cUSD) | `0x1ED39f9810ceB817F48Bf576784F76cdc74ddcee` |

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

`newkey.js` creates a throwaway testnet wallet and writes `PRIVATE_KEY` and `MONAD_RPC` into `.env`. If `.env` already has a valid key it prints the existing address and exits without changing anything.

The output will print your address:

```
YOUR ADDRESS:  0xYourAddressHere
```

Copy that address.

### Step 3: Fund the deployer with test MON

Go to https://faucet.monad.xyz, paste the address from Step 2, and request test MON. You need a small amount for gas; the faucet covers more than enough.

### Step 4: Compile the contracts

```bat
npm run compile
```

Hardhat compiles all `.sol` files in `contracts/` with Solidity 0.8.28 and the `cancun` EVM target.

### Step 5: Deploy to Monad testnet

```bat
npm run deploy
```

This runs `scripts/deploy.js`, which:

1. Deploys `MockUSD` (the test stablecoin).
2. Deploys `ScamRegistry` (the on-chain blocklist).
3. Deploys `PolicyVault` with the addresses of the two contracts above.
4. Writes all three addresses plus the deployer address to `deployments.json`.
5. Calls `scripts/syncenv.js` to copy those addresses into `web/.env.local` automatically.

### Step 6: Seed the demo state

```bat
npm run seed
```

This runs `scripts/seed.js`, which:

1. Mints 500 cUSD into your vault spendable balance via `mintAndDeposit`.
2. Flags `0x000000000000000000000000000000000000dEaD` as a scam address in `ScamRegistry`.
3. Sets your auto-save rule to 10% via `setAutosave(1000)`.
4. Deploys three mock asset tokens (cBTC, cETH, cGOLD), mints the right reserves, and seeds an AMM pool for each one inside `PolicyVault`.
5. Creates two prediction markets ("Will Bitcoin close above $100k this year?" and "Will the Super Eagles win their next match?") with initial YES and NO stakes, if no markets exist yet.

## Run the web app

### Step 1: Copy the environment file

```bat
cd web
copy .env.local.example .env.local
```

After `npm run deploy` the contract addresses are already written to `web/.env.local` by `syncenv.js`. You only need to fill in two more values.

### Step 2: Add your Privy app ID

Sign in at https://dashboard.privy.io and create an app if you do not have one. Copy the App ID and paste it as:

```
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
```

### Step 3: Add an AI key (optional)

The chat interface works without a key using its built-in rules-based parser. To use an LLM, set:

```
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=your-key-here
LLM_MODEL=gpt-4o-mini
```

Any OpenAI-compatible endpoint works here, including Gemini's OpenAI-compatible API.

### Step 4: Install dependencies and start the dev server

```bat
npm install
npm run dev
```

Open http://localhost:3000.

## Where Cowrie is going

Cowrie today is a working consumer wallet with real on-chain DeFi inside it: a savings vault that pays yield, token pools you swap against, and a prediction market you settle yourself. The larger aim is to be the way ordinary people reach Monad DeFi at all.

**Credit.** You would borrow against what you already hold. Your savings and token balances back an over-collateralised line of credit, drawn and repaid in plain language ("borrow 50,000 against my savings"), with the loan's health tracked for you so a position is not liquidated out from under you.

**Deeper markets.** The swap pools and prediction market ship seeded with faucet liquidity for the demo. In production they move to real liquidity routed across Monad venues, and the prediction market gets an on-chain resolver and a public question book so anyone can take a side on anything.

**Payments network.** Requesting money, splitting a bill, and paying another Cowrie user already work. After that comes QR scan-to-pay at a till, recurring payouts like payroll and allowances, and a merchant side that settles instantly in stablecoin while the customer still thinks in naira.

**Protocol routing.** Because every action is a sentence first and a contract call second, Cowrie can route someone into any protocol on Monad without them knowing it is there. Staking, lending, new markets, and whatever launches next become things you ask for rather than apps you hunt down.

What is live and what is planned stays honest throughout. The savings vault, swap pools, prediction market, payments, bills, caps, allowances, auto-save, Guardian's Chainlink watches and the Ajo circles with their Chainlink-drawn order are built and running today, with every payment settling on Monad testnet. Ajo's rules are currently kept by the app rather than escrowed in a contract, so the next step there is putting the contribution schedule on-chain, where joining a circle means signing up to rules the contract enforces instead of the group chasing each other. Credit, real liquidity routing, the on-chain resolver and merchant rails are the roadmap.

## Repo layout

| Path | What is in it |
|---|---|
| `contracts/` | Solidity source: PolicyVault, ScamRegistry, MockUSD, MockAsset |
| `scripts/` | deploy.js, seed.js, newkey.js, fund.js, syncenv.js |
| `web/` | Next.js 14 app with Privy auth, viem, and the AI chat interface |
| `docs/` | Banner SVG |
| `hardhat.config.js` | Hardhat setup: Solidity 0.8.28, cancun EVM, monadTestnet network |
| `deployments.json` | Written by deploy.js; holds the live contract addresses |

## License

MIT. See [LICENSE](LICENSE).
