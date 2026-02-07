// LSP6 Permission constants
// Reference: https://docs.lukso.tech/standards/access-control/lsp6-key-manager#permissions
export const PERMISSIONS = {
  CHANGEOWNER: '0x0000000000000000000000000000000000000000000000000000000000000001',
  ADDCONTROLLER: '0x0000000000000000000000000000000000000000000000000000000000000002',
  EDITPERMISSIONS: '0x0000000000000000000000000000000000000000000000000000000000000004',
  ADDEXTENSIONS: '0x0000000000000000000000000000000000000000000000000000000000000008',
  CHANGEEXTENSIONS: '0x0000000000000000000000000000000000000000000000000000000000000010',
  ADDUNIVERSALRECEIVERDELEGATE: '0x0000000000000000000000000000000000000000000000000000000000000020',
  CHANGEUNIVERSALRECEIVERDELEGATE: '0x0000000000000000000000000000000000000000000000000000000000000040',
  REENTRANCY: '0x0000000000000000000000000000000000000000000000000000000000000080',
  SUPER_TRANSFERVALUE: '0x0000000000000000000000000000000000000000000000000000000000000100',
  TRANSFERVALUE: '0x0000000000000000000000000000000000000000000000000000000000000200',
  SUPER_CALL: '0x0000000000000000000000000000000000000000000000000000000000000400',
  CALL: '0x0000000000000000000000000000000000000000000000000000000000000800',
  SUPER_STATICCALL: '0x0000000000000000000000000000000000000000000000000000000000001000',
  STATICCALL: '0x0000000000000000000000000000000000000000000000000000000000002000',
  SUPER_DELEGATECALL: '0x0000000000000000000000000000000000000000000000000000000000004000',
  DELEGATECALL: '0x0000000000000000000000000000000000000000000000000000000000008000',
  DEPLOY: '0x0000000000000000000000000000000000000000000000000000000000010000',
  SUPER_SETDATA: '0x0000000000000000000000000000000000000000000000000000000000020000',
  SETDATA: '0x0000000000000000000000000000000000000000000000000000000000040000',
  ENCRYPT: '0x0000000000000000000000000000000000000000000000000000000000080000',
  DECRYPT: '0x0000000000000000000000000000000000000000000000000000000000100000',
  SIGN: '0x0000000000000000000000000000000000000000000000000000000000200000',
  EXECUTE_RELAY_CALL: '0x0000000000000000000000000000000000000000000000000000000000400000',
  ALL_PERMISSIONS: '0x00000000000000000000000000000000000000000000000000000000007f3f7f',
} as const

// Permission names for display
export const PERMISSION_NAMES: Record<string, string> = {
  CHANGEOWNER: 'Change Owner',
  ADDCONTROLLER: 'Add Controller',
  EDITPERMISSIONS: 'Edit Permissions',
  ADDEXTENSIONS: 'Add Extensions',
  CHANGEEXTENSIONS: 'Change Extensions',
  ADDUNIVERSALRECEIVERDELEGATE: 'Add Universal Receiver Delegate',
  CHANGEUNIVERSALRECEIVERDELEGATE: 'Change Universal Receiver Delegate',
  REENTRANCY: 'Reentrancy',
  SUPER_TRANSFERVALUE: 'Super Transfer Value',
  TRANSFERVALUE: 'Transfer Value',
  SUPER_CALL: 'Super Call',
  CALL: 'Call',
  SUPER_STATICCALL: 'Super Static Call',
  STATICCALL: 'Static Call',
  SUPER_DELEGATECALL: 'Super Delegate Call',
  DELEGATECALL: 'Delegate Call',
  DEPLOY: 'Deploy',
  SUPER_SETDATA: 'Super Set Data',
  SETDATA: 'Set Data',
  ENCRYPT: 'Encrypt',
  DECRYPT: 'Decrypt',
  SIGN: 'Sign',
  EXECUTE_RELAY_CALL: 'Execute Relay Call',
}

// Permission risk levels
export const PERMISSION_RISK: Record<string, 'safe' | 'medium' | 'high' | 'critical'> = {
  CHANGEOWNER: 'critical',
  ADDCONTROLLER: 'high',
  EDITPERMISSIONS: 'high',
  ADDEXTENSIONS: 'medium',
  CHANGEEXTENSIONS: 'medium',
  ADDUNIVERSALRECEIVERDELEGATE: 'medium',
  CHANGEUNIVERSALRECEIVERDELEGATE: 'medium',
  REENTRANCY: 'high',
  SUPER_TRANSFERVALUE: 'high',
  TRANSFERVALUE: 'medium',
  SUPER_CALL: 'high',
  CALL: 'medium',
  SUPER_STATICCALL: 'medium',
  STATICCALL: 'safe',
  SUPER_DELEGATECALL: 'critical',
  DELEGATECALL: 'critical',
  DEPLOY: 'medium',
  SUPER_SETDATA: 'high',
  SETDATA: 'medium',
  ENCRYPT: 'safe',
  DECRYPT: 'safe',
  SIGN: 'medium',
  EXECUTE_RELAY_CALL: 'safe',
}

// Permission descriptions
export const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  CHANGEOWNER: 'Transfer ownership of the profile - EXTREMELY DANGEROUS',
  ADDCONTROLLER: 'Add new controllers to the profile',
  EDITPERMISSIONS: 'Modify permissions of existing controllers',
  ADDEXTENSIONS: 'Add new extension contracts',
  CHANGEEXTENSIONS: 'Modify existing extension contracts',
  ADDUNIVERSALRECEIVERDELEGATE: 'Add universal receiver delegates',
  CHANGEUNIVERSALRECEIVERDELEGATE: 'Modify universal receiver delegates',
  REENTRANCY: 'Allow reentrant calls into the profile',
  SUPER_TRANSFERVALUE: 'Transfer any amount of LYX without restrictions',
  TRANSFERVALUE: 'Transfer LYX (can be restricted with AllowedCalls)',
  SUPER_CALL: 'Call any contract without restrictions',
  CALL: 'Call contracts (can be restricted with AllowedCalls)',
  SUPER_STATICCALL: 'Read any contract without restrictions',
  STATICCALL: 'Read from contracts (can be restricted)',
  SUPER_DELEGATECALL: 'Execute code in profile context - EXTREMELY DANGEROUS',
  DELEGATECALL: 'Execute code in profile context - DANGEROUS',
  DEPLOY: 'Deploy new contracts via the profile',
  SUPER_SETDATA: 'Write any data to the profile without restrictions',
  SETDATA: 'Write data to the profile (can be restricted)',
  ENCRYPT: 'Encrypt data using the profile',
  DECRYPT: 'Decrypt data using the profile',
  SIGN: 'Sign messages using the profile',
  EXECUTE_RELAY_CALL: 'Execute relay calls (gasless transactions)',
}

// Data keys for permissions
export const DATA_KEYS = {
  'AddressPermissions[]': '0xdf30dba06db6a30e65354d9a64c609861f089545ca58c6b4dbe31a5f338cb0e3',
  'AddressPermissions[]_length': '0xdf30dba06db6a30e65354d9a64c609861f089545ca58c6b4dbe31a5f338cb0e3',
  'AddressPermissions[]_index_prefix': '0xdf30dba06db6a30e65354d9a64c60986',
  'AddressPermissions:Permissions_prefix': '0x4b80742de2bf82acb3630000',
  'AddressPermissions:AllowedCalls_prefix': '0x4b80742de2bf393a64c70000',
  'AddressPermissions:AllowedERC725YDataKeys_prefix': '0x4b80742de2bf866c29110000',
  // LSP3 Profile
  'LSP3Profile': '0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5',
}

// LSP0 (Universal Profile) ABI - minimal for our needs
export const LSP0_ABI = [
  {
    inputs: [{ name: 'dataKey', type: 'bytes32' }],
    name: 'getData',
    outputs: [{ name: 'dataValue', type: 'bytes' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'dataKeys', type: 'bytes32[]' }],
    name: 'getDataBatch',
    outputs: [{ name: 'dataValues', type: 'bytes[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'dataKeys', type: 'bytes32[]' },
      { name: 'dataValues', type: 'bytes[]' },
    ],
    name: 'setDataBatch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// Chain configurations
export const CHAINS = {
  lukso: {
    id: 42,
    name: 'LUKSO',
    network: 'lukso',
    nativeCurrency: { name: 'LYX', symbol: 'LYX', decimals: 18 },
    rpcUrls: {
      default: { http: ['https://42.rpc.thirdweb.com'] },
      public: { http: ['https://42.rpc.thirdweb.com'] },
    },
    blockExplorers: {
      default: { name: 'LUKSO Explorer', url: 'https://explorer.execution.mainnet.lukso.network' },
    },
  },
  luksoTestnet: {
    id: 4201,
    name: 'LUKSO Testnet',
    network: 'lukso-testnet',
    nativeCurrency: { name: 'LYXt', symbol: 'LYXt', decimals: 18 },
    rpcUrls: {
      default: { http: ['https://4201.rpc.thirdweb.com'] },
      public: { http: ['https://4201.rpc.thirdweb.com'] },
    },
    blockExplorers: {
      default: { name: 'LUKSO Testnet Explorer', url: 'https://explorer.execution.testnet.lukso.network' },
    },
  },
} as const

// Permission presets
export interface PermissionPreset {
  name: string
  description: string
  permissions: bigint
  recommended?: boolean
  warning?: string
  allowedCalls?: string
  allowedDataKeys?: string
}

// Note: ALL presets include SIGN permission for quota checking support
export const PERMISSION_PRESETS: Record<string, PermissionPreset> = {
  'token-operator': {
    name: 'Token Operator',
    description: 'Can transfer tokens and NFTs, call any contract, and sign messages.',
    permissions: BigInt(PERMISSIONS.SUPER_CALL) | BigInt(PERMISSIONS.TRANSFERVALUE) | BigInt(PERMISSIONS.EXECUTE_RELAY_CALL) | BigInt(PERMISSIONS.SIGN),
    recommended: false,
  },
  'profile-manager': {
    name: 'Profile Manager',
    description: 'Can update profile metadata, read data, and sign messages.',
    permissions: BigInt(PERMISSIONS.SUPER_SETDATA) | BigInt(PERMISSIONS.STATICCALL) | BigInt(PERMISSIONS.EXECUTE_RELAY_CALL) | BigInt(PERMISSIONS.SIGN),
    recommended: false,
  },
  'wallet': {
    name: 'Wallet',
    description: 'Full wallet capabilities: transfer tokens, update profile, interact with contracts, and sign messages.',
    permissions: BigInt(PERMISSIONS.SUPER_CALL) | BigInt(PERMISSIONS.TRANSFERVALUE) | BigInt(PERMISSIONS.SUPER_SETDATA) | BigInt(PERMISSIONS.STATICCALL) | BigInt(PERMISSIONS.SIGN) | BigInt(PERMISSIONS.EXECUTE_RELAY_CALL),
    recommended: true,
  },
  'full-access': {
    name: 'Full Access',
    description: 'Complete control over the profile. Use with extreme caution!',
    permissions: BigInt(PERMISSIONS.ALL_PERMISSIONS),
    recommended: false,
    warning: 'This grants FULL CONTROL over your Universal Profile. The controller can transfer all assets, change ownership, and perform any action. Only grant this to controllers you absolutely trust.',
  },
}
