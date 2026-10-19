// Code generated — DO NOT EDIT.
import {
  decodeEventLog,
  decodeFunctionResult,
  encodeEventTopics,
  encodeFunctionData,
  zeroAddress,
} from 'viem'
import type { Address, Hex } from 'viem'
import {
  bytesToHex,
  encodeCallMsg,
  EVMClient,
  hexToBase64,
  LAST_FINALIZED_BLOCK_NUMBER,
  prepareReportRequest,
  type EVMLog,
  type Runtime,
} from '@chainlink/cre-sdk'

export interface DecodedLog<T> extends Omit<EVMLog, 'data'> { data: T }

const encodeTopicValue = (t: Hex | Hex[] | null): string[] => {
  if (t == null) return []
  if (Array.isArray(t)) return t.map(hexToBase64)
  return [hexToBase64(t)]
}





export const AjoCircleV2ABI = [{"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"address","name":"","type":"address"}],"name":"autopay","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"circleCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getCircle","outputs":[{"components":[{"internalType":"string","name":"name","type":"string"},{"internalType":"address","name":"creator","type":"address"},{"internalType":"uint256","name":"contribution","type":"uint256"},{"internalType":"uint256","name":"deposit","type":"uint256"},{"internalType":"uint64","name":"period","type":"uint64"},{"internalType":"uint64","name":"joinDeadline","type":"uint64"},{"internalType":"uint64","name":"roundStart","type":"uint64"},{"internalType":"uint64","name":"fullAt","type":"uint64"},{"internalType":"uint8","name":"maxMembers","type":"uint8"},{"internalType":"uint8","name":"round","type":"uint8"},{"internalType":"enumAjoCircleV2.Status","name":"status","type":"uint8"},{"internalType":"bool","name":"inviteOnly","type":"bool"},{"internalType":"uint8","name":"drawnBy","type":"uint8"},{"internalType":"uint256","name":"seed","type":"uint256"},{"internalType":"address[]","name":"members","type":"address[]"},{"internalType":"address[]","name":"order","type":"address[]"}],"internalType":"structAjoCircleV2.Circle","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getMembers","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"isDue","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"pullRound","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"}] as const

export class AjoCircleV2 {
  constructor(
    private readonly client: EVMClient,
    public readonly address: Address,
  ) {}

  autopay(
    runtime: Runtime<unknown>,
    arg0: bigint,
    arg1: `0x${string}`,
  ): boolean {
    const callData = encodeFunctionData({
      abi: AjoCircleV2ABI,
      functionName: 'autopay' as const,
      args: [arg0, arg1],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: AjoCircleV2ABI,
      functionName: 'autopay' as const,
      data: bytesToHex(result.data),
    }) as boolean
  }

  circleCount(
    runtime: Runtime<unknown>,
  ): bigint {
    const callData = encodeFunctionData({
      abi: AjoCircleV2ABI,
      functionName: 'circleCount' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: AjoCircleV2ABI,
      functionName: 'circleCount' as const,
      data: bytesToHex(result.data),
    }) as bigint
  }

  getCircle(
    runtime: Runtime<unknown>,
    id: bigint,
  ): { name: string; creator: `0x${string}`; contribution: bigint; deposit: bigint; period: bigint; joinDeadline: bigint; roundStart: bigint; fullAt: bigint; maxMembers: number; round: number; status: number; inviteOnly: boolean; drawnBy: number; seed: bigint; members: readonly `0x${string}`[]; order: readonly `0x${string}`[] } {
    const callData = encodeFunctionData({
      abi: AjoCircleV2ABI,
      functionName: 'getCircle' as const,
      args: [id],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: AjoCircleV2ABI,
      functionName: 'getCircle' as const,
      data: bytesToHex(result.data),
    }) as { name: string; creator: `0x${string}`; contribution: bigint; deposit: bigint; period: bigint; joinDeadline: bigint; roundStart: bigint; fullAt: bigint; maxMembers: number; round: number; status: number; inviteOnly: boolean; drawnBy: number; seed: bigint; members: readonly `0x${string}`[]; order: readonly `0x${string}`[] }
  }

  getMembers(
    runtime: Runtime<unknown>,
    id: bigint,
  ): readonly `0x${string}`[] {
    const callData = encodeFunctionData({
      abi: AjoCircleV2ABI,
      functionName: 'getMembers' as const,
      args: [id],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: AjoCircleV2ABI,
      functionName: 'getMembers' as const,
      data: bytesToHex(result.data),
    }) as readonly `0x${string}`[]
  }

  isDue(
    runtime: Runtime<unknown>,
    id: bigint,
  ): boolean {
    const callData = encodeFunctionData({
      abi: AjoCircleV2ABI,
      functionName: 'isDue' as const,
      args: [id],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: AjoCircleV2ABI,
      functionName: 'isDue' as const,
      data: bytesToHex(result.data),
    }) as boolean
  }

  pullRound(
    runtime: Runtime<unknown>,
    arg0: bigint,
  ): number {
    const callData = encodeFunctionData({
      abi: AjoCircleV2ABI,
      functionName: 'pullRound' as const,
      args: [arg0],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: AjoCircleV2ABI,
      functionName: 'pullRound' as const,
      data: bytesToHex(result.data),
    }) as number
  }

  writeReport(
    runtime: Runtime<unknown>,
    callData: Hex,
    gasConfig?: { gasLimit?: string },
  ) {
    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }
}

