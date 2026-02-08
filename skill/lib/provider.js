/**
 * Shared RPC Provider Setup
 * 
 * Provides configured viem and ethers clients for LUKSO network.
 */

import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { lukso, luksoTestnet } from 'viem/chains';
import { ethers } from 'ethers';
import { loadCredentials } from './credentials.js';
import { CHAINS } from './constants.js';

// Default RPC endpoints
const RPC_URLS = {
  mainnet: 'https://42.rpc.thirdweb.com',
  testnet: 'https://rpc.testnet.lukso.network'
};

/**
 * Get RPC URL for a network
 */
export function getRpcUrl(network = 'mainnet') {
  return RPC_URLS[network] || RPC_URLS.mainnet;
}

/**
 * Get viem chain config
 */
export function getChain(network = 'mainnet') {
  return network === 'testnet' ? luksoTestnet : lukso;
}

/**
 * Create a viem public client (read-only)
 */
export function createProvider(network = 'mainnet') {
  return createPublicClient({
    chain: getChain(network),
    transport: http(getRpcUrl(network))
  });
}

/**
 * Create a viem wallet client (for signing/sending)
 */
export function createSigner(privateKey, network = 'mainnet') {
  const account = privateKeyToAccount(privateKey);
  return {
    account,
    client: createWalletClient({
      account,
      chain: getChain(network),
      transport: http(getRpcUrl(network))
    })
  };
}

/**
 * Create an ethers provider
 */
export function createEthersProvider(network = 'mainnet') {
  return new ethers.JsonRpcProvider(getRpcUrl(network));
}

/**
 * Create an ethers wallet (provider + signer)
 */
export function createEthersWallet(privateKey, network = 'mainnet') {
  const provider = createEthersProvider(network);
  return new ethers.Wallet(privateKey, provider);
}

/**
 * Get configured provider and credentials
 * Convenience function that loads credentials and creates clients
 */
export function getProviderWithCredentials(network = 'mainnet') {
  const creds = loadCredentials();
  const provider = createProvider(network);
  const ethersProvider = createEthersProvider(network);
  const { account, client: walletClient } = createSigner(creds.controller.privateKey, network);
  const ethersWallet = createEthersWallet(creds.controller.privateKey, network);
  
  return {
    // Credentials
    upAddress: creds.universalProfile.address,
    controllerAddress: creds.controller.address,
    privateKey: creds.controller.privateKey,
    
    // Viem clients
    publicClient: provider,
    walletClient,
    account,
    
    // Ethers clients
    ethersProvider,
    ethersWallet,
    
    // Network info
    network,
    chainId: getChain(network).id
  };
}
