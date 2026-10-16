import {
	cre,
	getNetwork,
	type Runtime,
	type CronPayload,
} from '@chainlink/cre-sdk';
import { formatUnits, type Address } from 'viem';
import { z } from 'zod';
import { PriceFeedAggregator } from '../contracts/evm/ts/generated/PriceFeedAggregator';

// ---------- Config ----------

export const configSchema = z.object({
	schedule: z.string(),
	chainName: z.string(),
	btcFeed: z.string(),
	circleName: z.string(),
	members: z.array(z.string()),
});

type Config = z.infer<typeof configSchema>;

// ---------- Helpers ----------

function getEvmClient(chainName: string) {
	const net = getNetwork({
		chainFamily: 'evm',
		chainSelectorName: chainName,
		isTestnet: false,
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

// ---------- Handler ----------

export function onCron(runtime: Runtime<Config>, _payload: CronPayload): string {
	const evmClient = getEvmClient(runtime.config.chainName);
	const aggregator = new PriceFeedAggregator(evmClient, runtime.config.btcFeed as Address);

	const decimals = aggregator.decimals(runtime);
	const answer = aggregator.latestAnswer(runtime);
	const price = formatUnits(answer, decimals);

	// Seed = price x 1000, as a whole number, using exact integer maths.
	const seed = Number((answer * BigInt(1000)) / (BigInt(10) ** BigInt(decimals)));

	const members = runtime.config.members;
	const order = seededOrder(members.length, seed);
	const payoutOrder = order.map((idx, pos) => ({ round: pos + 1, member: members[idx] }));

	runtime.log(`Ajo draw | circle="${runtime.config.circleName}" btcPrice=${price} seed=${seed}`);
	payoutOrder.forEach((p) => runtime.log(`Round ${p.round}: ${p.member}`));

	return JSON.stringify({
		circle: runtime.config.circleName,
		btcPrice: price,
		seed,
		payoutOrder,
	});
}

// ---------- Init ----------

export function initWorkflow(config: Config) {
	const cron = new cre.capabilities.CronCapability();
	return [cre.handler(cron.trigger({ schedule: config.schedule }), onCron)];
}
