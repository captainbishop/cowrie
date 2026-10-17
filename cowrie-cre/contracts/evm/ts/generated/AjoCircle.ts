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





/**
 * Filter params for Cancelled. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type CancelledTopics = {
  id?: bigint
}

/**
 * Decoded Cancelled event data.
 */
export type CancelledDecoded = {
  id: bigint
}


/**
 * Filter params for CircleCreated. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type CircleCreatedTopics = {
  id?: bigint
  creator?: `0x${string}`
}

/**
 * Decoded CircleCreated event data.
 */
export type CircleCreatedDecoded = {
  id: bigint
  creator: `0x${string}`
  name: string
  contribution: bigint
  deposit: bigint
  period: bigint
  joinDeadline: bigint
  maxMembers: number
}


/**
 * Filter params for Completed. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type CompletedTopics = {
  id?: bigint
}

/**
 * Decoded Completed event data.
 */
export type CompletedDecoded = {
  id: bigint
}


/**
 * Filter params for Contributed. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type ContributedTopics = {
  id?: bigint
  round?: number
  member?: `0x${string}`
}

/**
 * Decoded Contributed event data.
 */
export type ContributedDecoded = {
  id: bigint
  round: number
  member: `0x${string}`
  amount: bigint
}


/**
 * Filter params for DepositWithdrawn. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type DepositWithdrawnTopics = {
  id?: bigint
  member?: `0x${string}`
}

/**
 * Decoded DepositWithdrawn event data.
 */
export type DepositWithdrawnDecoded = {
  id: bigint
  member: `0x${string}`
  amount: bigint
}


/**
 * Filter params for DrawerChanged. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type DrawerChangedTopics = {
  drawer?: `0x${string}`
}

/**
 * Decoded DrawerChanged event data.
 */
export type DrawerChangedDecoded = {
  drawer: `0x${string}`
}


/**
 * Filter params for Invited. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type InvitedTopics = {
  id?: bigint
  who?: `0x${string}`
}

/**
 * Decoded Invited event data.
 */
export type InvitedDecoded = {
  id: bigint
  who: `0x${string}`
}


/**
 * Filter params for Joined. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type JoinedTopics = {
  id?: bigint
  member?: `0x${string}`
}

/**
 * Decoded Joined event data.
 */
export type JoinedDecoded = {
  id: bigint
  member: `0x${string}`
}


/**
 * Filter params for OrderSet. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type OrderSetTopics = {
  id?: bigint
}

/**
 * Decoded OrderSet event data.
 */
export type OrderSetDecoded = {
  id: bigint
  seed: bigint
  order: readonly `0x${string}`[]
}


/**
 * Filter params for OwnershipTransferred. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type OwnershipTransferredTopics = {
  previousOwner?: `0x${string}`
  newOwner?: `0x${string}`
}

/**
 * Decoded OwnershipTransferred event data.
 */
export type OwnershipTransferredDecoded = {
  previousOwner: `0x${string}`
  newOwner: `0x${string}`
}


/**
 * Filter params for RoundSettled. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type RoundSettledTopics = {
  id?: bigint
  round?: number
  collector?: `0x${string}`
}

/**
 * Decoded RoundSettled event data.
 */
export type RoundSettledDecoded = {
  id: bigint
  round: number
  collector: `0x${string}`
  pot: bigint
}


/**
 * Filter params for Slashed. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type SlashedTopics = {
  id?: bigint
  round?: number
  member?: `0x${string}`
}

/**
 * Decoded Slashed event data.
 */
export type SlashedDecoded = {
  id: bigint
  round: number
  member: `0x${string}`
  amount: bigint
}


export const AjoCircleABI = [{"inputs":[{"internalType":"contractIERC20","name":"token_","type":"address"},{"internalType":"address","name":"drawer_","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"inputs":[],"name":"ReentrancyGuardReentrantCall","type":"error"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"SafeERC20FailedOperation","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"id","type":"uint256"}],"name":"Cancelled","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":true,"internalType":"address","name":"creator","type":"address"},{"indexed":false,"internalType":"string","name":"name","type":"string"},{"indexed":false,"internalType":"uint256","name":"contribution","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"deposit","type":"uint256"},{"indexed":false,"internalType":"uint64","name":"period","type":"uint64"},{"indexed":false,"internalType":"uint64","name":"joinDeadline","type":"uint64"},{"indexed":false,"internalType":"uint8","name":"maxMembers","type":"uint8"}],"name":"CircleCreated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"id","type":"uint256"}],"name":"Completed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":true,"internalType":"uint8","name":"round","type":"uint8"},{"indexed":true,"internalType":"address","name":"member","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Contributed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":true,"internalType":"address","name":"member","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"DepositWithdrawn","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"drawer","type":"address"}],"name":"DrawerChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":true,"internalType":"address","name":"who","type":"address"}],"name":"Invited","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":true,"internalType":"address","name":"member","type":"address"}],"name":"Joined","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"seed","type":"uint256"},{"indexed":false,"internalType":"address[]","name":"order","type":"address[]"}],"name":"OrderSet","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":true,"internalType":"uint8","name":"round","type":"uint8"},{"indexed":true,"internalType":"address","name":"collector","type":"address"},{"indexed":false,"internalType":"uint256","name":"pot","type":"uint256"}],"name":"RoundSettled","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":true,"internalType":"uint8","name":"round","type":"uint8"},{"indexed":true,"internalType":"address","name":"member","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Slashed","type":"event"},{"inputs":[],"name":"DRAW_GRACE","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"MAX_INVITES","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"MAX_MEMBERS","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"MIN_PERIOD","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"cancel","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"circleCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"contribute","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"},{"internalType":"uint256","name":"contribution","type":"uint256"},{"internalType":"uint256","name":"deposit","type":"uint256"},{"internalType":"uint64","name":"period","type":"uint64"},{"internalType":"uint64","name":"joinDeadline","type":"uint64"},{"internalType":"uint8","name":"maxMembers","type":"uint8"}],"name":"createCircle","outputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"string","name":"name","type":"string"},{"internalType":"uint256","name":"contribution","type":"uint256"},{"internalType":"uint256","name":"deposit","type":"uint256"},{"internalType":"uint64","name":"period","type":"uint64"},{"internalType":"uint64","name":"joinDeadline","type":"uint64"},{"internalType":"uint8","name":"maxMembers","type":"uint8"}],"internalType":"structAjoCircle.CircleParams","name":"p","type":"tuple"},{"internalType":"address[]","name":"invited","type":"address[]"}],"name":"createInviteOnlyCircle","outputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"address","name":"","type":"address"}],"name":"depositOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"drawer","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getCircle","outputs":[{"components":[{"internalType":"string","name":"name","type":"string"},{"internalType":"address","name":"creator","type":"address"},{"internalType":"uint256","name":"contribution","type":"uint256"},{"internalType":"uint256","name":"deposit","type":"uint256"},{"internalType":"uint64","name":"period","type":"uint64"},{"internalType":"uint64","name":"joinDeadline","type":"uint64"},{"internalType":"uint64","name":"roundStart","type":"uint64"},{"internalType":"uint8","name":"maxMembers","type":"uint8"},{"internalType":"uint8","name":"round","type":"uint8"},{"internalType":"enumAjoCircle.Status","name":"status","type":"uint8"},{"internalType":"bool","name":"inviteOnly","type":"bool"},{"internalType":"uint256","name":"seed","type":"uint256"},{"internalType":"address[]","name":"members","type":"address[]"},{"internalType":"address[]","name":"order","type":"address[]"}],"internalType":"structAjoCircle.Circle","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getMembers","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getOrder","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"address[]","name":"who","type":"address[]"}],"name":"invite","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"isDue","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"address","name":"","type":"address"}],"name":"isInvited","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"address","name":"","type":"address"}],"name":"isMember","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"join","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint8","name":"","type":"uint8"},{"internalType":"address","name":"","type":"address"}],"name":"paid","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"roundEnd","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"drawer_","type":"address"}],"name":"setDrawer","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"address[]","name":"order","type":"address[]"},{"internalType":"uint256","name":"seed","type":"uint256"}],"name":"setOrder","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"settleRound","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"address","name":"","type":"address"}],"name":"strikes","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"token","outputs":[{"internalType":"contractIERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"withdrawDeposit","outputs":[],"stateMutability":"nonpayable","type":"function"}] as const

export class AjoCircle {
  constructor(
    private readonly client: EVMClient,
    public readonly address: Address,
  ) {}

  dRAWGRACE(
    runtime: Runtime<unknown>,
  ): bigint {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'DRAW_GRACE' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: AjoCircleABI,
      functionName: 'DRAW_GRACE' as const,
      data: bytesToHex(result.data),
    }) as bigint
  }

  mAXINVITES(
    runtime: Runtime<unknown>,
  ): bigint {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'MAX_INVITES' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: AjoCircleABI,
      functionName: 'MAX_INVITES' as const,
      data: bytesToHex(result.data),
    }) as bigint
  }

  mAXMEMBERS(
    runtime: Runtime<unknown>,
  ): number {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'MAX_MEMBERS' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: AjoCircleABI,
      functionName: 'MAX_MEMBERS' as const,
      data: bytesToHex(result.data),
    }) as number
  }

  mINPERIOD(
    runtime: Runtime<unknown>,
  ): bigint {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'MIN_PERIOD' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: AjoCircleABI,
      functionName: 'MIN_PERIOD' as const,
      data: bytesToHex(result.data),
    }) as bigint
  }

  circleCount(
    runtime: Runtime<unknown>,
  ): bigint {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'circleCount' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: AjoCircleABI,
      functionName: 'circleCount' as const,
      data: bytesToHex(result.data),
    }) as bigint
  }

  depositOf(
    runtime: Runtime<unknown>,
    arg0: bigint,
    arg1: `0x${string}`,
  ): bigint {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'depositOf' as const,
      args: [arg0, arg1],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: AjoCircleABI,
      functionName: 'depositOf' as const,
      data: bytesToHex(result.data),
    }) as bigint
  }

  drawer(
    runtime: Runtime<unknown>,
  ): `0x${string}` {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'drawer' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: AjoCircleABI,
      functionName: 'drawer' as const,
      data: bytesToHex(result.data),
    }) as `0x${string}`
  }

  getCircle(
    runtime: Runtime<unknown>,
    id: bigint,
  ): { name: string; creator: `0x${string}`; contribution: bigint; deposit: bigint; period: bigint; joinDeadline: bigint; roundStart: bigint; maxMembers: number; round: number; status: number; inviteOnly: boolean; seed: bigint; members: readonly `0x${string}`[]; order: readonly `0x${string}`[] } {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
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
      abi: AjoCircleABI,
      functionName: 'getCircle' as const,
      data: bytesToHex(result.data),
    }) as { name: string; creator: `0x${string}`; contribution: bigint; deposit: bigint; period: bigint; joinDeadline: bigint; roundStart: bigint; maxMembers: number; round: number; status: number; inviteOnly: boolean; seed: bigint; members: readonly `0x${string}`[]; order: readonly `0x${string}`[] }
  }

  getMembers(
    runtime: Runtime<unknown>,
    id: bigint,
  ): readonly `0x${string}`[] {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
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
      abi: AjoCircleABI,
      functionName: 'getMembers' as const,
      data: bytesToHex(result.data),
    }) as readonly `0x${string}`[]
  }

  getOrder(
    runtime: Runtime<unknown>,
    id: bigint,
  ): readonly `0x${string}`[] {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'getOrder' as const,
      args: [id],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: AjoCircleABI,
      functionName: 'getOrder' as const,
      data: bytesToHex(result.data),
    }) as readonly `0x${string}`[]
  }

  isDue(
    runtime: Runtime<unknown>,
    id: bigint,
  ): boolean {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
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
      abi: AjoCircleABI,
      functionName: 'isDue' as const,
      data: bytesToHex(result.data),
    }) as boolean
  }

  isInvited(
    runtime: Runtime<unknown>,
    arg0: bigint,
    arg1: `0x${string}`,
  ): boolean {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'isInvited' as const,
      args: [arg0, arg1],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: AjoCircleABI,
      functionName: 'isInvited' as const,
      data: bytesToHex(result.data),
    }) as boolean
  }

  isMember(
    runtime: Runtime<unknown>,
    arg0: bigint,
    arg1: `0x${string}`,
  ): boolean {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'isMember' as const,
      args: [arg0, arg1],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: AjoCircleABI,
      functionName: 'isMember' as const,
      data: bytesToHex(result.data),
    }) as boolean
  }

  owner(
    runtime: Runtime<unknown>,
  ): `0x${string}` {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'owner' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: AjoCircleABI,
      functionName: 'owner' as const,
      data: bytesToHex(result.data),
    }) as `0x${string}`
  }

  paid(
    runtime: Runtime<unknown>,
    arg0: bigint,
    arg1: number,
    arg2: `0x${string}`,
  ): boolean {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'paid' as const,
      args: [arg0, arg1, arg2],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: AjoCircleABI,
      functionName: 'paid' as const,
      data: bytesToHex(result.data),
    }) as boolean
  }

  roundEnd(
    runtime: Runtime<unknown>,
    id: bigint,
  ): bigint {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'roundEnd' as const,
      args: [id],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: AjoCircleABI,
      functionName: 'roundEnd' as const,
      data: bytesToHex(result.data),
    }) as bigint
  }

  strikes(
    runtime: Runtime<unknown>,
    arg0: bigint,
    arg1: `0x${string}`,
  ): number {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'strikes' as const,
      args: [arg0, arg1],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: AjoCircleABI,
      functionName: 'strikes' as const,
      data: bytesToHex(result.data),
    }) as number
  }

  token(
    runtime: Runtime<unknown>,
  ): `0x${string}` {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'token' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: AjoCircleABI,
      functionName: 'token' as const,
      data: bytesToHex(result.data),
    }) as `0x${string}`
  }

  writeReportFromCancel(
    runtime: Runtime<unknown>,
    id: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'cancel' as const,
      args: [id],
    })

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

  writeReportFromContribute(
    runtime: Runtime<unknown>,
    id: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'contribute' as const,
      args: [id],
    })

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

  writeReportFromCreateCircle(
    runtime: Runtime<unknown>,
    name: string,
    contribution: bigint,
    deposit: bigint,
    period: bigint,
    joinDeadline: bigint,
    maxMembers: number,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'createCircle' as const,
      args: [name, contribution, deposit, period, joinDeadline, maxMembers],
    })

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

  writeReportFromCreateInviteOnlyCircle(
    runtime: Runtime<unknown>,
    p: { name: string; contribution: bigint; deposit: bigint; period: bigint; joinDeadline: bigint; maxMembers: number },
    invited: readonly `0x${string}`[],
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'createInviteOnlyCircle' as const,
      args: [p, invited],
    })

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

  writeReportFromInvite(
    runtime: Runtime<unknown>,
    id: bigint,
    who: readonly `0x${string}`[],
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'invite' as const,
      args: [id, who],
    })

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

  writeReportFromJoin(
    runtime: Runtime<unknown>,
    id: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'join' as const,
      args: [id],
    })

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

  writeReportFromSetDrawer(
    runtime: Runtime<unknown>,
    drawer: `0x${string}`,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'setDrawer' as const,
      args: [drawer],
    })

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

  writeReportFromSetOrder(
    runtime: Runtime<unknown>,
    id: bigint,
    order: readonly `0x${string}`[],
    seed: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'setOrder' as const,
      args: [id, order, seed],
    })

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

  writeReportFromSettleRound(
    runtime: Runtime<unknown>,
    id: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'settleRound' as const,
      args: [id],
    })

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

  writeReportFromTransferOwnership(
    runtime: Runtime<unknown>,
    newOwner: `0x${string}`,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'transferOwnership' as const,
      args: [newOwner],
    })

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

  writeReportFromWithdrawDeposit(
    runtime: Runtime<unknown>,
    id: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: AjoCircleABI,
      functionName: 'withdrawDeposit' as const,
      args: [id],
    })

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

  /**
   * Creates a log trigger for Cancelled events.
   * The returned trigger's adapt method decodes the raw log into CancelledDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerCancelled(
    filters?: CancelledTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'Cancelled' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        id: f.id,
      }
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'Cancelled' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          id: f.id,
        }
        return encodeEventTopics({
          abi: AjoCircleABI,
          eventName: 'Cancelled' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<CancelledDecoded> => contract.decodeCancelled(rawOutput),
    }
  }

  /**
   * Decodes a log into Cancelled data, preserving all log metadata.
   */
  decodeCancelled(log: EVMLog): DecodedLog<CancelledDecoded> {
    const decoded = decodeEventLog({
      abi: AjoCircleABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as CancelledDecoded }
  }

  /**
   * Creates a log trigger for CircleCreated events.
   * The returned trigger's adapt method decodes the raw log into CircleCreatedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerCircleCreated(
    filters?: CircleCreatedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'CircleCreated' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        id: f.id,
        creator: f.creator,
      }
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'CircleCreated' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          id: f.id,
          creator: f.creator,
        }
        return encodeEventTopics({
          abi: AjoCircleABI,
          eventName: 'CircleCreated' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<CircleCreatedDecoded> => contract.decodeCircleCreated(rawOutput),
    }
  }

  /**
   * Decodes a log into CircleCreated data, preserving all log metadata.
   */
  decodeCircleCreated(log: EVMLog): DecodedLog<CircleCreatedDecoded> {
    const decoded = decodeEventLog({
      abi: AjoCircleABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as CircleCreatedDecoded }
  }

  /**
   * Creates a log trigger for Completed events.
   * The returned trigger's adapt method decodes the raw log into CompletedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerCompleted(
    filters?: CompletedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'Completed' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        id: f.id,
      }
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'Completed' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          id: f.id,
        }
        return encodeEventTopics({
          abi: AjoCircleABI,
          eventName: 'Completed' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<CompletedDecoded> => contract.decodeCompleted(rawOutput),
    }
  }

  /**
   * Decodes a log into Completed data, preserving all log metadata.
   */
  decodeCompleted(log: EVMLog): DecodedLog<CompletedDecoded> {
    const decoded = decodeEventLog({
      abi: AjoCircleABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as CompletedDecoded }
  }

  /**
   * Creates a log trigger for Contributed events.
   * The returned trigger's adapt method decodes the raw log into ContributedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerContributed(
    filters?: ContributedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'Contributed' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        id: f.id,
        round: f.round,
        member: f.member,
      }
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'Contributed' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          id: f.id,
          round: f.round,
          member: f.member,
        }
        return encodeEventTopics({
          abi: AjoCircleABI,
          eventName: 'Contributed' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<ContributedDecoded> => contract.decodeContributed(rawOutput),
    }
  }

  /**
   * Decodes a log into Contributed data, preserving all log metadata.
   */
  decodeContributed(log: EVMLog): DecodedLog<ContributedDecoded> {
    const decoded = decodeEventLog({
      abi: AjoCircleABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as ContributedDecoded }
  }

  /**
   * Creates a log trigger for DepositWithdrawn events.
   * The returned trigger's adapt method decodes the raw log into DepositWithdrawnDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerDepositWithdrawn(
    filters?: DepositWithdrawnTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'DepositWithdrawn' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        id: f.id,
        member: f.member,
      }
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'DepositWithdrawn' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          id: f.id,
          member: f.member,
        }
        return encodeEventTopics({
          abi: AjoCircleABI,
          eventName: 'DepositWithdrawn' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<DepositWithdrawnDecoded> => contract.decodeDepositWithdrawn(rawOutput),
    }
  }

  /**
   * Decodes a log into DepositWithdrawn data, preserving all log metadata.
   */
  decodeDepositWithdrawn(log: EVMLog): DecodedLog<DepositWithdrawnDecoded> {
    const decoded = decodeEventLog({
      abi: AjoCircleABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as DepositWithdrawnDecoded }
  }

  /**
   * Creates a log trigger for DrawerChanged events.
   * The returned trigger's adapt method decodes the raw log into DrawerChangedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerDrawerChanged(
    filters?: DrawerChangedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'DrawerChanged' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        drawer: f.drawer,
      }
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'DrawerChanged' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          drawer: f.drawer,
        }
        return encodeEventTopics({
          abi: AjoCircleABI,
          eventName: 'DrawerChanged' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<DrawerChangedDecoded> => contract.decodeDrawerChanged(rawOutput),
    }
  }

  /**
   * Decodes a log into DrawerChanged data, preserving all log metadata.
   */
  decodeDrawerChanged(log: EVMLog): DecodedLog<DrawerChangedDecoded> {
    const decoded = decodeEventLog({
      abi: AjoCircleABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as DrawerChangedDecoded }
  }

  /**
   * Creates a log trigger for Invited events.
   * The returned trigger's adapt method decodes the raw log into InvitedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerInvited(
    filters?: InvitedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'Invited' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        id: f.id,
        who: f.who,
      }
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'Invited' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          id: f.id,
          who: f.who,
        }
        return encodeEventTopics({
          abi: AjoCircleABI,
          eventName: 'Invited' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<InvitedDecoded> => contract.decodeInvited(rawOutput),
    }
  }

  /**
   * Decodes a log into Invited data, preserving all log metadata.
   */
  decodeInvited(log: EVMLog): DecodedLog<InvitedDecoded> {
    const decoded = decodeEventLog({
      abi: AjoCircleABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as InvitedDecoded }
  }

  /**
   * Creates a log trigger for Joined events.
   * The returned trigger's adapt method decodes the raw log into JoinedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerJoined(
    filters?: JoinedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'Joined' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        id: f.id,
        member: f.member,
      }
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'Joined' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          id: f.id,
          member: f.member,
        }
        return encodeEventTopics({
          abi: AjoCircleABI,
          eventName: 'Joined' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<JoinedDecoded> => contract.decodeJoined(rawOutput),
    }
  }

  /**
   * Decodes a log into Joined data, preserving all log metadata.
   */
  decodeJoined(log: EVMLog): DecodedLog<JoinedDecoded> {
    const decoded = decodeEventLog({
      abi: AjoCircleABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as JoinedDecoded }
  }

  /**
   * Creates a log trigger for OrderSet events.
   * The returned trigger's adapt method decodes the raw log into OrderSetDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerOrderSet(
    filters?: OrderSetTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'OrderSet' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        id: f.id,
      }
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'OrderSet' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          id: f.id,
        }
        return encodeEventTopics({
          abi: AjoCircleABI,
          eventName: 'OrderSet' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<OrderSetDecoded> => contract.decodeOrderSet(rawOutput),
    }
  }

  /**
   * Decodes a log into OrderSet data, preserving all log metadata.
   */
  decodeOrderSet(log: EVMLog): DecodedLog<OrderSetDecoded> {
    const decoded = decodeEventLog({
      abi: AjoCircleABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as OrderSetDecoded }
  }

  /**
   * Creates a log trigger for OwnershipTransferred events.
   * The returned trigger's adapt method decodes the raw log into OwnershipTransferredDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerOwnershipTransferred(
    filters?: OwnershipTransferredTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'OwnershipTransferred' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        previousOwner: f.previousOwner,
        newOwner: f.newOwner,
      }
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'OwnershipTransferred' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          previousOwner: f.previousOwner,
          newOwner: f.newOwner,
        }
        return encodeEventTopics({
          abi: AjoCircleABI,
          eventName: 'OwnershipTransferred' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<OwnershipTransferredDecoded> => contract.decodeOwnershipTransferred(rawOutput),
    }
  }

  /**
   * Decodes a log into OwnershipTransferred data, preserving all log metadata.
   */
  decodeOwnershipTransferred(log: EVMLog): DecodedLog<OwnershipTransferredDecoded> {
    const decoded = decodeEventLog({
      abi: AjoCircleABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as OwnershipTransferredDecoded }
  }

  /**
   * Creates a log trigger for RoundSettled events.
   * The returned trigger's adapt method decodes the raw log into RoundSettledDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerRoundSettled(
    filters?: RoundSettledTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'RoundSettled' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        id: f.id,
        round: f.round,
        collector: f.collector,
      }
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'RoundSettled' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          id: f.id,
          round: f.round,
          collector: f.collector,
        }
        return encodeEventTopics({
          abi: AjoCircleABI,
          eventName: 'RoundSettled' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<RoundSettledDecoded> => contract.decodeRoundSettled(rawOutput),
    }
  }

  /**
   * Decodes a log into RoundSettled data, preserving all log metadata.
   */
  decodeRoundSettled(log: EVMLog): DecodedLog<RoundSettledDecoded> {
    const decoded = decodeEventLog({
      abi: AjoCircleABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as RoundSettledDecoded }
  }

  /**
   * Creates a log trigger for Slashed events.
   * The returned trigger's adapt method decodes the raw log into SlashedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerSlashed(
    filters?: SlashedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'Slashed' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        id: f.id,
        round: f.round,
        member: f.member,
      }
      const encoded = encodeEventTopics({
        abi: AjoCircleABI,
        eventName: 'Slashed' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          id: f.id,
          round: f.round,
          member: f.member,
        }
        return encodeEventTopics({
          abi: AjoCircleABI,
          eventName: 'Slashed' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<SlashedDecoded> => contract.decodeSlashed(rawOutput),
    }
  }

  /**
   * Decodes a log into Slashed data, preserving all log metadata.
   */
  decodeSlashed(log: EVMLog): DecodedLog<SlashedDecoded> {
    const decoded = decodeEventLog({
      abi: AjoCircleABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as SlashedDecoded }
  }
}

