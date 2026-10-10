# Cowrie

Talk to your money. Cowrie is a stablecoin wallet on Monad where you say what you want in plain language and it happens: send money, save a percentage of what you receive, cap your daily spending, give someone a daily allowance, and track subscriptions so you get reminded before each renewal. Every payment is checked against a scam-address list before it leaves your wallet.

It runs on Monad testnet with a test stablecoin. When an AI key is connected the assistant understands free-form requests, including Nigerian Pidgin; without one it falls back to a built-in parser so the app still works.

## What's in the repo

- `contracts/` is the Solidity (Hardhat):
  - `PolicyVault.sol` holds each person's balance and enforces the rules: auto-save a percentage of money received, a daily spend cap, streaming allowances, and a send that reverts if the recipient is flagged.
  - `ScamRegistry.sol` is the reportable scam-address list that `PolicyVault` checks on every send.
  - `MockUSD.sol` is a 6-decimal test stablecoin (cUSD) that anyone can mint on testnet.
- `scripts/` has deploy, seed, a throwaway-key generator, and a wallet funder.
- `web/` is the app (Next.js): Privy sign-in, the chat screen, the balance card, People (saved addresses), Add (top up), and Reminders.

## Run the contracts

From this folder on Windows:

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

Chain id 10143, RPC https://testnet-rpc.monad.xyz, explorer https://testnet.monadexplorer.com, faucet https://faucet.monad.xyz.
