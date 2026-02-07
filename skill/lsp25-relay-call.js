/**
 * LSP-25 ExecuteRelayCall Implementation
 * 
 * Supports both direct transactions (paying gas) and relay service (gasless).
 * 
 * Based on LUKSO's passkey-auth implementation:
 * https://github.com/lukso-network/service-auth-simple/tree/main/packages/passkey-auth
 * 
 * SIGNATURE FORMAT (LSP-25):
 * 1. Message: abi.encodePacked(LSP25_VERSION, chainId, nonce, validityTimestamps, value, payload)
 * 2. Hash: EIP-191 v0 - keccak256(0x19 || 0x00 || keyManagerAddress || message)
 * 3. Sign the raw hash (NOT using signMessage which adds Ethereum Signed Message prefix!)
 * 
 * NOTE: The LUKSO relay service may reject valid signatures for UPs not created through
 * their wallet. Direct transactions always work for valid signatures.
 */

import { ethers } from 'ethers';
import fs from 'fs';

// Constants
const LSP25_VERSION = 25;
const LUKSO_CHAIN_ID = 42;

// LUKSO Relayer URL
const RELAYER_URL_MAINNET = 'https://relayer.mainnet.lukso.network/v1/relayer/execute';
const RELAYER_URL_TESTNET = 'https://relayer.testnet.lukso.network/v1/relayer/execute';

// Load credentials
const credPath = process.env.HOME + '/.clawdbot/credentials/universal-profile-key.json';
const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));

const UP_ADDRESS = creds.universalProfile.address;
const PRIVATE_KEY = creds.controller.privateKey;
const CONTROLLER_ADDRESS = creds.controller.address;

// Connect to LUKSO
const provider = new ethers.JsonRpcProvider('https://42.rpc.thirdweb.com');

// ABIs
const UP_ABI = [
  'function owner() view returns (address)',
  'function setData(bytes32 dataKey, bytes memory dataValue)',
  'function setData(bytes32[] memory dataKeys, bytes[] memory dataValues)',
  'function execute(uint256 operationType, address target, uint256 value, bytes memory data) payable returns (bytes)',
];

const KM_ABI = [
  'function getNonce(address signer, uint128 channel) view returns (uint256)',
  'function executeRelayCall(bytes signature, uint256 nonce, uint256 validityTimestamps, bytes payload) payable returns (bytes)',
];

/**
 * Hash data with intended validator (EIP-191 version 0)
 * Format: keccak256(0x19 || 0x00 || validatorAddress || data)
 */
function hashDataWithIntendedValidator(validatorAddress, data) {
  const preamble = new Uint8Array([0x19, 0x00]);
  const validatorBytes = ethers.getBytes(validatorAddress);
  const dataBytes = ethers.getBytes(data);
  
  const message = new Uint8Array(preamble.length + validatorBytes.length + dataBytes.length);
  message.set(preamble, 0);
  message.set(validatorBytes, preamble.length);
  message.set(dataBytes, preamble.length + validatorBytes.length);
  
  return ethers.keccak256(message);
}

/**
 * Create LSP-25 encoded message for signing
 */
function createLSP25Message(chainId, nonce, validityTimestamps, value, payload) {
  return ethers.solidityPacked(
    ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [LSP25_VERSION, chainId, nonce, validityTimestamps, value, payload]
  );
}

/**
 * Sign with EIP-191 v0 format
 */
function signLSP25Message(keyManagerAddress, encodedMessage, privateKey) {
  const hash = hashDataWithIntendedValidator(keyManagerAddress, encodedMessage);
  const signingKey = new ethers.SigningKey(privateKey);
  const sig = signingKey.sign(hash);
  return ethers.Signature.from(sig).serialized;
}

/**
 * Verify signature locally
 */
function verifyLSP25Signature(keyManagerAddress, encodedMessage, signature) {
  const hash = hashDataWithIntendedValidator(keyManagerAddress, encodedMessage);
  return ethers.recoverAddress(hash, signature);
}

/**
 * Execute relay call - DIRECT mode (pays gas, always works)
 */
async function executeRelayCallDirect(payload, options = {}) {
  const { 
    value = 0, 
    validityTimestamps = 0n,
    channel = 0,
    verbose = true 
  } = options;
  
  if (verbose) {
    console.log('🔗 Universal Profile:', UP_ADDRESS);
    console.log('🔑 Controller:', CONTROLLER_ADDRESS);
  }
  
  const up = new ethers.Contract(UP_ADDRESS, UP_ABI, provider);
  const keyManagerAddress = await up.owner();
  if (verbose) console.log('🔐 Key Manager:', keyManagerAddress);
  
  const km = new ethers.Contract(keyManagerAddress, KM_ABI, provider);
  const nonce = await km.getNonce(CONTROLLER_ADDRESS, channel);
  if (verbose) console.log('🔢 Nonce:', nonce.toString());
  
  // Create message and sign
  const encodedMessage = createLSP25Message(
    LUKSO_CHAIN_ID,
    nonce,
    validityTimestamps,
    value,
    payload
  );
  
  const signature = signLSP25Message(keyManagerAddress, encodedMessage, PRIVATE_KEY);
  
  // Verify locally
  const recoveredAddress = verifyLSP25Signature(keyManagerAddress, encodedMessage, signature);
  if (recoveredAddress.toLowerCase() !== CONTROLLER_ADDRESS.toLowerCase()) {
    throw new Error(`Signature verification failed! Expected ${CONTROLLER_ADDRESS}, got ${recoveredAddress}`);
  }
  if (verbose) console.log('✍️  Signature verified locally');
  
  // Execute directly using controller wallet
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const kmWithSigner = new ethers.Contract(keyManagerAddress, KM_ABI, wallet);
  
  if (verbose) console.log('\n📤 Sending direct transaction...');
  
  const tx = await kmWithSigner.executeRelayCall(
    signature,
    nonce,
    validityTimestamps,
    payload
  );
  
  if (verbose) console.log('📊 TX Hash:', tx.hash);
  
  const receipt = await tx.wait();
  
  return {
    transactionHash: tx.hash,
    status: receipt.status === 1 ? 'success' : 'failed',
    gasUsed: receipt.gasUsed.toString(),
    blockNumber: receipt.blockNumber
  };
}

/**
 * Execute relay call - RELAY mode (gasless, may not work for all UPs)
 */
async function executeRelayCallRelay(payload, options = {}) {
  const { 
    value = 0, 
    validityTimestamps = 0n,
    channel = 0,
    useTestnet = false,
    verbose = true 
  } = options;
  
  if (verbose) {
    console.log('🔗 Universal Profile:', UP_ADDRESS);
    console.log('🔑 Controller:', CONTROLLER_ADDRESS);
  }
  
  const up = new ethers.Contract(UP_ADDRESS, UP_ABI, provider);
  const keyManagerAddress = await up.owner();
  if (verbose) console.log('🔐 Key Manager:', keyManagerAddress);
  
  const km = new ethers.Contract(keyManagerAddress, KM_ABI, provider);
  const nonce = await km.getNonce(CONTROLLER_ADDRESS, channel);
  if (verbose) console.log('🔢 Nonce:', nonce.toString());
  
  // Create message and sign
  const encodedMessage = createLSP25Message(
    LUKSO_CHAIN_ID,
    nonce,
    validityTimestamps,
    value,
    payload
  );
  
  const signature = signLSP25Message(keyManagerAddress, encodedMessage, PRIVATE_KEY);
  
  // Verify locally
  const recoveredAddress = verifyLSP25Signature(keyManagerAddress, encodedMessage, signature);
  if (recoveredAddress.toLowerCase() !== CONTROLLER_ADDRESS.toLowerCase()) {
    throw new Error(`Signature verification failed! Expected ${CONTROLLER_ADDRESS}, got ${recoveredAddress}`);
  }
  if (verbose) console.log('✍️  Signature verified locally');
  
  // Prepare relay request (matches passkey-auth TransactionRequest)
  const relayRequest = {
    address: UP_ADDRESS,
    keyManagerAddress: keyManagerAddress,
    transaction: {
      abi: payload,
      signature: signature,
      nonce: nonce.toString()
    }
  };
  
  const relayerUrl = useTestnet ? RELAYER_URL_TESTNET : RELAYER_URL_MAINNET;
  if (verbose) {
    console.log('\n📤 Sending to relayer:', relayerUrl);
  }
  
  const response = await fetch(relayerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(relayRequest)
  });
  
  const result = await response.json();
  if (verbose) {
    console.log('📊 Response:', response.status, response.statusText);
  }
  
  if (!response.ok) {
    throw new Error(`Relay error: ${response.status} - ${JSON.stringify(result)}`);
  }
  
  return result;
}

/**
 * Execute relay call - auto-selects mode
 * Tries relay first, falls back to direct if relay fails
 */
async function executeRelayCall(payload, options = {}) {
  const { useRelay = false, ...restOptions } = options;
  
  if (useRelay) {
    try {
      return await executeRelayCallRelay(payload, restOptions);
    } catch (error) {
      console.log('⚠️  Relay failed, falling back to direct:', error.message);
    }
  }
  
  return executeRelayCallDirect(payload, restOptions);
}

/**
 * Follow a Universal Profile
 */
async function followProfile(targetAddress, options = {}) {
  console.log('\n🐙 Following Universal Profile:', targetAddress);
  console.log('================================================');
  
  const up = new ethers.Contract(UP_ADDRESS, UP_ABI, provider);
  
  // Create a custom data key for "following"
  const followKey = ethers.keccak256(ethers.toUtf8Bytes('LSP10Following:' + targetAddress.toLowerCase()));
  const followValue = ethers.toUtf8Bytes('true');
  
  const payload = up.interface.encodeFunctionData('setData(bytes32,bytes)', [followKey, followValue]);
  
  return executeRelayCall(payload, options);
}

// Export functions
export {
  executeRelayCall,
  executeRelayCallDirect,
  executeRelayCallRelay,
  followProfile,
  signLSP25Message,
  createLSP25Message,
  hashDataWithIntendedValidator,
  verifyLSP25Signature,
  UP_ADDRESS,
  CONTROLLER_ADDRESS,
  LSP25_VERSION,
  LUKSO_CHAIN_ID,
  RELAYER_URL_MAINNET,
  RELAYER_URL_TESTNET
};

// CLI
const args = process.argv.slice(2);
if (args[0] === 'follow' && args[1]) {
  const useRelay = args.includes('--relay');
  followProfile(args[1], { useRelay })
    .then(result => {
      console.log('\n✅ Success!');
      console.log('Transaction hash:', result.transactionHash);
    })
    .catch(err => {
      console.error('\n❌ Error:', err.message);
      process.exit(1);
    });
} else if (args[0] === 'test') {
  const useRelay = args.includes('--relay');
  console.log('\n🧪 Testing LSP-25 Relay Call');
  console.log('Mode:', useRelay ? 'RELAY' : 'DIRECT');
  console.log('================================================');
  
  const up = new ethers.Contract(UP_ADDRESS, UP_ABI, provider);
  const testKey = ethers.keccak256(ethers.toUtf8Bytes('EmmetTest:' + Date.now()));
  const testValue = ethers.toUtf8Bytes('test-value-' + Date.now());
  
  const payload = up.interface.encodeFunctionData('setData(bytes32,bytes)', [testKey, testValue]);
  
  executeRelayCall(payload, { useRelay })
    .then(result => {
      console.log('\n✅ Success!');
      console.log('Transaction hash:', result.transactionHash);
    })
    .catch(err => {
      console.error('\n❌ Error:', err.message);
      process.exit(1);
    });
} else {
  console.log('Usage:');
  console.log('  node lsp25-relay-call.js test [--relay]');
  console.log('  node lsp25-relay-call.js follow <UP_ADDRESS> [--relay]');
  console.log('');
  console.log('Options:');
  console.log('  --relay    Try relay service first (falls back to direct if fails)');
  console.log('');
  console.log('Note: Direct mode pays gas, relay mode is gasless but may not work for all UPs');
}
