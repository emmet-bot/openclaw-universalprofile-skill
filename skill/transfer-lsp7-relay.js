#!/usr/bin/env node
/**
 * Transfer LSP7 tokens via Relay API (gasless)
 * Tests LSP25 relay execution for token transfers
 */

import { ethers } from 'ethers';
import fs from 'fs';

const credPath = process.env.HOME + '/.clawdbot/credentials/universal-profile-key.json';
const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));

const UP_ADDRESS = creds.universalProfile.address;
const PRIVATE_KEY = creds.controller.privateKey;
const CONTROLLER_ADDRESS = creds.controller.address;

const provider = new ethers.JsonRpcProvider('https://42.rpc.thirdweb.com');

// ABIs
const UP_ABI = [
  'function owner() view returns (address)',
  'function execute(uint256 operation, address target, uint256 value, bytes data) payable returns (bytes)'
];
const KM_ABI = ['function getNonce(address, uint128) view returns (uint256)'];
const LSP7_ABI = [
  'function transfer(address from, address to, uint256 amount, bool force, bytes data) external',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)'
];

async function transferViaRelay(tokenAddress, toAddress, humanAmount) {
  console.log('🐙 Testing LSP7 Transfer via Relay API');
  console.log('========================================');
  console.log('UP:', UP_ADDRESS);
  console.log('Controller:', CONTROLLER_ADDRESS);
  console.log('Token:', tokenAddress);
  console.log('To:', toAddress);
  console.log('Amount:', humanAmount);

  // Get Key Manager
  const up = new ethers.Contract(UP_ADDRESS, UP_ABI, provider);
  const kmAddress = await up.owner();
  const km = new ethers.Contract(kmAddress, KM_ABI, provider);
  console.log('Key Manager:', kmAddress);

  // Query token decimals and convert amount
  const token = new ethers.Contract(tokenAddress, LSP7_ABI, provider);
  const decimals = await token.decimals();
  const amount = ethers.parseUnits(humanAmount, decimals);
  
  // Check balance
  const balance = await token.balanceOf(UP_ADDRESS);
  console.log(`\nToken decimals: ${decimals}`);
  console.log(`Balance: ${ethers.formatUnits(balance, decimals)} tokens`);
  
  if (balance < amount) {
    throw new Error(`Insufficient balance. Have: ${ethers.formatUnits(balance, decimals)}, Need: ${humanAmount}`);
  }

  // Build LSP7 transfer call data
  const transferData = token.interface.encodeFunctionData('transfer', [
    UP_ADDRESS,  // from (the UP itself)
    toAddress,   // to
    amount,      // amount
    true,        // force
    '0x'         // data
  ]);

  // Wrap in UP.execute() call
  const payload = up.interface.encodeFunctionData('execute', [
    0,              // CALL operation
    tokenAddress,   // target (token contract)
    0,              // value (0 LYX)
    transferData    // calldata
  ]);

  // Get nonce
  const nonce = await km.getNonce(CONTROLLER_ADDRESS, 0);
  console.log('\nNonce:', nonce.toString());

  // LSP25 signature
  const encodedMessage = ethers.solidityPacked(
    ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [25, 42, nonce, 0n, 0n, payload]  // version, chainId, nonce, validityTimestamps, value, payload
  );

  const hash = ethers.keccak256(ethers.concat(['0x19', '0x00', kmAddress, encodedMessage]));
  const sig = new ethers.SigningKey(PRIVATE_KEY).sign(hash);
  const signature = ethers.Signature.from(sig).serialized;

  // Verify signature
  const recovered = ethers.recoverAddress(hash, signature);
  console.log('Signature verified:', recovered === CONTROLLER_ADDRESS ? '✅' : '❌');
  
  if (recovered !== CONTROLLER_ADDRESS) {
    throw new Error(`Signature verification failed! Recovered: ${recovered}, Expected: ${CONTROLLER_ADDRESS}`);
  }

  // Send to relayer
  const relayRequest = {
    address: UP_ADDRESS,
    transaction: {
      abi: payload,
      signature,
      nonce: parseInt(nonce.toString()),
      validityTimestamps: '0x0'
    }
  };

  console.log('\n📤 Sending to relayer.mainnet.lukso.network/api/execute...');
  const response = await fetch('https://relayer.mainnet.lukso.network/api/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(relayRequest)
  });

  const result = await response.json();
  console.log('\nStatus:', response.status);
  console.log('Response:', JSON.stringify(result, null, 2));

  if (response.ok && result.transactionHash) {
    console.log('\n✅ SUCCESS! Relay API works!');
    console.log('TX:', result.transactionHash);
    console.log('Explorer:', `https://explorer.lukso.network/tx/${result.transactionHash}`);
    return result.transactionHash;
  } else {
    console.log('\n❌ FAILED!');
    if (response.status === 401) {
      console.log('   → 401 Unauthorized');
      console.log('   → This confirms SIGN permission (0x200000) is needed for relay API');
      console.log('   → Controller currently has: 0x422600 (missing SIGN)');
    }
    throw new Error(`Relay failed: ${response.status} ${JSON.stringify(result)}`);
  }
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const tokenAddress = process.argv[2];
  const toAddress = process.argv[3];
  const amount = process.argv[4];

  if (!tokenAddress || !toAddress || !amount) {
    console.error('Usage: node transfer-lsp7-relay.js <token-address> <to-address> <amount>');
    console.error('Example: node transfer-lsp7-relay.js 0x403b... 0x378B... 1');
    process.exit(1);
  }

  transferViaRelay(tokenAddress, toAddress, amount).catch(error => {
    console.error('\nError:', error.message);
    process.exit(1);
  });
}

export { transferViaRelay };
