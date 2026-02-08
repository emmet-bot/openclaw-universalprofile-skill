/**
 * LUKSO Network Constants
 */

export const NETWORKS = {
  MAINNET: {
    chainId: 42,
    name: 'LUKSO Mainnet',
    rpc: 'https://42.rpc.thirdweb.com',
    explorer: 'https://explorer.lukso.network'
  },
  TESTNET: {
    chainId: 4201,
    name: 'LUKSO Testnet',
    rpc: 'https://4201.rpc.thirdweb.com',
    explorer: 'https://explorer.testnet.lukso.network'
  }
};

/**
 * Get explorer URL for a transaction
 * @param {string} txHash - Transaction hash
 * @param {number} chainId - Chain ID (42 for mainnet, 4201 for testnet)
 * @returns {string} Explorer URL
 */
export function getExplorerUrl(txHash, chainId = 42) {
  const network = chainId === 4201 ? NETWORKS.TESTNET : NETWORKS.MAINNET;
  return `${network.explorer}/tx/${txHash}`;
}

/**
 * Get explorer URL for an address
 * @param {string} address - Address
 * @param {number} chainId - Chain ID (42 for mainnet, 4201 for testnet)
 * @returns {string} Explorer URL
 */
export function getAddressExplorerUrl(address, chainId = 42) {
  const network = chainId === 4201 ? NETWORKS.TESTNET : NETWORKS.MAINNET;
  return `${network.explorer}/address/${address}`;
}
