import { parseAbi } from "viem";

export const addresses = {
  vault: (process.env.NEXT_PUBLIC_POLICY_VAULT || "") as `0x${string}`,
  scam: (process.env.NEXT_PUBLIC_SCAM_REGISTRY || "") as `0x${string}`,
  usd: (process.env.NEXT_PUBLIC_MOCK_USD || "") as `0x${string}`,
};

export const vaultAbi = parseAbi([
  "function spendable(address) view returns (uint256)",
  "function savings(address) view returns (uint256)",
  "function autosaveBps(address) view returns (uint16)",
  "function dailyCap(address) view returns (uint256)",
  "function spentTodayOf(address) view returns (uint256)",
  "function accrued(address from, address to) view returns (uint256)",
  "function mintAndDeposit(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function setAutosave(uint16 bps)",
  "function setDailyCap(uint256 cap)",
  "function unlockSavings(uint256 amount)",
  "function send(address to, uint256 amount)",
  "function setAllowance(address to, uint256 ratePerDay)",
  "function claimAllowance(address from)",
  "function startEarning(uint256 amount)",
  "function stopEarning(uint256 amount)",
  "function stopAllEarning()",
  "function earnedOf(address) view returns (uint256)",
  "function earnPrincipal(address) view returns (uint256)",
  "function swapCusdForToken(address asset, uint256 cusdIn)",
  "function swapTokenForCusd(address asset, uint256 tokIn)",
  "function quoteCusdForToken(address asset, uint256 cusdIn) view returns (uint256)",
  "function quoteTokenForCusd(address asset, uint256 tokIn) view returns (uint256)",
  "function holding(address, address) view returns (uint256)",
  "function holdingValue(address, address) view returns (uint256)",
  "function listedTokens(uint256) view returns (address)",
  "function listedTokensCount() view returns (uint256)",
  "function marketsCount() view returns (uint256)",
  "function markets(uint256) view returns (string question, uint64 closeTime, bool resolved, bool outcome, uint256 poolYes, uint256 poolNo)",
  "function predict(uint256 id, bool side, uint256 amount)",
  "function claimPrediction(uint256 id)",
  "function predictionOf(uint256 id, address user) view returns (uint256 yes, uint256 no)",
  "event Sent(address indexed from, address indexed to, uint256 amount, uint256 autoSaved)",
  "event AutoSaved(address indexed user, uint256 amount)",
  "event Deposited(address indexed user, uint256 amount)",
  "event RuleChanged(address indexed user, string rule)",
  "event AllowanceClaimed(address indexed from, address indexed to, uint256 amount)",
]);

export const scamAbi = parseAbi([
  "function isFlagged(address) view returns (bool)",
  "function reportCount(address) view returns (uint256)",
  "function report(address)",
]);

export const usdAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);
