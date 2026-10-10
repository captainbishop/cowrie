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

Talk to your money. Cowrie is a stablecoin wallet on Monad where you say what you want in plain language and it happens: send money, save a share of what you receive, cap your daily spending, give someone a daily allowance, and track subscriptions so you get reminded before each renewal. Every payment is checked against a scam-address list before it leaves your wallet.

When an AI key is connected the assistant understands free-form requests, including Nigerian Pidgin, and offers tap-to-pick options instead of making you type. Without a key it falls back to a built-in parser so the app still works.

## What it does

- Send money by saved name or wallet address, with a scam check before every payment.
- Save a set percentage of everything you receive, automatically.
- Cap how much you can spend in a day.
- Give someone a daily allowance that tops itself up.
- Track subscriptions and bills, with a reminder before each one is due to pay or cancel.
- Sign in with Google through Privy, no seed phrase, with amounts shown in your own currency.

## At a glance

| | |
|---|---|
| Chain | Monad testnet (chain id 10143) |
| Contracts | PolicyVault, ScamRegistry, MockUSD |
| App | Next.js, Privy, viem |
| Currencies shown | NGN, USD, GHS, KES, ZAR, GBP, EUR, INR |

## How it works

`PolicyVault` holds each person's balance and enforces the rules on-chain: it splits a percentage of money received into savings, blocks a send over the daily cap, streams allowances, and reverts a send to any address `ScamRegistry` has flagged. `ScamRegistry` is the reportable scam list. `MockUSD` is a 6-decimal test stablecoin (cUSD) anyone can mint on testnet. The web app signs you in with Privy and turns your words into those on-chain calls.

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

`deploy` writes the three addresses to `deployments.json`. `seed` mints you some test cUSD, flags a demo scam address, and turns on a 10% auto-save rule.

## Run the app

```bat
cd web
copy .env.local.example .env.local
```

Put your Privy app id (https://dashboard.privy.io), the three addresses from `deployments.json`, and an optional AI key (any OpenAI-compatible endpoint) into `.env.local`, then:

```bat
npm install
npm run dev
```

Open http://localhost:3000.

## Deployed on Monad testnet

- PolicyVault: `0x63A4A7Df86B7E9E76Cf4488ACB5bc5131262FBF7`
- ScamRegistry: `0xed9e8390200a6d12c3780E9a36a292c1c9d194Dd`
- MockUSD (cUSD): `0xecB5a014cdD0a79637E70001314851300fCa3cAC`

Explorer https://testnet.monadexplorer.com, RPC https://testnet-rpc.monad.xyz, faucet https://faucet.monad.xyz.

## Repo layout

- `contracts/` the Solidity (Hardhat).
- `scripts/` deploy, seed, key generator, wallet funder.
- `web/` the Next.js app.
- `docs/` the banner.

## License

MIT. See [LICENSE](LICENSE).
