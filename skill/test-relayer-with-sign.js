import { ethers } from 'ethers';
import fs from 'fs';

const credPath = process.env.HOME + '/.clawdbot/credentials/universal-profile-key.json';
const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));

const UP_ADDRESS = creds.universalProfile.address;
const PRIVATE_KEY = creds.controller.privateKey;
const CONTROLLER_ADDRESS = creds.controller.address;

const provider = new ethers.JsonRpcProvider('https://42.rpc.thirdweb.com');

const UP_ABI = ['function owner() view returns (address)', 'function execute(uint256,address,uint256,bytes) payable'];
const KM_ABI = ['function getNonce(address, uint128) view returns (uint256)'];

const up = new ethers.Contract(UP_ADDRESS, UP_ABI, provider);
const kmAddress = await up.owner();
const km = new ethers.Contract(kmAddress, KM_ABI, provider);

console.log('🐙 Testing Relayer with SIGN Permission');
console.log('========================================');
console.log('Controller:', CONTROLLER_ADDRESS);
console.log('UP:', UP_ADDRESS);
console.log('Key Manager:', kmAddress);

// 1. Check quota
console.log('\n📊 Step 1: Checking Quota...');
const quotaResponse = await fetch('https://relayer.mainnet.lukso.network/api/quota', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address: CONTROLLER_ADDRESS,
    timestamp: Math.floor(Date.now() / 1000),
    signature: '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
  })
});

const quotaData = await quotaResponse.json();
console.log('Quota Response:', JSON.stringify(quotaData, null, 2));

// 2. Create transaction to send 1 LYX
console.log('\n💸 Step 2: Sending 1 LYX via Relayer...');
const recipient = '0xCDeC110F9c255357E37f46CD2687be1f7E9B02F7'; // Fabian's UP
const amount = ethers.parseEther('1');

const payload = up.interface.encodeFunctionData('execute', [
  0, // CALL operation
  recipient,
  amount,
  '0x'
]);

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
console.log('Signature verified locally:', recovered === CONTROLLER_ADDRESS ? '✅' : '❌');

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
  console.log('\n✅ SUCCESS!');
  console.log('Transaction:', result.transactionHash);
  console.log('Explorer:', `https://explorer.lukso.network/tx/${result.transactionHash}`);
} else {
  console.log('\n❌ Failed');
}
