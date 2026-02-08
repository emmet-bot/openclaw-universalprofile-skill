import { ethers } from 'ethers';
import fs from 'fs';

const credPath = process.env.HOME + '/.clawdbot/credentials/universal-profile-key.json';
const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));

const UP_ADDRESS = creds.universalProfile.address;
const PRIVATE_KEY = creds.controller.privateKey;
const CONTROLLER_ADDRESS = creds.controller.address;

const provider = new ethers.JsonRpcProvider('https://42.rpc.thirdweb.com');

const UP_ABI = [
  'function owner() view returns (address)',
  'function setData(bytes32,bytes) payable',
  'function getData(bytes32) view returns (bytes)'
];
const KM_ABI = ['function getNonce(address, uint128) view returns (uint256)'];

const up = new ethers.Contract(UP_ADDRESS, UP_ABI, provider);
const kmAddress = await up.owner();
const km = new ethers.Contract(kmAddress, KM_ABI, provider);

console.log('🐙 Testing Relayer API');
console.log('======================');
console.log('UP:', UP_ADDRESS);
console.log('Controller:', CONTROLLER_ADDRESS);
console.log('Key Manager:', kmAddress);

// Check permissions via UP's getData
const permissionsKey = ethers.solidityPackedKeccak256(
  ['bytes10', 'bytes2', 'address'],
  ['0x4b80742de2bf82acb363', '0x0000', CONTROLLER_ADDRESS]
);
const permsData = await up.getData(permissionsKey);
console.log('\nPermissions:', permsData);
console.log('Has SIGN:', (BigInt(permsData) & BigInt(0x200000)) !== 0n ? '✅' : '❌');

// Test relay with simple setData
console.log('\n📝 Testing Relay API...');
const testKey = ethers.keccak256(ethers.toUtf8Bytes('RelayTest'));
const testValue = ethers.toUtf8Bytes('relay-works-' + Date.now());
const payload = up.interface.encodeFunctionData('setData', [testKey, testValue]);

const nonce = await km.getNonce(CONTROLLER_ADDRESS, 0);
console.log('Nonce:', nonce.toString());

// LSP25 signature
const encodedMessage = ethers.solidityPacked(
  ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
  [25, 42, nonce, 0n, 0n, payload]
);

const hash = ethers.keccak256(ethers.concat(['0x19', '0x00', kmAddress, encodedMessage]));
const sig = new ethers.SigningKey(PRIVATE_KEY).sign(hash);
const signature = ethers.Signature.from(sig).serialized;

console.log('Signature verified:', ethers.recoverAddress(hash, signature) === CONTROLLER_ADDRESS ? '✅' : '❌');

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
  console.log('\n✅ SUCCESS! Relayer works with SIGN permission!');
  console.log('TX:', result.transactionHash);
  console.log('View:', `https://explorer.lukso.network/tx/${result.transactionHash}`);
}
