import { ethers } from 'ethers';
import fs from 'fs';

const credPath = process.env.HOME + '/.clawdbot/credentials/universal-profile-key.json';
const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));

const UP_ADDRESS = creds.universalProfile.address;
const PRIVATE_KEY = creds.controller.privateKey;
const CONTROLLER_ADDRESS = creds.controller.address;

const provider = new ethers.JsonRpcProvider('https://42.rpc.thirdweb.com');

const UP_ABI = ['function owner() view returns (address)', 'function execute(uint256,address,uint256,bytes) payable', 'function setData(bytes32,bytes) payable'];
const KM_ABI = [
  'function getNonce(address, uint128) view returns (uint256)',
  'function getPermissionsFor(address) view returns (bytes32)'
];

const up = new ethers.Contract(UP_ADDRESS, UP_ABI, provider);
const kmAddress = await up.owner();
const km = new ethers.Contract(kmAddress, KM_ABI, provider);

console.log('🐙 Testing Relayer with SIGN Permission');
console.log('========================================');
console.log('Controller:', CONTROLLER_ADDRESS);
console.log('UP:', UP_ADDRESS);

// Check current permissions
console.log('\n🔐 Checking Current Permissions...');
const permissions = await km.getPermissionsFor(CONTROLLER_ADDRESS);
console.log('Permissions:', permissions);
console.log('Has SIGN:', (BigInt(permissions) & BigInt(0x200000)) !== 0n ? '✅' : '❌');
console.log('Has SUPER_TRANSFERVALUE:', (BigInt(permissions) & BigInt(0x100)) !== 0n ? '✅' : '❌');

// 1. Check quota (use UP address, not controller)
console.log('\n📊 Step 1: Checking Quota...');
const timestamp = Math.floor(Date.now() / 1000);
const quotaMessage = ethers.solidityPackedKeccak256(['address', 'uint256'], [UP_ADDRESS, timestamp]);
const quotaSig = new ethers.SigningKey(PRIVATE_KEY).sign(quotaMessage);
const quotaSignature = ethers.Signature.from(quotaSig).serialized;

const quotaResponse = await fetch('https://relayer.mainnet.lukso.network/api/quota', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address: UP_ADDRESS,
    timestamp: timestamp,
    signature: quotaSignature
  })
});

const quotaData = await quotaResponse.json();
console.log('Status:', quotaResponse.status);
console.log('Quota:', JSON.stringify(quotaData, null, 2));

if (!quotaResponse.ok) {
  console.log('\n⚠️  Quota check failed, but continuing with transaction test...');
}

// 2. Try simple setData instead of LYX transfer (since might not have SUPER_TRANSFERVALUE)
console.log('\n📝 Step 2: Testing Relay with setData...');
const testKey = ethers.keccak256(ethers.toUtf8Bytes('RelayerTest'));
const testValue = ethers.toUtf8Bytes('test-' + Date.now());

const payload = up.interface.encodeFunctionData('setData', [testKey, testValue]);

const nonce = await km.getNonce(CONTROLLER_ADDRESS, 0);
console.log('Nonce:', nonce.toString());

// Create LSP25 signature
const chainId = 42;
const LSP25_VERSION = 25;
const validityTimestamps = 0n;
const msgValue = 0n;

const encodedMessage = ethers.solidityPacked(
  ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
  [LSP25_VERSION, chainId, nonce, validityTimestamps, msgValue, payload]
);

const eip191v0Hash = ethers.keccak256(
  ethers.concat(['0x19', '0x00', kmAddress, ethers.getBytes(encodedMessage)])
);

const signingKey = new ethers.SigningKey(PRIVATE_KEY);
const sig = signingKey.sign(eip191v0Hash);
const signature = ethers.Signature.from(sig).serialized;

// Verify locally
const recovered = ethers.recoverAddress(eip191v0Hash, signature);
console.log('Signature verified:', recovered === CONTROLLER_ADDRESS ? '✅' : '❌');

// Send to relayer
const relayRequest = {
  address: UP_ADDRESS,
  transaction: {
    abi: payload,
    signature: signature,
    nonce: parseInt(nonce.toString()),
    validityTimestamps: '0x0'
  }
};

console.log('\n📤 Sending to relayer...');
const response = await fetch('https://relayer.mainnet.lukso.network/api/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(relayRequest)
});

const result = await response.json();
console.log('\n📊 Status:', response.status);
console.log('📨 Response:', JSON.stringify(result, null, 2));

if (response.ok && result.transactionHash) {
  console.log('\n✅ SUCCESS! Relayer API works!');
  console.log('TX:', result.transactionHash);
  console.log('View:', `https://explorer.lukso.network/tx/${result.transactionHash}`);
} else {
  console.log('\n❌ Failed');
}
