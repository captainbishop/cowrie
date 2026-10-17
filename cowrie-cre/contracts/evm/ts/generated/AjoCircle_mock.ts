// Code generated — DO NOT EDIT.
import type { Address } from 'viem'
import { addContractMock, type ContractMock, type EvmMock } from '@chainlink/cre-sdk/test'

import { AjoCircleABI } from './AjoCircle'

export type AjoCircleMock = {
  dRAWGRACE?: () => bigint
  mAXINVITES?: () => bigint
  mAXMEMBERS?: () => number
  mINPERIOD?: () => bigint
  circleCount?: () => bigint
  depositOf?: (arg0: bigint, arg1: `0x${string}`) => bigint
  drawer?: () => `0x${string}`
  getCircle?: (id: bigint) => { name: string; creator: `0x${string}`; contribution: bigint; deposit: bigint; period: bigint; joinDeadline: bigint; roundStart: bigint; maxMembers: number; round: number; status: number; inviteOnly: boolean; seed: bigint; members: readonly `0x${string}`[]; order: readonly `0x${string}`[] }
  getMembers?: (id: bigint) => readonly `0x${string}`[]
  getOrder?: (id: bigint) => readonly `0x${string}`[]
  isDue?: (id: bigint) => boolean
  isInvited?: (arg0: bigint, arg1: `0x${string}`) => boolean
  isMember?: (arg0: bigint, arg1: `0x${string}`) => boolean
  owner?: () => `0x${string}`
  paid?: (arg0: bigint, arg1: number, arg2: `0x${string}`) => boolean
  roundEnd?: (id: bigint) => bigint
  strikes?: (arg0: bigint, arg1: `0x${string}`) => number
  token?: () => `0x${string}`
} & Pick<ContractMock<typeof AjoCircleABI>, 'writeReport'>

export function newAjoCircleMock(address: Address, evmMock: EvmMock): AjoCircleMock {
  return addContractMock(evmMock, { address, abi: AjoCircleABI }) as AjoCircleMock
}

