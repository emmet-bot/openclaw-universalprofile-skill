/**
 * LSP-25 ExecuteRelayCall Implementation
 * 
 * This module implements LSP-25 relay calls for Universal Profiles on LUKSO.
 * 
 * IMPLEMENTATION STATUS:
 * ✅ Signature generation is CORRECT (verified: recovered address matches controller)
 * ✅ Direct executeRelayCall on Key Manager works (setData, follow confirmed)
 * ✅ Quota check with relayer works (19M gas available)
 * 
 * TWO EXECUTION METHODS:
 * 
 * 1. DIRECT EXECUTION (recommended - pay gas yourself):
 *    - Call executeRelayCall() directly on the Key Manager
 *    - Controller pays gas (needs LYX in controller wallet)
 *    - Works with current permissions ✓
 *    - No SIGN permission needed
 * 
 * 2. RELAYER API (gasless - relayer pays):
 *    - POST to https://relayer.mainnet.lukso.network/api/execute
 *    - Relayer pays gas from UP's quota
 *    - REQUIRES SIGN permission (0x200000) for ERC-1271 verification
 *    - See: https://github.com/lukso-network/tools-mock-relayer/blob/main/src/modules/relayer/executeAuth.middleware.ts
 * 
 * PERMISSION REQUIREMENTS:
 * | Permission            | Hex       | Direct | Relayer | We Have |
 * |-----------------------|-----------|--------|---------|---------|
 * | EXECUTE_RELAY_CALL    | 0x400000  | ✅     | ✅      | ✅      |
 * | SIGN                  | 0x200000  | ❌     | ✅      | ❌      |
 * | SUPER_TRANSFERVALUE   | 0x100     | ✅*    | ✅*     | ❌      |
 * | SUPER_SETDATA         | 0x20000   | ❌     | ❌      | ✅      |
 * 
 * *Required for sending LYX to other addresses
 * 
 * CURRENT CONTROLLER PERMISSIONS (0x422600):
 * - TRANSFERVALUE (0x200) ✓
 * - SUPER_CALL (0x400) ✓
 * - STATICCALL (0x2000) ✓
 * - SUPER_SETDATA (0x20000) ✓
 * - EXECUTE_RELAY_CALL (0x400000) ✓
 * 
 * WHAT WE CAN DO NOW:
 * - setData on UP (works via direct execution)
 * - Follow/unfollow profiles via LSP26 (works via direct execution)
 * - Call contracts (SUPER_CALL)
 * 
 * WHAT WE NEED FOR:
 * - Gasless transactions (relayer): Add SIGN (0x200000)
 * - Send LYX to others: Add SUPER_TRANSFERVALUE (0x100)
 * 
 * SIGNATURE FORMAT (LSP-25):
 * 1. Message: encodePacked(LSP25_VERSION, chainId, nonce, validityTimestamps, value, payload)
 * 2. Hash: EIP-191 v0 with Key Manager as intended validator
 * 3. Sign the hash using secp256k1 (ECDSA)
 * 
 * References:
 * - LSP-25 Spec: https://github.com/lukso-network/LIPs/blob/main/LSPs/LSP-25-ExecuteRelayCall.md
 * - LSP-15 Relayer API: https://github.com/lukso-network/LIPs/blob/main/LSPs/LSP-15-TransactionRelayServiceAPI.md
 * - Mock Relayer: https://github.com/lukso-network/tools-mock-relayer
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
 * Execute via LUKSO public relayer (gasless transactions)
 * 
 * ⚠️  REQUIRES SIGN PERMISSION (0x200000)
 * The relayer uses ERC-1271 isValidSignature() to verify the signature,
 * which delegates to the Key Manager. Without SIGN permission, this fails.
 * 
 * LSP-15 Request Format:
 * {
 *   "address": "UP address",
 *   "transaction": {
 *     "abi": "payload hex",
 *     "signature": "LSP-25 signature",
 *     "nonce": number,
 *     "validityTimestamps": "optional hex"
 *   }
 * }
 * 
 * @param {string} payload - ABI-encoded function call
 * @param {Object} options - Options
 * @returns {Promise<{transactionHash: string}>}
 * @throws {Error} If controller lacks SIGN permission (401 "Invalid signature")
 */
async function executeRelayCallViaRelayer(payload, options = {}) {
  const { validityTimestamps = 0n, channel = 0, verbose = true } = options;
  
  const keyManager = await getKeyManager();
  const nonce = await getNonce(CONTROLLER_ADDRESS, channel);
  const { signature } = await signRelayCall(keyManager, nonce, validityTimestamps, payload);
  
  // LSP-15 request format
  const requestBody = {
    address: UP_ADDRESS,
    transaction: {
      abi: payload,
      signature: signature,
      nonce: Number(nonce)
    }
  };
  
  if (verbose) {
    console.log('📡 Sending to LUKSO relayer...');
  }
  
  const response = await fetch('https://relayer.mainnet.lukso.network/api/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    if (response.status === 401 && result.message?.includes('Invalid signature')) {
      throw new Error(
        'Relayer requires SIGN permission (0x200000) for ERC-1271 verification. ' +
        'Use executeRelayCallDirect() instead (pays gas from controller wallet).'
      );
    }
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
 * Send LYX to another address
 * 
 * ⚠️  REQUIRES SUPER_TRANSFERVALUE PERMISSION (0x100)
 * Without this permission, the Key Manager will revert with NotAuthorised.
 * 
 * @param {string} recipient - Address to send LYX to
 * @param {string} amount - Amount in LYX (e.g., "1.5")
 * @returns {Promise<{transactionHash: string, status: string}>}
 */
async function sendLYX(recipient, amount) {
  const { parseEther, formatEther } = await import('viem');
  
  console.log('\n💰 Sending LYX');
  console.log('================================================');
  console.log('From:', UP_ADDRESS);
  console.log('To:', recipient);
  console.log('Amount:', amount, 'LYX');
  
  // Create execute payload: CALL (0) to recipient with value
  const payload = encodeFunctionData({
    abi: UP_ABI,
    functionName: 'execute',
    args: [0n, recipient, parseEther(amount), '0x']
  });
  
  try {
    return await executeRelayCallDirect(payload);
  } catch (err) {
    if (err.message.includes('0x6cb60587') || err.message.includes('NotAuthorised')) {
      throw new Error(
        'SUPER_TRANSFERVALUE permission (0x100) required to send LYX. ' +
        'Current permissions do not include this capability.'
      );
    }
    throw err;
  }
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
  sendLYX,
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
} else if (args[0] === 'send' && args[1] && args[2]) {
  sendLYX(args[1], args[2])
    .then(result => {
      console.log('\n✅ Result:', result);
      console.log('Explorer:', `https://explorer.lukso.network/tx/${result.transactionHash}`);
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
      console.log('Explorer:', `https://explorer.lukso.network/tx/${result.transactionHash}`);
    })
    .catch(err => {
      console.error('\n❌ Error:', err.message);
      process.exit(1);
    });
} else if (args[0] === 'quota') {
  checkQuota()
    .then(result => {
      console.log('\n📊 Relay Quota');
      console.log('==============');
      console.log('Available:', result.quota?.toLocaleString(), result.unit);
      console.log('Total:', result.totalQuota?.toLocaleString(), result.unit);
      console.log('Reset:', new Date(result.resetDate * 1000).toLocaleDateString());
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
} else {
  console.log('LSP-25 ExecuteRelayCall Implementation');
  console.log('======================================');
  console.log('');
  console.log('UP Address:', UP_ADDRESS);
  console.log('Controller:', CONTROLLER_ADDRESS);
  console.log('');
  console.log('Usage:');
  console.log('  node lsp25-relay-call.js test                        # Test setData (works ✓)');
  console.log('  node lsp25-relay-call.js follow <UP_ADDRESS>         # Follow a profile (works ✓)');
  console.log('  node lsp25-relay-call.js unfollow <UP_ADDRESS>       # Unfollow a profile (works ✓)');
  console.log('  node lsp25-relay-call.js send <ADDRESS> <AMOUNT>     # Send LYX (needs SUPER_TRANSFERVALUE)');
  console.log('  node lsp25-relay-call.js quota                       # Check relay quota');
  console.log('');
  console.log('Current Permissions (0x422600):');
  console.log('  ✓ TRANSFERVALUE, SUPER_CALL, STATICCALL, SUPER_SETDATA, EXECUTE_RELAY_CALL');
  console.log('');
  console.log('Missing Permissions:');
  console.log('  ✗ SIGN (0x200000) - needed for gasless relayer API');
  console.log('  ✗ SUPER_TRANSFERVALUE (0x100) - needed to send LYX');
  console.log('');
  console.log('Currently uses direct transactions (controller pays gas).');
}
