/**
 * LSP-25 ExecuteRelayCall Implementation
 * 
 * This module implements LSP-25 relay calls for Universal Profiles on LUKSO.
 * 
 * IMPLEMENTATION STATUS:
 * ✅ Signature generation is correct (verified via on-chain direct execution)
 * ✅ Direct transaction execution works (executeRelayCall on Key Manager)
 * ⚠️ LUKSO public relayer returns 401 - likely requires profile registration
 * 
 * The signature format follows LSP-25:
 * 1. Message: encodePacked(LSP25_VERSION, chainId, nonce, validityTimestamps, value, payload)
 * 2. Hash: EIP-191 v0 with Key Manager as intended validator
 * 3. Sign raw hash (NOT using signMessage which adds Ethereum prefix)
 * 
 * References:
 * - LSP-25 Spec: https://github.com/lukso-network/LIPs/blob/main/LSPs/LSP-25-ExecuteRelayCall.md
 * - LUKSO passkey-auth: https://github.com/lukso-network/service-auth-simple/tree/main/packages/passkey-auth
 */

import { EIP191Signer } from '@lukso/eip191-signer.js';
import { 
  encodePacked, 
  createPublicClient, 
  createWalletClient,
  http, 
  parseAbi, 
  keccak256, 
  toHex,
  encodeFunctionData 
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { lukso } from 'viem/chains';
import fs from 'fs';

// Constants
const LSP25_VERSION = 25n;
const LSP26_FOLLOWER_SYSTEM = '0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA';

// Load credentials
const credPath = process.env.HOME + '/.clawdbot/credentials/universal-profile-key.json';
const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));

const UP_ADDRESS = creds.universalProfile.address;
const PRIVATE_KEY = creds.controller.privateKey;
const CONTROLLER_ADDRESS = creds.controller.address;

// Viem clients
const publicClient = createPublicClient({
  chain: lukso,
  transport: http('https://42.rpc.thirdweb.com')
});

const account = privateKeyToAccount(PRIVATE_KEY);
const walletClient = createWalletClient({
  account,
  chain: lukso,
  transport: http('https://42.rpc.thirdweb.com')
});

// ABIs
const UP_ABI = parseAbi([
  'function owner() view returns (address)',
  'function setData(bytes32, bytes) external',
  'function execute(uint256, address, uint256, bytes) external payable returns (bytes)'
]);

const KM_ABI = parseAbi([
  'function getNonce(address, uint128) view returns (uint256)',
  'function executeRelayCall(bytes signature, uint256 nonce, uint256 validityTimestamps, bytes payload) payable returns (bytes)'
]);

const LSP26_ABI = parseAbi([
  'function follow(address addr) external',
  'function unfollow(address addr) external',
  'function isFollowing(address follower, address addr) view returns (bool)'
]);

/**
 * Get Key Manager address for a UP
 */
async function getKeyManager(upAddress = UP_ADDRESS) {
  return await publicClient.readContract({
    address: upAddress,
    abi: UP_ABI,
    functionName: 'owner'
  });
}

/**
 * Get current nonce for a controller on a channel
 */
async function getNonce(controllerAddress = CONTROLLER_ADDRESS, channel = 0) {
  const keyManager = await getKeyManager();
  return await publicClient.readContract({
    address: keyManager,
    abi: KM_ABI,
    functionName: 'getNonce',
    args: [controllerAddress, channel]
  });
}

/**
 * Sign a relay call message with EIP-191 v0
 * @param {string} keyManagerAddress - Key Manager address (intended validator)
 * @param {bigint} nonce - Current nonce
 * @param {bigint} validityTimestamps - Validity timestamps (0 for indefinite)
 * @param {string} payload - ABI-encoded function call
 * @returns {Promise<{signature: string, messageHash: string}>}
 */
async function signRelayCall(keyManagerAddress, nonce, validityTimestamps, payload) {
  const message = encodePacked(
    ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [LSP25_VERSION, BigInt(lukso.id), nonce, validityTimestamps, 0n, payload]
  );
  
  const signer = new EIP191Signer();
  return await signer.signDataWithIntendedValidator(keyManagerAddress, message, PRIVATE_KEY);
}

/**
 * Execute a relay call directly on the Key Manager (paying gas ourselves)
 * This method works and is verified.
 * 
 * @param {string} payload - ABI-encoded function call
 * @param {Object} options - Options
 * @returns {Promise<{transactionHash: string, status: string}>}
 */
async function executeRelayCallDirect(payload, options = {}) {
  const { validityTimestamps = 0n, channel = 0, verbose = true } = options;
  
  if (verbose) {
    console.log('🔗 Universal Profile:', UP_ADDRESS);
    console.log('🔑 Controller:', CONTROLLER_ADDRESS);
  }
  
  const keyManager = await getKeyManager();
  if (verbose) console.log('🔐 Key Manager:', keyManager);
  
  const nonce = await getNonce(CONTROLLER_ADDRESS, channel);
  if (verbose) console.log('🔢 Nonce:', nonce.toString());
  
  const { signature } = await signRelayCall(keyManager, nonce, validityTimestamps, payload);
  if (verbose) console.log('✍️  Signed');
  
  const hash = await walletClient.writeContract({
    address: keyManager,
    abi: KM_ABI,
    functionName: 'executeRelayCall',
    args: [signature, nonce, validityTimestamps, payload]
  });
  
  if (verbose) console.log('📤 Transaction:', hash);
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (verbose) console.log('✅ Status:', receipt.status);
  
  return {
    transactionHash: hash,
    status: receipt.status,
    gasUsed: receipt.gasUsed.toString()
  };
}

/**
 * Try to execute via LUKSO public relayer (currently returns 401)
 * Kept for future use when relayer access is resolved.
 */
async function executeRelayCallViaRelayer(payload, options = {}) {
  const { validityTimestamps = 0n, channel = 0 } = options;
  
  const keyManager = await getKeyManager();
  const nonce = await getNonce(CONTROLLER_ADDRESS, channel);
  const { signature } = await signRelayCall(keyManager, nonce, validityTimestamps, payload);
  
  const requestBody = {
    address: UP_ADDRESS,
    keyManagerAddress: keyManager,
    transaction: {
      abi: payload,
      signature: signature,
      nonce: nonce.toString()
    }
  };
  
  const response = await fetch('https://relayer.mainnet.lukso.network/v1/relayer/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(`Relayer error: ${response.status} - ${JSON.stringify(result)}`);
  }
  
  return result;
}

/**
 * Follow a Universal Profile using LSP26
 * @param {string} targetAddress - UP address to follow
 * @returns {Promise<{transactionHash: string, status: string}>}
 */
async function followProfile(targetAddress) {
  console.log('\n🐙 Following Universal Profile:', targetAddress);
  console.log('================================================');
  
  // Check if already following
  const isFollowing = await publicClient.readContract({
    address: LSP26_FOLLOWER_SYSTEM,
    abi: LSP26_ABI,
    functionName: 'isFollowing',
    args: [UP_ADDRESS, targetAddress]
  });
  
  if (isFollowing) {
    console.log('Already following this profile!');
    return { status: 'already_following' };
  }
  
  // Create follow payload via UP.execute()
  const followData = encodeFunctionData({
    abi: LSP26_ABI,
    functionName: 'follow',
    args: [targetAddress]
  });
  
  const payload = encodeFunctionData({
    abi: UP_ABI,
    functionName: 'execute',
    args: [0n, LSP26_FOLLOWER_SYSTEM, 0n, followData]
  });
  
  return executeRelayCallDirect(payload);
}

/**
 * Unfollow a Universal Profile using LSP26
 */
async function unfollowProfile(targetAddress) {
  console.log('\n🐙 Unfollowing Universal Profile:', targetAddress);
  console.log('================================================');
  
  const unfollowData = encodeFunctionData({
    abi: LSP26_ABI,
    functionName: 'unfollow',
    args: [targetAddress]
  });
  
  const payload = encodeFunctionData({
    abi: UP_ABI,
    functionName: 'execute',
    args: [0n, LSP26_FOLLOWER_SYSTEM, 0n, unfollowData]
  });
  
  return executeRelayCallDirect(payload);
}

/**
 * Set data on UP
 */
async function setData(dataKey, dataValue) {
  console.log('\n📝 Setting data on UP');
  console.log('================================================');
  console.log('Key:', dataKey);
  
  const payload = encodeFunctionData({
    abi: UP_ABI,
    functionName: 'setData',
    args: [dataKey, dataValue]
  });
  
  return executeRelayCallDirect(payload);
}

/**
 * Check relay quota (this works)
 */
async function checkQuota() {
  const timestamp = Math.round(Date.now() / 1000);
  const quotaMessage = keccak256(encodePacked(['bytes', 'uint256'], [UP_ADDRESS, BigInt(timestamp)]));
  const signature = await account.signMessage({ message: { raw: quotaMessage } });
  
  const response = await fetch('https://relayer.mainnet.lukso.network/api/quota', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: UP_ADDRESS,
      timestamp: timestamp,
      signature: signature
    })
  });
  
  return response.json();
}

// Export functions
export {
  executeRelayCallDirect,
  executeRelayCallViaRelayer,
  followProfile,
  unfollowProfile,
  setData,
  signRelayCall,
  getKeyManager,
  getNonce,
  checkQuota,
  UP_ADDRESS,
  CONTROLLER_ADDRESS,
  LSP26_FOLLOWER_SYSTEM
};

// CLI execution
const args = process.argv.slice(2);

if (args[0] === 'follow' && args[1]) {
  followProfile(args[1])
    .then(result => {
      console.log('\n✅ Result:', result);
    })
    .catch(err => {
      console.error('\n❌ Error:', err.message);
      process.exit(1);
    });
} else if (args[0] === 'unfollow' && args[1]) {
  unfollowProfile(args[1])
    .then(result => {
      console.log('\n✅ Result:', result);
    })
    .catch(err => {
      console.error('\n❌ Error:', err.message);
      process.exit(1);
    });
} else if (args[0] === 'test') {
  console.log('\n🧪 Testing LSP-25 Direct Relay Call');
  console.log('================================================');
  
  const testKey = keccak256(toHex('EmmetTest:' + Date.now()));
  const testValue = toHex('test-' + Date.now());
  
  setData(testKey, testValue)
    .then(result => {
      console.log('\n✅ Success!');
      console.log('Transaction hash:', result.transactionHash);
    })
    .catch(err => {
      console.error('\n❌ Error:', err.message);
      process.exit(1);
    });
} else if (args[0] === 'quota') {
  checkQuota()
    .then(result => {
      console.log('Quota:', result);
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
} else {
  console.log('LSP-25 ExecuteRelayCall Implementation');
  console.log('======================================');
  console.log('');
  console.log('Usage:');
  console.log('  node lsp25-relay-call.js test                    # Test setData');
  console.log('  node lsp25-relay-call.js follow <UP_ADDRESS>     # Follow a profile');
  console.log('  node lsp25-relay-call.js unfollow <UP_ADDRESS>   # Unfollow a profile');
  console.log('  node lsp25-relay-call.js quota                   # Check relay quota');
  console.log('');
  console.log('Note: Currently uses direct transactions (paying gas) as the');
  console.log('LUKSO public relayer requires additional profile registration.');
}
