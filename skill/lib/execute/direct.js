/**
 * Direct Transaction Execution
 * 
 * Executes ANY payload directly (controller pays gas).
 * This module is transaction-type agnostic - it just sends the transaction.
 * 
 * Two methods:
 * 1. executeDirect - Call UP.execute() directly (controller must be owner)
 * 2. executeRelayCallDirect - Use LSP25 executeRelayCall on Key Manager
 *    (for controllers that aren't direct owners but have permissions)
 * 
 * REQUIRES:
 * - Controller must have sufficient permissions for the action
 * - Controller must have LYX to pay gas
 */

import { ethers } from 'ethers';
import { getProviderWithCredentials } from '../provider.js';
import { getExplorerUrl } from '../constants.js';

// LSP25 version constant
const LSP25_VERSION = 25n;

// ABIs
const UP_ABI = [
  'function owner() view returns (address)',
  'function execute(uint256 operation, address target, uint256 value, bytes data) payable returns (bytes)'
];

const KM_ABI = [
  'function getNonce(address, uint128) view returns (uint256)',
  'function executeRelayCall(bytes signature, uint256 nonce, uint256 validityTimestamps, bytes payload) payable returns (bytes)'
];

/**
 * Execute a payload directly via UP.execute()
 * Controller must be the UP owner or have direct execute rights
 * 
 * @param {number} operation - 0=CALL, 1=CREATE, 2=CREATE2, 3=STATICCALL, 4=DELEGATECALL
 * @param {string} target - Target contract address
 * @param {bigint|number} value - LYX value to send
 * @param {string} data - Encoded calldata for target
 * @param {Object} options - Optional overrides
 * @returns {Promise<{txHash: string, explorerUrl: string}>}
 */
export async function executeDirect(operation, target, value, data, options = {}) {
  const network = options.network || 'mainnet';
  
  const {
    upAddress,
    ethersWallet
  } = getProviderWithCredentials(network);

  const up = new ethers.Contract(upAddress, UP_ABI, ethersWallet);
  
  const tx = await up.execute(operation, target, value, data);
  const receipt = await tx.wait();

  const chainId = network === 'testnet' ? 4201 : 42;
  return {
    txHash: receipt.hash,
    explorerUrl: getExplorerUrl(receipt.hash, chainId)
  };
}

/**
 * Execute a full UP.execute() payload via Key Manager's executeRelayCall
 * 
 * This is for controllers that have EXECUTE_RELAY_CALL permission but
 * want to pay gas themselves (instead of using the relay service).
 * 
 * @param {string} payload - The full encoded UP.execute() calldata
 * @param {Object} options - Optional overrides
 * @returns {Promise<{txHash: string, explorerUrl: string}>}
 */
export async function executeRelayCallDirect(payload, options = {}) {
  const network = options.network || 'mainnet';
  const value = options.value || 0;
  
  const {
    upAddress,
    controllerAddress,
    privateKey,
    ethersProvider,
    ethersWallet,
    chainId
  } = getProviderWithCredentials(network);

  // Get Key Manager
  const up = new ethers.Contract(upAddress, UP_ABI, ethersProvider);
  const kmAddress = await up.owner();
  const km = new ethers.Contract(kmAddress, KM_ABI, ethersWallet);

  // Get nonce
  const nonce = await km.getNonce(controllerAddress, 0);

  // Build LSP25 message
  const encodedMessage = ethers.solidityPacked(
    ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [LSP25_VERSION, chainId, nonce, 0n, BigInt(value), payload]
  );

  // EIP-191 v0 hash
  const hash = ethers.keccak256(
    ethers.concat(['0x19', '0x00', kmAddress, encodedMessage])
  );

  // Sign
  const sig = new ethers.SigningKey(privateKey).sign(hash);
  const signature = ethers.Signature.from(sig).serialized;

  // Execute directly on Key Manager (we pay gas)
  const tx = await km.executeRelayCall(
    signature,
    nonce,
    0,  // validityTimestamps
    payload,
    { value }
  );
  
  const receipt = await tx.wait();

  const explorerChainId = network === 'testnet' ? 4201 : 42;
  return {
    txHash: receipt.hash,
    explorerUrl: getExplorerUrl(receipt.hash, explorerChainId)
  };
}

/**
 * Build a UP.execute() payload (helper)
 * 
 * @param {number} operation - 0=CALL, 1=CREATE, 2=CREATE2, 3=STATICCALL, 4=DELEGATECALL
 * @param {string} target - Target contract address
 * @param {bigint|number} value - LYX value to send
 * @param {string} data - Encoded calldata for target
 * @returns {string} Encoded UP.execute() calldata
 */
export function buildExecutePayload(operation, target, value, data) {
  const iface = new ethers.Interface(UP_ABI);
  return iface.encodeFunctionData('execute', [operation, target, value, data]);
}

export default { executeDirect, executeRelayCallDirect, buildExecutePayload };
