# Cowrie's Chainlink CRE workflow

[Cowrie](../README.md) uses Chainlink CRE to draw Ajo payout orders, settle rounds and pull contributions from members who enabled auto-pay. Price data comes from Monad mainnet; circle funds and report transactions stay on Monad testnet.

[Workflow source](my-workflow/workflow.ts) · [AjoCircleV2](../contracts/AjoCircleV2.sol) · [AjoKeeperV2](../contracts/AjoKeeperV2.sol) · [CRE documentation](https://docs.chain.link/cre)

The current setup runs through **CRE simulation and a mock forwarder**. It has not been registered as a deployed workflow on Chainlink's network. Adding `--broadcast` to a simulation sends actual testnet transactions.

## What runs each time

The configured cron is `0 */1 * * * *`, once a minute. Each invocation scans the newest 30 circles, starting with the most recent, and chooses at most one action per circle:

| Circle state | Action |
|---|---|
| Full, awaiting a draw | Read BTC/USD from Chainlink, derive a seed, shuffle the member list and report the payout order. |
| Active and due | Report a settlement, paying the collector and starting the next round if one remains. |
| Active, not due, with no bulk pull attempted this round | If any members enabled auto-pay, report a bulk contribution pull. |

Other circles are skipped. A failure for one circle is logged and does not stop the scan. Older circles outside the scan window need a wider scan or manual contract calls.

The workflow reads the price once per invocation, only if a draw is needed. It calculates `floor(answer * 1000 / 10^decimals)` and uses that seed for a deterministic shuffle. The contract stores the order and seed. **This is a price-seeded demo draw, not Chainlink VRF or unpredictable randomness.**

Auto-pay depends on each member opting in, holding enough wallet cUSD and approving the circle contract. `pullAll` skips failed transfers and records the bulk attempt for that round. Members can pay manually if their share was not collected.

Settlement becomes callable after the round timer ends. Contributions plus deductions from remaining deposits form the payout; exhausted deposits can leave a shortfall. The contract also permits anyone to settle, and has an owner-configurable fallback draw if the authorised drawer does not arrive in time. See [Ajo behaviour](../README.md#ajo-savings-circles).

## Report path

The workflow creates an ECDSA-signed CRE report and sends it with the EVM write capability:

```text
Cron trigger
  -> read AjoCircleV2 on Monad testnet
  -> read BTC/USD on Monad mainnet if a draw is needed
  -> sign and write report
  -> configured forwarder
  -> AjoKeeperV2.onReport
  -> AjoCircleV2.setOrder / settleRound / pullAll
```

The ABI-encoded payload is:

```text
uint8 action, uint256 id, address[] order, uint256 seed
```

| Action | Code | Payload details |
|---|---|---|
| Settle a round | `1` | Circle ID, empty order, zero seed |
| Record a draw | `2` | Circle ID, member permutation and seed |
| Pull auto-pay shares | `3` | Circle ID, empty order, zero seed |

[AjoKeeperV2](../contracts/AjoKeeperV2.sol) checks the sender against its configured forwarder and can optionally check an expected workflow ID. The keeper must also be an authorised drawer on `AjoCircleV2`. The [V2 deployment script](../scripts/deploy-v2.js) sets up that drawer permission and uses the testnet simulation forwarder.

## Configuration

[project.yaml](project.yaml) supplies the RPCs. [workflow.yaml](my-workflow/workflow.yaml) selects the entry point and config for each CLI target:

| Target | Entry point | Config |
|---|---|---|
| `staging-settings` | [main.ts](my-workflow/main.ts) | [config.staging.json](my-workflow/config.staging.json) |
| `production-settings` | [main.ts](my-workflow/main.ts) | [config.production.json](my-workflow/config.production.json) |

Both targets currently point to the same Monad Ajo V2 deployment. The `production-settings` name alone does not deploy a production workflow.

```json
{
  "schedule": "0 */1 * * * *",
  "mainnetChain": "monad-mainnet",
  "testnetChain": "monad-testnet",
  "btcFeed": "0x187efD8ba8483105f2735740D956f7CD23723deC",
  "ajoCircle": "0x0dD979486E6D7c9763CD4DdCf775c269Bb78c4f4",
  "ajoKeeper": "0x272b18a1a8fE717d74B97f0d241D9dcE76125FEe",
  "gasLimit": "1500000",
  "pullGasLimit": "3000000"
}
```

| Setting | Purpose |
|---|---|
| `schedule` | Six-field cron expression |
| `mainnetChain` | Chain selector name for the BTC/USD feed |
| `testnetChain` | Chain selector name for the Ajo contracts |
| `btcFeed` | Chainlink BTC/USD aggregator on Monad mainnet |
| `ajoCircle` / `ajoKeeper` | V2 deployment addresses from [deployments.json](../deployments.json) |
| `gasLimit` | Gas limit for draw and settlement reports |
| `pullGasLimit` | Gas limit for the bulk auto-pay report |

The RPC chain names must match the config. Mainnet uses `https://rpc.monad.xyz` (chain ID 143); testnet uses `https://testnet-rpc.monad.xyz` (chain ID 10143).

After redeploying Ajo, update the circle and keeper addresses in both configs and `NEXT_PUBLIC_AJO_CIRCLE` in the frontend. The root `syncenv` command does not update these values. The keeper's forwarder address is a contract setting, not a field in this workflow config.

## Install and simulate

Install [Bun](https://bun.sh/docs/installation) and the [CRE CLI](https://docs.chain.link/cre/getting-started/cli-installation), then sign in with the CLI. This workflow writes reports, so set `CRE_ETH_PRIVATE_KEY` in `cowrie-cre/.env` to your test signing key. This is separate from the root Hardhat `PRIVATE_KEY`. See the [simulation prerequisites](https://docs.chain.link/cre/guides/operations/simulating-workflows) for account and key setup.

From this directory (`cowrie-cre/`):

```sh
bun install --cwd ./my-workflow
cd my-workflow
bun run typecheck
cd ..
cre workflow simulate my-workflow --target staging-settings
```

The workflow depends on `@chainlink/cre-sdk`, `viem` and `zod`. A simulation executes an invocation of the trigger; it does not leave a scheduler running. Without broadcasting, its report writes are not persisted as testnet transactions.

The handler logs the circle count, draw seed when needed, actions and per-circle errors. It returns JSON with `circles` and an `actions` array whose entries contain `circle`, `action` and `tx`. An empty array can simply mean no scanned circle needs an action.

### Broadcast to Monad testnet

Configure the CRE CLI signing account and fund it with test MON from the [faucet](https://faucet.monad.xyz). Confirm that the keeper uses the simulation forwarder and is authorised to draw on the circle. Then run:

```sh
cre workflow simulate my-workflow --target staging-settings --broadcast
```

Inspect the reported transaction hashes in the [Monad testnet explorer](https://testnet.monadexplorer.com). The recorded simulation forwarder is [0xB9F79d863261869B234c481D1f9A7af84AeAd192](https://testnet.monadexplorer.com/address/0xB9F79d863261869B234c481D1f9A7af84AeAd192).

### Keep a demo running locally

From the repository root, run the [local runner](../scripts/cre-runner.sh) in Bash, Git Bash or WSL:

```sh
bash scripts/cre-runner.sh
```

This script repeatedly broadcasts non-interactive simulations and waits three seconds after each run. It uses trigger index `0` and skips CLI type checking, so run `bun run typecheck` in `my-workflow/` first. Stop it with `Ctrl+C`. Its loop frequency is separate from the workflow's one-minute cron configuration, and it only keeps working while the process is running.

For a recorded demonstration, use [recording-runner.sh](scripts/recording-runner.sh) from this directory after type checking:

```sh
bash scripts/recording-runner.sh /absolute/path/to/demo/evidence
```

It saves each complete CLI invocation in a separate `run-NN.log`, streams progress to `runner.log`, and stops when an invocation fails, reports an RPC health warning, or skips a circle because of an error. Restarting preserves the earlier logs. Create `stop.flag` in the evidence directory's parent to finish after the current invocation, or use `CRE_RUN_ONCE=1` for one invocation. These runs broadcast real Monad testnet transactions. Resolve any connection problem and inspect the prior transaction result before restarting.

## Moving beyond simulation

A deployed service needs workflow registration on Chainlink's network, the correct network forwarder, keeper workflow-ID configuration and operational monitoring. The scan currently covers only 30 circles, and the demo draw uses a price as its seed. Both need revisiting for broader use. The owner's `setForwarder` and workflow-ID settings support updating the receiver configuration, but changing those values alone does not deploy a workflow.

## Source map

| Path | Role |
|---|---|
| [my-workflow/main.ts](my-workflow/main.ts) | CRE runner entry point |
| [my-workflow/workflow.ts](my-workflow/workflow.ts) | Config schema, cron handler, shuffle and report encoding |
| [contracts/evm/ts/generated/](contracts/evm/ts/generated/) | TypeScript bindings for contract reads |
| [project.yaml](project.yaml) | RPC settings for both CLI targets |
| [my-workflow/workflow.yaml](my-workflow/workflow.yaml) | Entry point and per-target config paths |
| [../test/AjoV2.test.js](../test/AjoV2.test.js) | Circle and keeper contract tests |

See the repository [license](../LICENSE), [third-party attribution](../docs/ATTRIBUTIONS.md) and [contributing guide](../CONTRIBUTING.md). The workflow's project code is MIT-licensed; the CRE SDK retains its own license.
