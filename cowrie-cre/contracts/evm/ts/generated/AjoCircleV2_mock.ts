// Code generated — DO NOT EDIT.
import type { Address } from 'viem'
import { addContractMock, type ContractMock, type EvmMock } from '@chainlink/cre-sdk/test'

import { AjoCircleV2ABI } from './AjoCircleV2'

export type AjoCircleV2Mock = {
  autopay?: (arg0: bigint, arg1: `0x${string}`) => boolean
  circleCount?: () => bigint
  getCircle?: (id: bigint) => { name: string; creator: `0x${string}`; contribution: bigint; deposit: bigint; period: bigint; joinDeadline: bigint; roundStart: bigint; fullAt: bigint; maxMembers: number; round: number; status: number; inviteOnly: boolean; drawnBy: number; seed: bigint; members: readonly `0x${string}`[]; order: readonly `0x${string}`[] }
  getMembers?: (id: bigint) => readonly `0x${string}`[]
  isDue?: (id: bigint) => boolean
  pullRound?: (arg0: bigint) => number
} & Pick<ContractMock<typeof AjoCircleV2ABI>, 'writeReport'>

export function newAjoCircleV2Mock(address: Address, evmMock: EvmMock): AjoCircleV2Mock {
  return addContractMock(evmMock, { address, abi: AjoCircleV2ABI }) as AjoCircleV2Mock
}

