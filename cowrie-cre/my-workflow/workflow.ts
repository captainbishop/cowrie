import {
	cre,
	getNetwork,
	bytesToHex,
	hexToBase64,
	type Runtime,
	type CronPayload,
} from '@chainlink/cre-sdk';
import { formatUnits, encodeAbiParameters, parseAbiParameters, type Address } from 'viem';
import { z } from 'zod';
import { PriceFeedAggregator } from '../contracts/evm/ts/generated/PriceFeedAggregator';
import { AjoCircle } from '../contracts/evm/ts/generated/AjoCircle';

// ---------- Config ----------

export const configSchema = z.object({
	schedule: z.string(),
	mainnetChain: z.string(), // where the Chainlink BTC/USD feed lives
	testnetChain: z.string(), // where the Ajo contracts live
	btcFeed: z.string(),
	ajoCircle: z.string(),
	ajoKeeper: z.string(),
	gasLimit: z.string(),
});

type Config = z.infer<typeof configSchema>;

// Ajo circle status values, matching the contract's enum.
const STATUS_FULL = 1;
const STATUS_ACTIVE = 2;

// Report actions understood by the AjoKeeper contract.
const ACTION_SETTLE = 1;
const ACTION_SET_ORDER = 2;

// ---------- Helpers ----------

function getEvmClient(chainName: string, isTestnet: boolean) {
	const net = getNetwork({
		chainFamily: 'evm',
		chainSelectorName: chainName,
		isTestnet,
	});
	if (!net) throw new Error(`Network not found for chain name: ${chainName}`);
	return new cre.capabilities.EVMClient(net.chainSelector.selector);
}

// Same shuffle Cowrie's app uses, so the draw matches exactly.
function seededOrder(n: number, seed: number): number[] {
	let s = (seed >>> 0) || 1;
	const rnd = () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const a = Array.from({ length: n }, (_, i) => i);
	for (let i = n - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

// Sign a report and deliver it to the AjoKeeper through Chainlink's forwarder.
function sendReport(
	runtime: Runtime<Config>,
	client: InstanceType<typeof cre.capabilities.EVMClient>,
	payload: `0x${string}`,
): string {
	const report = runtime
		.report({
			encodedPayload: hexToBase64(payload),
			encoderName: 'evm',
			signingAlgo: 'ecdsa',
			hashingAlgo: 'keccak256',
		})
		.result();

	const res = client
		.writeReport(runtime, {
			receiver: runtime.config.ajoKeeper,
			report,
			gasConfig: { gasLimit: runtime.config.gasLimit },
		})
		.result();

	return bytesToHex(res.txHash || new Uint8Array(32));
}

const reportShape = parseAbiParameters('uint8 action, uint256 id, address[] order, uint256 seed');

// ---------- Handler ----------

export function onCron(runtime: Runtime<Config>, _payload: CronPayload): string {
	const cfg = runtime.config;
	const testClient = getEvmClient(cfg.testnetChain, true);
	const ajo = new AjoCircle(testClient, cfg.ajoCircle as Address);

	const count = Number(ajo.circleCount(runtime));
	runtime.log(`Ajo circles on-chain: ${count}`);

	const done: { circle: number; action: string; tx: string }[] = [];

	// The live Chainlink BTC price is read once, and only if a draw is needed.
	let seedInfo: { seed: number; price: string } | null = null;
	const getSeed = () => {
		if (seedInfo) return seedInfo;
		const mainClient = getEvmClient(cfg.mainnetChain, false);
		const feed = new PriceFeedAggregator(mainClient, cfg.btcFeed as Address);
		const decimals = feed.decimals(runtime);
		const answer = feed.latestAnswer(runtime);
		seedInfo = {
			price: formatUnits(answer, decimals),
			seed: Number((answer * BigInt(1000)) / (BigInt(10) ** BigInt(decimals))),
		};
		runtime.log(`Chainlink BTC/USD on ${cfg.mainnetChain}: ${seedInfo.price} (seed ${seedInfo.seed})`);
		return seedInfo;
	};

	for (let n = 1; n <= count; n++) {
		const id = BigInt(n);
		try {
			const circle = ajo.getCircle(runtime, id);
			const status = Number(circle.status);

			if (status === STATUS_FULL) {
				// Circle is full and waiting for its fair draw.
				const members = ajo.getMembers(runtime, id);
				const { seed } = getSeed();
				const order = seededOrder(members.length, seed).map((i) => members[i]);
				runtime.log(`Circle ${n}: drawing payout order for ${members.length} members`);
				order.forEach((m, pos) => runtime.log(`Circle ${n} round ${pos + 1}: ${m}`));

				const payload = encodeAbiParameters(reportShape, [ACTION_SET_ORDER, id, [...order], BigInt(seed)]);
				const tx = sendReport(runtime, testClient, payload);
				runtime.log(`Circle ${n}: draw recorded, tx ${tx}`);
				done.push({ circle: n, action: 'draw', tx });
			} else if (status === STATUS_ACTIVE && ajo.isDue(runtime, id)) {
				// A round's timer has ended: settle it so the pot is paid out.
				runtime.log(`Circle ${n}: round timer ended, settling`);
				const payload = encodeAbiParameters(reportShape, [ACTION_SETTLE, id, [], BigInt(0)]);
				const tx = sendReport(runtime, testClient, payload);
				runtime.log(`Circle ${n}: round settled, tx ${tx}`);
				done.push({ circle: n, action: 'settle', tx });
			} else {
				runtime.log(`Circle ${n}: nothing to do (status ${status})`);
			}
		} catch (e) {
			runtime.log(`Circle ${n}: skipped, ${String(e)}`);
		}
	}

	return JSON.stringify({ circles: count, actions: done });
}

// ---------- Init ----------

export function initWorkflow(config: Config) {
	const cron = new cre.capabilities.CronCapability();
	return [cre.handler(cron.trigger({ schedule: config.schedule }), onCron)];
}