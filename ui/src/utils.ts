import { DATA_KEYS, PERMISSIONS, PERMISSION_RISK, PERMISSION_PRESETS } from './constants'
import { 
  toHex, 
  pad,
  type Hex,
  type Address
} from 'viem'

/**
 * Combine multiple permissions into a single bytes32 value
 */
export function combinePermissions(permissions: (string | bigint)[]): Hex {
  let combined = 0n
  for (const perm of permissions) {
    combined |= BigInt(perm)
  }
  return pad(toHex(combined), { size: 32 })
}

/**
 * Decode a permissions bytes32 into individual permission names
 */
export function decodePermissions(permissionValue: string): string[] {
  const permissions: string[] = []
  const value = BigInt(permissionValue)
  
  for (const [name, hex] of Object.entries(PERMISSIONS)) {
    if (name === 'ALL_PERMISSIONS') continue
    if ((value & BigInt(hex)) !== 0n) {
      permissions.push(name)
    }
  }
  
  return permissions
}

/**
 * Check if a permission value includes a specific permission
 */
export function hasPermission(permissionValue: string | bigint, permission: string | bigint): boolean {
  return (BigInt(permissionValue) & BigInt(permission)) !== 0n
}

/**
 * Get the data key for a controller's permissions
 */
export function getPermissionsDataKey(controllerAddress: Address): Hex {
  const prefix = DATA_KEYS['AddressPermissions:Permissions_prefix']
  const addressBytes = controllerAddress.slice(2).toLowerCase()
  return `${prefix}${addressBytes}` as Hex
}

/**
 * Get the data key for a controller's AllowedCalls
 */
export function getAllowedCallsDataKey(controllerAddress: Address): Hex {
  const prefix = DATA_KEYS['AddressPermissions:AllowedCalls_prefix']
  const addressBytes = controllerAddress.slice(2).toLowerCase()
  return `${prefix}${addressBytes}` as Hex
}

/**
 * Get the data key for a controller's AllowedERC725YDataKeys
 */
export function getAllowedDataKeysDataKey(controllerAddress: Address): Hex {
  const prefix = DATA_KEYS['AddressPermissions:AllowedERC725YDataKeys_prefix']
  const addressBytes = controllerAddress.slice(2).toLowerCase()
  return `${prefix}${addressBytes}` as Hex
}

/**
 * Get the data key for a specific index in the AddressPermissions[] array
 */
export function getArrayIndexDataKey(index: number): Hex {
  const prefix = DATA_KEYS['AddressPermissions[]_index_prefix']
  const indexHex = pad(toHex(index), { size: 16 }).slice(2)
  return `${prefix}${indexHex}` as Hex
}

/**
 * Build the data keys and values for adding a new controller or updating an existing one
 * @param isExisting - If true, skip adding to the array (controller already exists)
 */
export function buildControllerData(
  controllerAddress: Address,
  permissions: Hex,
  currentLength: number,
  allowedCalls?: Hex,
  allowedDataKeys?: Hex,
  isExisting: boolean = false
): { dataKeys: Hex[]; dataValues: Hex[] } {
  const dataKeys: Hex[] = []
  const dataValues: Hex[] = []

  // Only add to array if this is a new controller
  if (!isExisting) {
    // 1. Update array length
    dataKeys.push(DATA_KEYS['AddressPermissions[]'] as Hex)
    dataValues.push(pad(toHex(currentLength + 1), { size: 16 }))

    // 2. Add controller address to array at new index
    dataKeys.push(getArrayIndexDataKey(currentLength))
    dataValues.push(pad(controllerAddress, { size: 20 }))
  }

  // 3. Set permissions for controller (always do this)
  dataKeys.push(getPermissionsDataKey(controllerAddress))
  dataValues.push(permissions)

  // 4. Optionally set AllowedCalls
  if (allowedCalls) {
    dataKeys.push(getAllowedCallsDataKey(controllerAddress))
    dataValues.push(allowedCalls)
  }

  // 5. Optionally set AllowedERC725YDataKeys
  if (allowedDataKeys) {
    dataKeys.push(getAllowedDataKeysDataKey(controllerAddress))
    dataValues.push(allowedDataKeys)
  }

  return { dataKeys, dataValues }
}

/**
 * Encode AllowedCalls for a controller
 * @param calls Array of { callTypes, address, interfaceId, functionSelector }
 */
export interface AllowedCall {
  callTypes: number // Bitmap: 0x1 = CALL, 0x2 = STATICCALL, 0x4 = DELEGATECALL
  address: Address // Contract address (use 0xFFFF...FFFF for any)
  interfaceId: Hex // 4 bytes interface ID (use 0xFFFFFFFF for any)
  functionSelector: Hex // 4 bytes selector (use 0xFFFFFFFF for any)
}

export function encodeAllowedCalls(calls: AllowedCall[]): Hex {
  if (calls.length === 0) return '0x' as Hex

  // Each allowed call is 32 bytes:
  // - 4 bytes: call types (left-padded)
  // - 20 bytes: address
  // - 4 bytes: interface ID
  // - 4 bytes: function selector
  const encoded = calls.map(call => {
    const callTypes = pad(toHex(call.callTypes), { size: 4 })
    const address = call.address.toLowerCase().slice(2)
    const interfaceId = call.interfaceId.slice(2)
    const functionSelector = call.functionSelector.slice(2)
    return `${callTypes}${address}${interfaceId}${functionSelector}`
  }).join('')

  return `0x${encoded}` as Hex
}

/**
 * Encode AllowedERC725YDataKeys
 * @param dataKeyPrefixes Array of data key prefixes to allow
 */
export function encodeAllowedDataKeys(dataKeyPrefixes: Hex[]): Hex {
  if (dataKeyPrefixes.length === 0) return '0x' as Hex

  // CompactBytesArray format: length (2 bytes) + data
  const parts = dataKeyPrefixes.map(prefix => {
    const length = (prefix.length - 2) / 2 // bytes length
    const lengthHex = pad(toHex(length), { size: 2 }).slice(2)
    return lengthHex + prefix.slice(2)
  })

  return `0x${parts.join('')}` as Hex
}

/**
 * Validate permissions and return warnings/risks
 */
export interface PermissionValidation {
  valid: boolean
  warnings: string[]
  risks: string[]
}

export function validatePermissions(permissions: string | bigint): PermissionValidation {
  const warnings: string[] = []
  const risks: string[] = []
  const permValue = BigInt(permissions)

  for (const [name, hex] of Object.entries(PERMISSIONS)) {
    if (name === 'ALL_PERMISSIONS') continue
    if ((permValue & BigInt(hex)) !== 0n) {
      const risk = PERMISSION_RISK[name]
      if (risk === 'critical') {
        risks.push(`${name}: This is an extremely dangerous permission`)
      } else if (risk === 'high') {
        warnings.push(`${name}: This permission requires caution`)
      }
    }
  }

  return {
    valid: risks.length === 0,
    warnings,
    risks,
  }
}

/**
 * Format an address for display (truncated)
 */
export function formatAddress(address: string, chars: number = 4): string {
  if (!address || address.length < 10) return address
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

/**
 * Parse URL parameters for pre-filled values
 */
export function parseUrlParams(): {
  controllerAddress?: Address
  upAddress?: Address
  chainId?: number
  preset?: string
} {
  const params = new URLSearchParams(window.location.search)
  return {
    controllerAddress: params.get('controller') as Address | undefined,
    upAddress: params.get('up') as Address | undefined,
    chainId: params.get('chain') ? parseInt(params.get('chain')!) : undefined,
    preset: params.get('preset') || undefined,
  }
}

/**
 * Generate authorization URL with parameters
 */
export function generateAuthUrl(
  baseUrl: string,
  controllerAddress: Address,
  preset?: string,
  chainId?: number
): string {
  const params = new URLSearchParams()
  params.set('controller', controllerAddress)
  if (preset) params.set('preset', preset)
  if (chainId) params.set('chain', chainId.toString())
  return `${baseUrl}?${params.toString()}`
}

/**
 * Convert IPFS URL to HTTP gateway URL
 * Handles ipfs://, ipfs://ipfs/, and raw CIDs
 */
export function convertIpfsUrl(url: string): string {
  if (!url) return url
  
  // Already an HTTP URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  
  // IPFS protocol URLs
  if (url.startsWith('ipfs://')) {
    const hash = url.replace('ipfs://', '').replace('ipfs/', '')
    return `https://api.universalprofile.cloud/ipfs/${hash}`
  }
  
  // Raw IPFS hash (starts with Qm or baf)
  if (url.startsWith('Qm') || url.startsWith('baf')) {
    return `https://api.universalprofile.cloud/ipfs/${url}`
  }
  
  return url
}

/**
 * Find a preset that exactly matches the given permissions
 * Returns the preset key if found, null otherwise
 */
export function findMatchingPreset(permissions: bigint): string | null {
  for (const [key, preset] of Object.entries(PERMISSION_PRESETS)) {
    if (preset.permissions === permissions) {
      return key
    }
  }
  return null
}

/**
 * Parse permissions from a hex string (as returned from chain)
 * Returns the bigint value
 */
export function parsePermissionsHex(hex: Hex | string): bigint {
  if (!hex || hex === '0x') return 0n
  return BigInt(hex)
}
