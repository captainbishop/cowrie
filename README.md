# Cowrie — talk to your money

Conversational, gasless stablecoin money on Monad. Set money rules in plain
English, send and remit instantly, and get stopped before you pay a scammer.

This folder holds the on-chain layer (Hardhat). The web app will live in `web/`.

## Run the contracts (Windows, inside this folder)

```bat
npm install
copy .env.example .env
:: paste your Monad testnet private key into .env, then:
npm run compile
npm run deploy
npm run seed
```

`npm run deploy` prints the three contract addresses and writes `deployments.json`.
`npm run seed` funds your vault, flags a demo scam address, and turns on a 10% auto-save rule.

## What's here
- `contracts/MockUSD.sol` — 6-decimal test stablecoin (cUSD), public mint for the demo.
- `contracts/ScamRegistry.sol` — community blocklist; `isFlagged()` gates every send.
- `contracts/PolicyVault.sol` — holds cUSD and enforces rules: auto-save %, daily
  spend cap, streaming allowance, and a scam-guarded send.

Network: Monad testnet (chainId 10143, RPC https://testnet-rpc.monad.xyz).
Get test MON gas from https://faucet.monad.xyz.
