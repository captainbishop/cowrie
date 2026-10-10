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

Cowrie is a stablecoin wallet you talk to. You say what you want, in plain English or Nigerian Pidgin, and it happens on-chain in under a second: send money, save a slice of everything you earn, cap your spending, pay someone a daily allowance, grow your balance in a savings vault, or track a subscription. Every payment is checked against a scam list before it leaves your wallet. You sign in with Google, so there is no seed phrase, the fees are too small to notice, and every amount shows in your own currency.

It runs on Monad, where everything settles in well under a second. Fast enough that saying a thing and watching it happen feel like the same moment.

## What it does

Talk to it the way you would text a friend who handles money for you:

- "Send ₦5,000 to Mum." It pays her by name, after checking the address against a scam list.
- "Save 10% of everything I receive." A tenth of every payment slips into savings on its own.
- "Don't let me spend more than ₦20,000 a day." The cap holds on-chain, not on the honour system.
- "Give my son ₦2,000 a day." A streaming allowance that tops itself up while you sleep.
- "Grow my savings." Your money moves into Cowrie's vault and earns yield, and you pull it out whenever.
- "Remind me before Netflix renews." It tracks your subscriptions and nudges you to pay or cancel in time.
- "What's my balance?" The real number, read straight off the chain, never a guess.

When an AI key is connected it understands free-form requests, remembers what you have told it and the rest of the conversation, and answers in your language, Pidgin included. Without one it falls back to a built-in parser, so the app still works. The screen responds as you go too, warming when your balance runs low and taking a brand's colour when you mention one.

## At a glance

| | |
|---|---|
| Chain | Monad testnet (chain id 10143) |
| Contracts | PolicyVault, ScamRegistry, MockUSD |
| App | Next.js, Privy, viem |
| Assistant | any OpenAI-compatible model, Gemini by default, with a no-key fallback |
| Earn | Cowrie savings vault, on-chain, withdraw anytime |
| Trade and predict | links to Kuru, Polymarket, and the Monad app directory |
| Currencies shown | NGN, USD, GHS, KES, ZAR, GBP, EUR, INR |

## How it works

`PolicyVault` holds each person's balance and enforces the rules on-chain: it splits a percentage of money received into savings, blocks a send over the daily cap, streams allowances, and reverts a send to any address `ScamRegistry` has flagged. `ScamRegistry` is the reportable scam list. `MockUSD` is a 6-decimal test stablecoin (cUSD) anyone can mint on testnet. The web app signs you in with Privy and turns your words into those on-chain calls.

## Earning, trading, and predicting

Earning is built in. Say "grow my savings" or "earn 50,000" and Cowrie moves that amount from your spendable into its own on-chain savings vault, where it grows at a set rate and you can withdraw anytime. On testnet the yield is simulated and funded by the faucet mint; a production version would route to a real yield source.

Trading and prediction markets happen in apps built for them, so Cowrie points you to one and opens it in a new tab for you to connect your own wallet:

- Trade: Kuru, an on-chain order-book exchange on Monad.
- Predict: Polymarket, for backing real-world outcomes.

There is a link to the Monad app directory as well, for finding more.

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

- PolicyVault: `0x213498cED496053683626F1928Db992bA770F633`
- ScamRegistry: `0xB50776D03C92789b61A048fb7dA5B02fC0E3f7f7`
- MockUSD (cUSD): `0x5C191aC746aD6cE5fb9357e000057Fe9087B7a03`

Explorer https://testnet.monadexplorer.com, RPC https://testnet-rpc.monad.xyz, faucet https://faucet.monad.xyz.

## Repo layout

- `contracts/` the Solidity (Hardhat).
- `scripts/` deploy, seed, key generator, wallet funder.
- `web/` the Next.js app.
- `docs/` the banner.

## License

MIT. See [LICENSE](LICENSE).
