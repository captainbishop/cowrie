import { createPublicClient, http, defineChain, parseAbi } from "viem";

// Chainlink price feeds are live on Monad MAINNET (testnet has none), so Cowrie Guardian
// reads the real decentralized oracle from mainnet with a read-only client: no gas, no funds.
export const monadMainnet = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_MONAD_MAINNET_RPC || "https://rpc.monad.xyz"] } },
  testnet: false,
});

export const clClient = createPublicClient({ chain: monadMainnet, transport: http() });

export const aggregatorAbi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
]);

// Monad mainnet Chainlink feed proxy addresses (filled from env).
export const CL_FEEDS: Record<string, string> = {
  BTC: process.env.NEXT_PUBLIC_CL_BTC_USD || "",
  ETH: process.env.NEXT_PUBLIC_CL_ETH_USD || "",
};

// Map a user's spoken asset to a Chainlink feed key.
export function feedKeyFor(asset: string): "BTC" | "ETH" | null {
  const a = (asset || "").toLowerCase();
  if (/btc|bitcoin|cbtc/.test(a)) return "BTC";
  if (/eth|ether|ethereum|ceth/.test(a)) return "ETH";
  return null;
}

export async function readFeed(addr: string): Promise<{ price: number; at: number } | null> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return null;
  try {
    const [data, dec] = await Promise.all([
      clClient.readContract({ address: addr as `0x${string}`, abi: aggregatorAbi, functionName: "latestRoundData", args: [] }),
      clClient.readContract({ address: addr as `0x${string}`, abi: aggregatorAbi, functionName: "decimals", args: [] }),
    ]);
    const arr = data as readonly [bigint, bigint, bigint, bigint, bigint];
    const price = Number(arr[1]) / 10 ** Number(dec);
    return { price, at: Number(arr[3]) };
  } catch {
    return null;
  }
}

export async function readAllFeeds(): Promise<Record<string, { price: number; at: number }>> {
  const out: Record<string, { price: number; at: number }> = {};
  await Promise.all(
    Object.entries(CL_FEEDS).map(async ([k, a]) => {
      if (a) {
        const r = await readFeed(a);
        if (r) out[k] = r;
      }
    })
  );
  return out;
}
