import abiJson from "./ajoAbi.json";

// The AjoCircle contract on Monad testnet (drawn and settled by a Chainlink CRE workflow).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ajoAbi = abiJson as any;

export const AJO_ADDRESS = (process.env.NEXT_PUBLIC_AJO_CIRCLE || "") as `0x${string}`;

export const AJO_STATUS = ["Open", "Full", "Active", "Completed", "Cancelled", "Ended"] as const;

export type OnchainCircle = {
  id: number;
  name: string;
  creator: string;
  contribution: bigint;
  deposit: bigint;
  period: number;
  joinDeadline: number;
  roundStart: number;
  maxMembers: number;
  round: number;
  status: number;
  seed: bigint;
  members: string[];
  order: string[];
};
