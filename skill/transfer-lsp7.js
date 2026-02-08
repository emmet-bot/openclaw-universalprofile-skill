#!/usr/bin/env node
/**
 * Transfer LSP7 tokens from Universal Profile
 * 
 * Usage:
 *   node transfer-lsp7.js <token-address> <to-address> <amount> [--force]
 * 
 * Amount is in human-readable format (e.g., "5" for 5 tokens)
 * Decimals are queried from the token contract automatically
 */

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RPC_ENDPOINT = 'https://42.rpc.thirdweb.com';
const CONFIG_PATH = path.join(process.env.HOME, '.clawdbot', 'universal-profile', 'config.json');
const KEY_PATH = path.join(process.env.HOME, '.clawdbot', 'credentials', 'universal-profile-key.json');

// LSP7 Token Interface (minimal for transfer)
const LSP7_ABI = [
  'function transfer(address from, address to, uint256 amount, bool force, bytes data) external',
  'function decimals() view returns (uint8)',
  'function balanceOf(address account) view returns (uint256)'
];

// UP Interface
const UP_ABI = [
  'function execute(uint256 operation, address target, uint256 value, bytes data) external payable returns (bytes)'
];

async function transferLSP7(tokenAddress, toAddress, humanAmount, force = false) {
  try {
    // Load config
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    const keyData = JSON.parse(fs.readFileSync(KEY_PATH, 'utf-8'));

    // Setup provider and signer
    const provider = new ethers.JsonRpcProvider(RPC_ENDPOINT);
    const signer = new ethers.Wallet(keyData.controller.privateKey, provider);

    // Connect to UP and token
    const upAddress = config.universalProfile.address;
    const upContract = new ethers.Contract(upAddress, UP_ABI, signer);
    const tokenContract = new ethers.Contract(tokenAddress, LSP7_ABI, provider);

    // Query decimals from token contract
    const decimals = await tokenContract.decimals();
    console.log(`Token decimals: ${decimals}`);

    // Convert human amount to wei using token's decimals
    const amount = ethers.parseUnits(humanAmount, decimals);

    // Check balance
    const balance = await tokenContract.balanceOf(upAddress);
    console.log(`Current balance: ${ethers.formatUnits(balance, decimals)} tokens`);
    
    if (balance < amount) {
      throw new Error(`Insufficient balance. Have: ${ethers.formatUnits(balance, decimals)}, Need: ${humanAmount}`);
    }

    // Encode LSP7 transfer call
    const transferData = tokenContract.interface.encodeFunctionData('transfer', [
      upAddress,         // from (the UP itself)
      toAddress,         // to
      amount,            // amount (in wei)
      force,             // force (allow transfers to non-LSP1 contracts)
      '0x'               // data (empty)
    ]);

    // Execute via UP (operation=0 for CALL)
    console.log(`Transferring ${humanAmount} tokens to ${toAddress}...`);
    
    const tx = await upContract.execute(
      0,           // CALL operation
      tokenAddress, // target (token contract)
      0,           // value (0 LYX)
      transferData // calldata
    );

    console.log(`Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      console.log(`✅ Transfer successful!`);
      console.log(`Block: ${receipt.blockNumber}`);
      console.log(`Gas used: ${receipt.gasUsed.toString()}`);
      console.log(`Explorer: https://explorer.lukso.network/tx/${tx.hash}`);
    } else {
      throw new Error('Transaction failed');
    }

    return receipt;
  } catch (error) {
    throw new Error(`Transfer failed: ${error.message}`);
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const tokenAddress = process.argv[2];
  const toAddress = process.argv[3];
  const amount = process.argv[4];
  const force = process.argv.includes('--force');

  if (!tokenAddress || !toAddress || !amount) {
    console.error('Usage: node transfer-lsp7.js <token-address> <to-address> <amount> [--force]');
    console.error('Example: node transfer-lsp7.js 0x... 0x... 5 --force');
    console.error('Amount is in human-readable format (decimals are queried automatically)');
    process.exit(1);
  }

  transferLSP7(tokenAddress, toAddress, amount, force)
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}

export { transferLSP7 };
