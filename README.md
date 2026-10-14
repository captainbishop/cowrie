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

Most people never touch crypto, and the wallets are the reason. There is a seed phrase to lose, a gas token you must buy before you can move a single cent, and a 42-character address to paste where one wrong letter hands your money to a stranger. And even a normal bank app only shows you the damage after the fact. It will not stop you overspending, save on your behalf, or warn you before a subscription bills again.

Cowrie is a stablecoin wallet you talk to. You say what you want, in plain English, Pidgin, Igbo, Yoruba, Hausa or your own language, and it happens on-chain in under a second: send money, save a slice of everything you earn, cap your spending, pay someone a daily allowance, grow your balance in a savings vault, or track a subscription. Every payment is checked against a scam list before it leaves your wallet. You sign in with Google, so there is no seed phrase, the fees are too small to notice, and every amount shows in your own currency.

It runs on Monad, where everything settles in well under a second. Fast enough that saying a thing and watching it happen feel like the same moment.

## What Cowrie does

Cowrie puts a whole financial life behind one sentence. What normally takes a bank app, a bureau de change, a bills app and a crypto exchange, Cowrie does from a single chat and settles each one on-chain in under a second.

**Pay and get paid.** Say "send 5,000 to Mum", "buy 500 airtime for 0803...", "pay my light bill", "request 3,000 from Tunde", or "split 30,000 three ways". Cowrie makes the payment. For a bill it asks for any missing details before a kobo moves.

**Put money on rules that enforce themselves.** Say "save 10% of everything I receive", "don't let me spend more than 20,000 a day", or "give my son 2,000 a day". Those rules live on-chain inside `PolicyVault`, not on the honour system.

**Grow and hedge without leaving the app.** Say "grow my savings" or "earn 50,000" and Cowrie moves that amount into its on-chain savings vault, which accrues yield at 10% APR (demo rate) and lets you withdraw any time. Say "swap 10,000 into bitcoin" and it trades through a constant-product AMM pool built inside the contract, giving you cBTC, cETH, or cGOLD to hold and sell back whenever. Say "bet 5,000 that Bitcoin tops $100k" and you stake on a parimutuel YES/NO market you settle and claim yourself.

**Safety by default.** Every send goes through `ScamRegistry.isFlagged()` before leaving. An address is blocked when the owner flags it or when it has been reported three or more times by community members.

## At a glance

| | |
|---|---|
| Chain | Monad testnet (chain ID 10143) |
| Contracts | PolicyVault, ScamRegistry, MockUSD |
| App | Next.js 14, Privy, viem |
| AI assistant | Any OpenAI-compatible model; Gemini by default; a rules-based fallback if no key is set |
| DeFi inside Cowrie | Savings vault (10% APR), constant-product swap pools (cBTC, cETH, cGOLD), parimutuel prediction markets |
| Everyday actions | Airtime, bills, ticket payments, money requests, bill splitting |
| Currencies shown | NGN, USD, GHS, KES, ZAR, GBP, EUR, INR |
| Languages | English, Nigerian Pidgin, Igbo, Yoruba, Hausa, French, Swahili, Arabic, Portuguese, Hindi |

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

What is live and what is planned stays honest throughout. The savings vault, swap pools, prediction market, payments, bills, caps, allowances, and auto-save in this repo are built and deployed on Monad testnet today. Credit, real liquidity routing, the on-chain resolver, and merchant rails are the roadmap.

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
