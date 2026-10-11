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

Most people never touch crypto, and the wallets are the reason. There is a seed phrase to lose, a gas token you must buy before you can move a single cent, and a 42-character address to paste where one wrong letter hands your money to a stranger you will never get it back from. And even a normal bank app only shows you the damage after the fact. It won't stop you overspending, save on your behalf, or warn you before a subscription bills again.

Cowrie is a stablecoin wallet you talk to. You say what you want, in plain English, Pidgin, Igbo, Yoruba, Hausa or your own language, and it happens on-chain in under a second: send money, save a slice of everything you earn, cap your spending, pay someone a daily allowance, grow your balance in a savings vault, or track a subscription. Every payment is checked against a scam list before it leaves your wallet. You sign in with Google, so there is no seed phrase, the fees are too small to notice, and every amount shows in your own currency.

It runs on Monad, where everything settles in well under a second. Fast enough that saying a thing and watching it happen feel like the same moment.

## What it does

Cowrie puts a whole financial life behind one sentence. What normally takes a bank app, a bureau de change, a bills app and a crypto exchange, Cowrie does from a single chat, in plain English, Pidgin, Igbo, Yoruba, Hausa and more, and settles each one on-chain in under a second.

Pay and get paid: "send ₦5,000 to Mum", "buy ₦500 airtime for 0803...", "pay my light bill", "request ₦3,000 from Tunde", "split ₦30,000 three ways". It makes the payment, and for a bill it asks for the details it needs before a kobo moves.

Put money on rails that enforce themselves: "save 10% of everything I receive", "don't let me spend more than ₦20,000 a day", "give my son ₦2,000 a day". The rules live on-chain, not on the honour system.

Grow and hedge without leaving the app: "grow my savings" earns yield in Cowrie's own vault, "swap ₦10,000 into bitcoin" trades through its own pools, and "bet ₦5,000 that Bitcoin tops $100k" takes a side on an on-chain market you settle and claim yourself.

Underneath, every hard edge of crypto is hidden. You sign in with Google so there is no seed phrase, the gas is too small to notice, and balances show in naira. Every payment is checked against a scam list before it leaves, and the assistant replies in whatever language you wrote in. Simple enough for someone who has never touched crypto, but deep enough to run your money on.

## At a glance

| | |
|---|---|
| Chain | Monad testnet (chain id 10143) |
| Contracts | PolicyVault, ScamRegistry, MockUSD |
| App | Next.js, Privy, viem |
| Assistant | any OpenAI-compatible model, Gemini by default, with a no-key fallback |
| Earn, trade, predict | all on-chain inside Cowrie: a savings vault, token swap pools, and a prediction market |
| Everyday | pay airtime, bills and tickets, request money, split a bill |
| Currencies shown | NGN, USD, GHS, KES, ZAR, GBP, EUR, INR |
| Languages | English, Nigerian Pidgin, Igbo, Yoruba, Hausa, French, Swahili, Arabic, Portuguese, Hindi |

## How it works

`PolicyVault` holds each person's balance and enforces the rules on-chain: it splits a percentage of money received into savings, blocks a send over the daily cap, streams allowances, and reverts a send to any address `ScamRegistry` has flagged. `ScamRegistry` is the reportable scam list. `MockUSD` is a 6-decimal test stablecoin (cUSD) anyone can mint on testnet. The web app signs you in with Privy and turns your words into those on-chain calls.

## Earning, trading, and predicting

Earning, trading and predicting are all built in, and nothing opens an outside app. Say "grow my savings" or "earn 50,000" and Cowrie moves that into its own on-chain savings vault at a set rate, to withdraw anytime. Say "swap 10,000 into bitcoin" and it trades through Cowrie's own on-chain pools, a constant-product AMM like a DEX uses, into cBTC, cETH or cGOLD, which you hold and sell back whenever. Say "bet 5,000 that Bitcoin tops $100k" and you stake on a yes or no market and claim your winnings when it resolves. On testnet the pools, the yield and the markets are seeded with faucet funds; in production they would use real liquidity and a resolver.

## Where Cowrie is going

Cowrie today is a working consumer wallet with real on-chain DeFi inside it: a savings vault that pays yield, token pools you swap against, and a prediction market you settle yourself. The larger aim is to be the way ordinary people reach Monad DeFi at all. Monad is fast and cheap enough to run a whole retail bank on-chain, yet the people who would use one will never open a DEX, read a yield dashboard, or sign a raw transaction. Cowrie hides all of that behind a sentence: you ask for a thing, and the right contract call happens. That is what can make it a front door to the Monad economy instead of one more app to find.

Credit comes next. You would borrow against what you already hold, so your savings and token balances back an over-collateralized line of credit, drawn and repaid in plain language ("borrow ₦50,000 against my savings"), with the loan's health tracked for you so a position is not liquidated out from under you. No bank and no paperwork, settled on Monad.

The markets get deeper. The swap pools and the prediction market ship seeded with faucet liquidity for the demo; in production they move to real liquidity routed across Monad venues, and the market gets an on-chain resolver and a public question book so anyone can take a side on anything.

The wallet grows into a payments network. Requesting money, splitting a bill, and paying another Cowrie user already work. After that comes QR scan-to-pay at a till, recurring payouts like payroll and allowances, and a merchant side that settles instantly in stablecoin while the customer still thinks in naira.

And because every action is a sentence first and a contract call second, Cowrie can route someone into any protocol on Monad without them learning it is there. Staking, lending, new markets, and whatever launches next become things you ask for rather than apps you hunt down. Cowrie ends up as the consumer layer the rest of the ecosystem plugs into.

What is live and what is planned stays honest throughout. The savings vault, swap pools, prediction market, payments, bills, caps, allowances, and autosave in this repo are built and deployed on Monad testnet today. Credit, real liquidity routing, the on-chain resolver, and merchant rails are the roadmap, not claims about today.

## Run the contracts

From the repo root on Windows:

```bat
npm install
node scripts\newkey.js
```

`newkey.js` creates a throwaway testnet account and writes it to `.env`. Fund that address with test MON from https://faucet.monad.xyz, then:

```bat
npm run compile
npm run deploy
npm run seed
```

`deploy` writes the three addresses to `deployments.json` and fills them into `web/.env.local` for you. `seed` mints you some test cUSD, flags a demo scam address, and turns on a 10% auto-save rule.

## Run the app

```bat
cd web
copy .env.local.example .env.local
```

The contract addresses are already in `.env.local` from the deploy step. Add your Privy app id (https://dashboard.privy.io) and an optional AI key (any OpenAI-compatible endpoint), then:

```bat
npm install
npm run dev
```

Open http://localhost:3000.

## Deployed on Monad testnet

- PolicyVault: `0x7fEC14BF2e5B97DBec2fc7030208eB7690BEc8bF`
- ScamRegistry: `0xB096E6FCEd6b0d6593ED7050307611999259Ff4e`
- MockUSD (cUSD): `0xbc477a253B2b65CB8111aa7598De3a19eF4f43C4`

Explorer https://testnet.monadexplorer.com, RPC https://testnet-rpc.monad.xyz, faucet https://faucet.monad.xyz.

## Repo layout

- `contracts/` the Solidity (Hardhat).
- `scripts/` deploy, seed, key generator, wallet funder.
- `web/` the Next.js app.
- `docs/` the banner.

## License

MIT. See [LICENSE](LICENSE).
