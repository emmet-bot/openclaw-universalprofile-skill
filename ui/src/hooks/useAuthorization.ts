import { useState, useCallback } from 'react'
import { 
  type Address, 
  type Hex,
  type WalletClient,
  type PublicClient,
} from 'viem'
import { LSP0_ABI, DATA_KEYS } from '../constants'
import { buildControllerData, combinePermissions, type AllowedCall, encodeAllowedCalls, encodeAllowedDataKeys } from '../utils'

export interface AuthorizationParams {
  controllerAddress: Address
  permissions: bigint
  allowedCalls?: AllowedCall[]
  allowedDataKeys?: Hex[]
}

export type AuthorizationStatus = 'idle' | 'preparing' | 'pending' | 'success' | 'error'

export interface AuthorizationState {
  status: AuthorizationStatus
  txHash: Hex | null
  error: string | null
}

export function useAuthorization(
  upAddress: Address | null,
  walletClient: WalletClient | null,
  publicClient: PublicClient | null
) {
  const [state, setState] = useState<AuthorizationState>({
    status: 'idle',
    txHash: null,
    error: null,
  })

  // Check if controller is already authorized and get their permissions
  const checkExistingController = useCallback(async (
    controllerAddress: Address
  ): Promise<{ exists: boolean; permissions?: Hex; permissionsBigInt?: bigint }> => {
    if (!publicClient || !upAddress) {
      return { exists: false }
    }

    try {
      // First, directly check if this controller has permissions set
      // This is more efficient than iterating through all controllers
      const permKey = `${DATA_KEYS['AddressPermissions:Permissions_prefix']}${controllerAddress.slice(2).toLowerCase()}` as Hex
      const permissions = await publicClient.readContract({
        address: upAddress,
        abi: LSP0_ABI,
        functionName: 'getData',
        args: [permKey],
      }) as Hex

      // If permissions are set and non-zero, controller exists
      if (permissions && permissions !== '0x' && permissions !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        const permissionsBigInt = BigInt(permissions)
        if (permissionsBigInt > 0n) {
          return { exists: true, permissions, permissionsBigInt }
        }
      }

      return { exists: false }
    } catch (err) {
      console.error('Error checking existing controller:', err)
      return { exists: false }
    }
  }, [publicClient, upAddress])

  // Get current controllers count
  const getControllersCount = useCallback(async (): Promise<number> => {
    if (!publicClient || !upAddress) return 0

    try {
      const lengthData = await publicClient.readContract({
        address: upAddress,
        abi: LSP0_ABI,
        functionName: 'getData',
        args: [DATA_KEYS['AddressPermissions[]'] as Hex],
      }) as Hex

      if (!lengthData || lengthData === '0x') return 0
      return parseInt(lengthData.slice(0, 34), 16)
    } catch (err) {
      console.error('Error getting controllers count:', err)
      return 0
    }
  }, [publicClient, upAddress])

  // Authorize a new controller
  const authorize = useCallback(async (params: AuthorizationParams) => {
    if (!walletClient || !publicClient || !upAddress) {
      setState({
        status: 'error',
        txHash: null,
        error: 'Wallet not connected',
      })
      return
    }

    setState({ status: 'preparing', txHash: null, error: null })

    try {
      // Check if controller already exists - if so, we'll update their permissions
      const existing = await checkExistingController(params.controllerAddress)
      const isExistingController = existing.exists

      // Get current controllers count (only needed for new controllers)
      const currentLength = isExistingController ? 0 : await getControllersCount()

      // Build data keys and values
      const permissionsHex = combinePermissions([params.permissions])
      const allowedCallsHex = params.allowedCalls 
        ? encodeAllowedCalls(params.allowedCalls) 
        : undefined
      const allowedDataKeysHex = params.allowedDataKeys
        ? encodeAllowedDataKeys(params.allowedDataKeys)
        : undefined

      const { dataKeys, dataValues } = buildControllerData(
        params.controllerAddress,
        permissionsHex,
        currentLength,
        allowedCallsHex,
        allowedDataKeysHex,
        isExistingController // Skip array operations if controller already exists
      )

      console.log('Authorization data:', {
        upAddress,
        controllerAddress: params.controllerAddress,
        permissions: permissionsHex,
        dataKeys,
        dataValues,
      })

      setState({ status: 'pending', txHash: null, error: null })

      // Execute setDataBatch
      const hash = await walletClient.writeContract({
        address: upAddress,
        abi: LSP0_ABI,
        functionName: 'setDataBatch',
        args: [dataKeys, dataValues],
        account: upAddress,
        chain: walletClient.chain,
      })

      console.log('Transaction hash:', hash)

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      
      if (receipt.status === 'success') {
        setState({
          status: 'success',
          txHash: hash,
          error: null,
        })
      } else {
        setState({
          status: 'error',
          txHash: hash,
          error: 'Transaction failed',
        })
      }
    } catch (err) {
      console.error('Authorization error:', err)
      setState({
        status: 'error',
        txHash: null,
        error: err instanceof Error ? err.message : 'Authorization failed',
      })
    }
  }, [walletClient, publicClient, upAddress, checkExistingController, getControllersCount])

  // Reset state
  const reset = useCallback(() => {
    setState({
      status: 'idle',
      txHash: null,
      error: null,
    })
  }, [])

  return {
    ...state,
    authorize,
    reset,
    checkExistingController,
  }
}
