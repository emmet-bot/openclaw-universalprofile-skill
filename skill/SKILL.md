---
name: universal-profile
description: Manage LUKSO Universal Profiles — identity, permissions, tokens, and blockchain operations via direct or gasless relay transactions
version: 0.1.0
author: LUKSO
---

# Universal Profile Skill

> ⚠️ **Early Draft Version** — This skill is under active development. Use at your own risk.

Interact with [LUKSO](https://lukso.network) Universal Profiles from OpenClaw. Provides CLI commands and a programmatic API for profile management, permission handling, token operations, and transaction execution — including gasless relay transactions via LSP25.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Setup & Authorization](#2-setup--authorization)
3. [CLI Commands](#3-cli-commands)
4. [Direct Transactions](#4-direct-transactions)
5. [Execute Relay Call (Gasless Transactions)](#5-execute-relay-call-gasless-transactions)
6. [LSP Standards Reference](#6-lsp-standards-reference)
7. [Smart Contract Interfaces](#7-smart-contract-interfaces)
8. [Permission System](#8-permission-system)
9. [ERC725Y Data Keys Reference](#9-erc725y-data-keys-reference)
10. [Security Best Practices](#10-security-best-practices)
11. [Error Handling](#11-error-handling)
12. [Network Configuration](#12-network-configuration)

---

## 1. Overview

### What Are Universal Profiles?

A **Universal Profile (UP)** is a smart contract–based blockchain account on LUKSO built on LSP0 (ERC725Account). Unlike EOAs, Universal Profiles provide:

- **On-chain data storage** — Profile metadata, asset lists, permissions (ERC725Y key-value store)
- **Granular access control** — Multiple controller keys with fine-grained permissions (LSP6 Key Manager)
- **Gasless transactions** — Third parties execute transactions on your behalf via relay calls (LSP25)
- **Notification hooks** — React to incoming tokens, ownership changes (LSP1 Universal Receiver)
- **Extensibility** — Add new functionality without redeploying (LSP17 Contract Extension)
- **Secure ownership transfer** — Two-step process prevents accidental loss (LSP14)

### Architecture

```
┌──────────────────────────────────────────────────┐
│              Universal Profile (LSP0)             │
│  ERC725X (execute) + ERC725Y (data) + LSP1 +     │
│  LSP14 (ownership) + LSP17 (extensions) + LSP20  │
└───────────────────────┬──────────────────────────┘
                        │ owner
           ┌────────────▼────────────┐
           │    Key Manager (LSP6)    │
           │  Permissions stored in   │
           │  UP's ERC725Y storage    │
           └─────────────┬───────────┘
                         │
        ┌────────────────┼────────────────┐
   Controller A     Controller B     Controller C
   (CALL, SIGN)    (SETDATA)        (TRANSFERVALUE)
```

### The LSP Ecosystem

| Standard | Name | Purpose |
|----------|------|---------|
| LSP0 | ERC725Account | Smart contract account (Universal Profile) |
| LSP1 | UniversalReceiver | Notification hooks for incoming interactions |
| LSP2 | ERC725Y JSON Schema | Standardized key encoding for on-chain data |
| LSP3 | Profile Metadata | Name, description, avatar, links, tags |
| LSP4 | Digital Asset Metadata | Token name, symbol, type, creators |
| LSP5 | ReceivedAssets | Tracks tokens/NFTs owned by a profile |
| LSP6 | KeyManager | Permission-based access control |
| LSP7 | DigitalAsset | Fungible token standard (like ERC20 + notifications) |
| LSP8 | IdentifiableDigitalAsset | NFT standard (bytes32 token IDs + notifications) |
| LSP9 | Vault | Sub-account for asset segregation |
| LSP10 | ReceivedVaults | Tracks vaults owned by a profile |
| LSP12 | IssuedAssets | Tracks assets created by a profile |
| LSP14 | Ownable2Step | Two-step ownership transfer |
| LSP16 | UniversalFactory | Deterministic CREATE2 deployment |
| LSP17 | ContractExtension | Add functions without redeploying |
| LSP20 | CallVerification | Permission checking between UP and Key Manager |
| LSP23 | LinkedContractsFactory | Deploy UP + Key Manager together |
| LSP25 | ExecuteRelayCall | Meta-transaction / gasless execution |
| LSP26 | FollowerSystem | On-chain follow/unfollow |

---

## 2. Setup & Authorization

### Step 1: Generate a Controller Key

```bash
up key generate --save --password <your-password>
```

Creates an encrypted keypair (AES-256-GCM, PBKDF2 100k iterations). **Never share the private key.**

### Step 2: Authorize the Controller

Visit the authorization UI: **<https://lukso-network.github.io/openclaw-universalprofile-skill/>**

1. Connect your Universal Profile (UP Browser Extension)
2. Paste the controller address from Step 1
3. Select a permission preset or customize
4. Submit the transaction

Or generate a URL from CLI: `up authorize url --permissions defi-trader`

### Step 3: Configure

```bash
up profile configure 0xYourUPAddress --chain lukso
```

### Step 4: Verify

```bash
up status
```

### Credential Loading

The skill checks multiple locations for credentials (in order):

1. **Environment variable:** `UP_CREDENTIALS_PATH`
2. **OpenClaw standard:** `~/.openclaw/universal-profile/config.json`
3. **Legacy location:** `~/.clawdbot/universal-profile/config.json`
4. **Local directory:** `./credentials/config.json`

Key files are searched in similar locations:
- `UP_KEY_PATH` environment variable
- `~/.openclaw/credentials/universal-profile-key.json`
- `~/.clawdbot/credentials/universal-profile-key.json`

### Configuration File

```json
{
  "version": "1.0.0",
  "network": "lukso-mainnet",
  "rpc": {
    "lukso-mainnet": "https://42.rpc.thirdweb.com",
    "lukso-testnet": "https://rpc.testnet.lukso.network"
  },
  "universalProfile": {
    "address": "0xYourUPAddress",
    "keyManager": "0xAutoDetectedKMAddress"
  },
  "controllerKey": {
    "address": "0xControllerAddress",
    "label": "default",
    "encrypted": true,
    "path": "/path/to/keystore.json"
  },
  "relay": {
    "enabled": true,
    "url": "https://relayer.lukso.network",
    "fallbackToDirect": true
  }
}
```

### Module Architecture

The skill is organized into modular layers for maintainability and extensibility:

```
skill/
├── lib/
│   ├── constants.js          # Permissions, ABIs, data keys, explorer URLs
│   ├── credentials.js        # Flexible credential loading
│   ├── provider.js           # RPC provider setup
│   │
│   ├── execute/              # GENERIC execution layer
│   │   ├── direct.js         # Direct transactions (controller pays gas)
│   │   └── relay.js          # Relay API (gasless via LSP25)
│   │
│   ├── up/                   # Universal Profile operations
│   │   ├── execute.js        # Wrap calls in UP.execute()
│   │   ├── data.js           # setData, getData
│   │   └── social.js         # follow, unfollow (LSP26)
│   │
│   └── tokens/               # Token-specific modules
│       ├── lsp7.js           # LSP7 Digital Assets (fungible)
│       └── lsp8.js           # LSP8 NFTs (identifiable)
│
├── cli/                      # CLI commands
│   ├── transfer.js           # Token transfers
│   ├── query.js              # Query assets/balances
│   └── profile.js            # Profile operations
│
└── examples/                 # Usage examples
```

**Design Principles:**

1. **Separation of Concerns:**
   - Execute layer handles HOW (direct vs relay)
   - Token modules handle WHAT (LSP7, LSP8 payloads)
   - Neither depends on the other

2. **Generic Relay Execution:**
   - `executeRelay(payload)` works with ANY payload
   - Token modules just build payloads
   - Easy to add new token types or operations

3. **Usage Example:**
   ```javascript
   import { executeRelay } from './lib/execute/relay.js';
   import { buildExecutePayload } from './lib/up/execute.js';
   import { buildTransferPayload } from './lib/tokens/lsp7.js';

   // Build token transfer → wrap in UP.execute → send via relay
   const tokenPayload = buildTransferPayload(token, from, to, amount, true);
   const upPayload = buildExecutePayload(0, token, 0, tokenPayload);
   const txHash = await executeRelay(upPayload);  // or executeDirect(upPayload)
   ```

---

## 3. CLI Commands

All commands use the `up` prefix.

### Key Management

```bash
up key generate [--save] [--password <pw>]   # Generate a new controller keypair
up key list                                   # List stored keys
```

### Status & Profile

```bash
up status [--chain <chain>]                                            # Config, keys, connectivity
up profile info [<address>] [--chain <chain>]                          # Profile details
up profile configure <address> [--key-manager <km>] [--chain <chain>]  # Save UP for use
```

### Permissions

```bash
up permissions encode <perm1> [<perm2> ...]   # Encode to bytes32 hex
up permissions decode <hex>                    # Decode to permission names
up permissions presets                         # List presets with risk levels
up permissions validate <hex>                  # Security audit
```

### Authorization

```bash
up authorize url [--permissions <preset|hex>] [--chain <chain>]
```

**Presets:** `read-only` (🟢) | `token-operator` (🟡) | `nft-trader` (🟡) | `defi-trader` (🟠) | `profile-manager` (🟡) | `full-access` (🔴)

### Configuration

```bash
up config show                # Full JSON config
up config set <key> <value>   # Set defaultChain, keystorePath, etc.
up help                       # All commands
```

---

## 4. Direct Transactions

When the controller has LYX, call the Key Manager's `execute()` directly. The controller pays gas.

```
Controller EOA → KeyManager.execute(payload) → UP.execute(...) → Target
```

### ethers.js v6 Examples

```javascript
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://42.rpc.thirdweb.com');
const signer = new ethers.Wallet('0xCONTROLLER_PRIVATE_KEY', provider);

const UP_ABI = [
  'function execute(uint256 operationType, address target, uint256 value, bytes data) payable returns (bytes)',
  'function setData(bytes32 dataKey, bytes dataValue)',
];
const KM_ABI = ['function execute(bytes calldata payload) payable returns (bytes)'];

const up = new ethers.Contract('0xUPAddress', UP_ABI, signer);
const km = new ethers.Contract('0xKMAddress', KM_ABI, signer);

// Transfer LYX
const payload = up.interface.encodeFunctionData('execute', [
  0, '0xRecipient', ethers.parseEther('1.5'), '0x',
]);
await (await km.execute(payload)).wait();

// Transfer LSP7 Token
const tokenIface = new ethers.Interface([
  'function transfer(address from, address to, uint256 amount, bool force, bytes data)',
]);
const calldata = tokenIface.encodeFunctionData('transfer', [
  '0xUPAddress', '0xRecipient', ethers.parseEther('100'), false, '0x',
]);
const payload2 = up.interface.encodeFunctionData('execute', [0, '0xTokenContract', 0n, calldata]);
await (await km.execute(payload2)).wait();
```

### Skill API

```javascript
import { createUniversalProfileSkill } from 'openclaw-universalprofile-skill';
const skill = createUniversalProfileSkill({ network: 'lukso-mainnet', privateKey: '0x...' });

await skill.execute({ operationType: 0, target: '0xRecipient', value: ethers.parseEther('1.5'), data: '0x' });
await skill.transferToken('0xTokenAddr', '0xRecipient', ethers.parseEther('100'));
await skill.transferNFT('0xCollectionAddr', '0xRecipient', '0xTokenId');
```

---

## 5. Execute Relay Call (Gasless Transactions)

The `executeRelayCall` mechanism (LSP25) lets a third party submit transactions on behalf of a controller — the controller signs but **pays no gas**.

### When to Use

- Controller has **no LYX** for gas
- UP registered with a **relay service** with available quota
- You want **gasless UX**

> Users who created their UP via [universalprofile.cloud](https://universalprofile.cloud) have a monthly gas quota paid by LUKSO.

### How It Works

1. Controller signs a message off-chain (payload + nonce + validity + chainId)
2. Signature + params sent to relayer or submitted on-chain by another account
3. Relayer calls `KeyManager.executeRelayCall(signature, nonce, validityTimestamps, payload)`
4. Key Manager verifies signature, checks permissions, forwards to UP
5. Relayer pays gas

### Nonce Channels

Each controller has nonces per **channel** (uint128). Same channel = sequential; different channels = parallel.

```javascript
const nonce = await keyManager.getNonce(controllerAddress, 0);  // channel 0
```

The nonce uint256: upper 128 bits = channel ID, lower 128 bits = sequential nonce.

### Validity Timestamps

Packed `uint256`: `(startTimestamp << 128) | endTimestamp`. Use `0` for no restriction.

```javascript
function createValidityTimestamps(duration = 3600) {
  const now = Math.floor(Date.now() / 1000);
  return (BigInt(now) << 128n) | BigInt(now + duration);
}
```

### LSP25 Signature Format

The signature MUST be constructed using EIP-191 version 0 ("intended validator"):

```javascript
// Step 1: Encode the message (same as Solidity's abi.encodePacked)
const encodedMessage = ethers.solidityPacked(
  ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
  [25, chainId, nonce, validityTimestamps, msgValue, abiPayload]
  // 25 = LSP25_VERSION (always 25)
);

// Step 2: Create EIP-191 v0 hash with Key Manager as intended validator
// Format: keccak256(0x19 || 0x00 || keyManagerAddress || encodedMessage)
function hashDataWithIntendedValidator(validatorAddress, data) {
  const prefix = new Uint8Array([0x19, 0x00]);
  const validatorBytes = ethers.getBytes(validatorAddress);
  const dataBytes = ethers.getBytes(data);
  
  const message = new Uint8Array(prefix.length + validatorBytes.length + dataBytes.length);
  message.set(prefix, 0);
  message.set(validatorBytes, prefix.length);
  message.set(dataBytes, prefix.length + validatorBytes.length);
  
  return ethers.keccak256(message);
}
const hash = hashDataWithIntendedValidator(keyManagerAddress, encodedMessage);

// Step 3: Sign the raw hash (NOT signMessage - that adds wrong prefix!)
const signingKey = new ethers.SigningKey(privateKey);
const sig = signingKey.sign(hash);
const signature = ethers.Signature.from(sig).serialized;
```

**CRITICAL:** Do NOT use `signer.signMessage()` - it adds an "Ethereum Signed Message" prefix (EIP-191 v45) which is wrong. Use `SigningKey.sign()` on the raw hash.

Alternatively, use the [@lukso/eip191-signer.js](https://www.npmjs.com/package/@lukso/eip191-signer.js) library:

```javascript
import { EIP191Signer } from '@lukso/eip191-signer.js';
const eip191Signer = new EIP191Signer();
const { signature } = await eip191Signer.signDataWithIntendedValidator(
  keyManagerAddress, // The Key Manager contract address
  encodedMessage,    // The packed message
  privateKey         // Controller's private key (hex with 0x prefix)
);
```

### Complete Example: Gasless LYX Transfer

```javascript
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://42.rpc.thirdweb.com');
const CONTROLLER_PRIVATE_KEY = '0xYOUR_CONTROLLER_PRIVATE_KEY';
const UP_ADDRESS = '0xYourUPAddress';
const CONTROLLER_ADDRESS = '0xYourControllerAddress';

// Get Key Manager address
const up = new ethers.Contract(UP_ADDRESS, ['function owner() view returns (address)'], provider);
const keyManagerAddress = await up.owner();

const km = new ethers.Contract(keyManagerAddress, [
  'function executeRelayCall(bytes, uint256, uint256, bytes) payable returns (bytes)',
  'function getNonce(address, uint128) view returns (uint256)',
], provider);

// 1. Encode payload
const upIface = new ethers.Interface([
  'function execute(uint256, address, uint256, bytes) payable returns (bytes)',
]);
const payload = upIface.encodeFunctionData('execute', [
  0, '0xRecipient', ethers.parseEther('3'), '0x',
]);

// 2. Get nonce
const nonce = await km.getNonce(CONTROLLER_ADDRESS, 0);
const chainId = 42; // LUKSO mainnet

// 3. Create LSP25 encoded message
const encodedMessage = ethers.solidityPacked(
  ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
  [25, chainId, nonce, 0n, 0n, payload]  // 25 = LSP25_VERSION
);

// 4. Create EIP-191 v0 hash with Key Manager as validator
function hashDataWithIntendedValidator(validatorAddress, data) {
  const prefix = new Uint8Array([0x19, 0x00]);
  const validatorBytes = ethers.getBytes(validatorAddress);
  const dataBytes = ethers.getBytes(data);
  const message = new Uint8Array(prefix.length + validatorBytes.length + dataBytes.length);
  message.set(prefix, 0);
  message.set(validatorBytes, prefix.length);
  message.set(dataBytes, prefix.length + validatorBytes.length);
  return ethers.keccak256(message);
}
const hash = hashDataWithIntendedValidator(keyManagerAddress, encodedMessage);

// 5. Sign the raw hash (NOT signMessage!)
const signingKey = new ethers.SigningKey(CONTROLLER_PRIVATE_KEY);
const sig = signingKey.sign(hash);
const signature = ethers.Signature.from(sig).serialized;

// 6a. Send to relay service (LSP-15 format)
// Mainnet: https://relayer.lukso.network/v1/relayer/execute
// Testnet: https://relayer.testnet.lukso.network/v1/relayer/execute
await fetch('https://relayer.lukso.network/v1/relayer/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address: UP_ADDRESS,  // Universal Profile address (NOT Key Manager!)
    transaction: {
      abi: payload,       // The payload to execute on UP
      signature: signature,
      nonce: Number(nonce),
      validityTimestamps: '0x0'  // hex string, 0 = valid indefinitely
    }
  }),
});

// 6b. Or execute on-chain directly (funded account pays gas)
const relayer = new ethers.Wallet('0xFUNDED_RELAYER_KEY', provider);
await (await km.connect(relayer).executeRelayCall(signature, nonce, 0n, payload)).wait();
```

### Skill Relay API

```javascript
import { executeViaRelay, setDataViaRelay, checkRelayQuota } from 'openclaw-universalprofile-skill';

// High-level: handles nonce, signing, execution automatically
const result = await executeViaRelay(signer, upAddr, kmAddr,
  { operationType: 0, target: '0xRecipient', value: ethers.parseEther('1'), data: '0x' },
  { relayerUrl: 'https://relayer.lukso.network', validityDuration: 3600 }
);
console.log('TX:', result.transactionHash);

// Set data via relay
await setDataViaRelay(signer, upAddr, kmAddr, dataKey, dataValue, { relayerUrl: '...' });

// Check quota
const quota = await checkRelayQuota('https://relayer.lukso.network', upAddr);
```

### Relay Service Endpoints (LSP-15)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/relayer/execute` | POST | Submit signed relay transaction (LSP-15 format) |
| `/v1/relayer/quota` | POST | Check remaining quota |

**URLs:**
- Mainnet: `https://relayer.lukso.network/v1/relayer/execute`
- Testnet: `https://relayer.testnet.lukso.network/v1/relayer/execute`

**LSP-15 Request Format:**
```json
{
  "address": "0xUPAddress",
  "transaction": {
    "abi": "0x...",  // The payload (e.g., setData call)
    "signature": "0x...",
    "nonce": "0",
    "validityTimestamps": "0x0"  // Optional, 0 = indefinite
  }
}
```

**Response:**
```json
{
  "transactionHash": "0x..."
}
```

See [LSP-15-TransactionRelayServiceAPI](https://github.com/lukso-network/LIPs/blob/main/LSPs/LSP-15-TransactionRelayServiceAPI.md) for full spec.

### Direct vs. Relay

| Scenario | Direct | Relay |
|----------|--------|-------|
| Controller has LYX | ✅ | Optional |
| Controller has no LYX | ❌ | ✅ |
| UP registered with relay | Either | ✅ |
| Need immediate execution | ✅ | Depends |

---

## 6. LSP Standards Reference

### LSP0 — ERC725Account (Universal Profile)
**Interface ID:** `0x24871b3d` — Smart contract account combining ERC725X (execute), ERC725Y (data), LSP1 (notifications), LSP14 (ownership), LSP17 (extensions), LSP20 (verification). Operation types: CALL=0, CREATE=1, CREATE2=2, STATICCALL=3, DELEGATECALL=4.

### LSP1 — UniversalReceiver
**Interface IDs:** `0x6bb56a14` / `0xa245bbda` (delegate) — Notification hook called when UP receives tokens/value. URD contract auto-registers assets in LSP5.

### LSP2 — ERC725Y JSON Schema
Key encoding: **Singleton** `keccak256(name)`, **Array** base key (length) + `bytes16(base)+bytes16(index)`, **Mapping** `bytes10(keccak256(first))+0000+bytes20(second)`.

### LSP3 — Profile Metadata
Profile JSON (name, description, links, tags, profileImage, backgroundImage, avatar) stored as VerifiableURI.

### LSP4 — Digital Asset Metadata
Token metadata (name, symbol, type, creators). Token types: 0=Fungible, 1=Single NFT, 2=Collection.

### LSP5 — ReceivedAssets
On-chain array tracking tokens/NFTs held by a profile. Auto-managed by URD.

### LSP6 — KeyManager
**Interface ID:** `0x23f34c62` — Permission engine. Functions: `execute()`, `executeRelayCall()`, `getNonce()`. See [Section 8](#8-permission-system).

### LSP7 — DigitalAsset (Fungible)
**Interface ID:** `0xc52d6008` — Fungible tokens with LSP1 notifications, `force` parameter (false=safe transfer), rich metadata, batch transfers.

### LSP8 — IdentifiableDigitalAsset (NFT)
**Interface ID:** `0x3a271706` — NFTs with `bytes32` token IDs (formats: uint256/string/address/hash), per-token metadata, LSP1 hooks.

### LSP9 — Vault
**Interface ID:** `0x28af17e6` — Sub-account with own ERC725X/Y storage for asset segregation.

### LSP14 — Ownable2Step
**Interface ID:** `0x94be5999` — `transferOwnership()` → `acceptOwnership()`.

### LSP25 — ExecuteRelayCall
**Interface ID:** `0x5ac79908` — Version 25. See [Section 5](#5-execute-relay-call-gasless-transactions).

### LSP26 — FollowerSystem
**Interface ID:** `0x2b299cea` — On-chain follow/unfollow with LSP1 notifications.

---

## 7. Smart Contract Interfaces

### Universal Profile (LSP0) ABI

```javascript
const LSP0_ABI = [
  'function execute(uint256 operationType, address target, uint256 value, bytes data) payable returns (bytes)',
  'function executeBatch(uint256[] operationTypes, address[] targets, uint256[] values, bytes[] datas) payable returns (bytes[])',
  'function getData(bytes32 dataKey) view returns (bytes)',
  'function getDataBatch(bytes32[] dataKeys) view returns (bytes[])',
  'function setData(bytes32 dataKey, bytes dataValue)',
  'function setDataBatch(bytes32[] dataKeys, bytes[] dataValues)',
  'function universalReceiver(bytes32 typeId, bytes data) payable returns (bytes)',
  'function owner() view returns (address)',
  'function transferOwnership(address newOwner)',
  'function acceptOwnership()',
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
  'function isValidSignature(bytes32 hash, bytes signature) view returns (bytes4)',
];
```

### Key Manager (LSP6) ABI

```javascript
const LSP6_ABI = [
  'function execute(bytes calldata payload) payable returns (bytes)',
  'function executeBatch(uint256[] values, bytes[] payloads) payable returns (bytes[])',
  'function executeRelayCall(bytes signature, uint256 nonce, uint256 validityTimestamps, bytes payload) payable returns (bytes)',
  'function executeRelayCallBatch(bytes[] signatures, uint256[] nonces, uint256[] validityTimestamps, uint256[] values, bytes[] payloads) payable returns (bytes[])',
  'function getNonce(address from, uint128 channelId) view returns (uint256)',
  'function target() view returns (address)',
  'function isValidSignature(bytes32 dataHash, bytes signature) view returns (bytes4)',
];
```

### LSP7 Digital Asset ABI

```javascript
const LSP7_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address tokenOwner) view returns (uint256)',
  'function transfer(address from, address to, uint256 amount, bool force, bytes data)',
  'function transferBatch(address[] from, address[] to, uint256[] amounts, bool[] force, bytes[] data)',
  'function authorizeOperator(address operator, uint256 amount, bytes operatorNotificationData)',
  'function revokeOperator(address operator, address tokenOwner, bool notify, bytes operatorNotificationData)',
  'function authorizedAmountFor(address operator, address tokenOwner) view returns (uint256)',
  'function getOperatorsOf(address tokenOwner) view returns (address[])',
  'function owner() view returns (address)',
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
];
```

### LSP8 Identifiable Digital Asset ABI

```javascript
const LSP8_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address tokenOwner) view returns (uint256)',
  'function tokenOwnerOf(bytes32 tokenId) view returns (address)',
  'function tokenIdsOf(address tokenOwner) view returns (bytes32[])',
  'function transfer(address from, address to, bytes32 tokenId, bool force, bytes data)',
  'function authorizeOperator(address operator, bytes32 tokenId, bytes operatorNotificationData)',
  'function revokeOperator(address operator, bytes32 tokenId, bool notify, bytes operatorNotificationData)',
  'function isOperatorFor(address operator, bytes32 tokenId) view returns (bool)',
  'function getDataForTokenId(bytes32 tokenId, bytes32 dataKey) view returns (bytes)',
  'function owner() view returns (address)',
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
];
```

### Interface IDs

```javascript
const INTERFACE_IDS = {
  ERC165: '0x01ffc9a7',       ERC725X: '0x7545acac',       ERC725Y: '0x629aa694',
  ERC1271: '0x1626ba7e',      LSP0: '0x24871b3d',          LSP1: '0x6bb56a14',
  LSP1Delegate: '0xa245bbda', LSP6: '0x23f34c62',          LSP7: '0xc52d6008',
  LSP8: '0x3a271706',         LSP9: '0x28af17e6',          LSP14: '0x94be5999',
  LSP17Extendable: '0xa918fa6b', LSP17Extension: '0xcee78b40',
  LSP25: '0x5ac79908',        LSP26: '0x2b299cea',
};
```

---

## 8. Permission System

Permissions are a **bytes32 BitArray** stored at `AddressPermissions:Permissions:<address>` in the UP's ERC725Y storage.

### Permission Values

| Permission | Bit | Hex | Risk |
|------------|-----|-----|------|
| CHANGEOWNER | 0 | `0x...01` | 🔴 Critical |
| ADDCONTROLLER | 1 | `0x...02` | 🟠 High |
| EDITPERMISSIONS | 2 | `0x...04` | 🟠 High |
| ADDEXTENSIONS | 3 | `0x...08` | 🟡 Medium |
| CHANGEEXTENSIONS | 4 | `0x...10` | 🟡 Medium |
| ADDUNIVERSALRECEIVERDELEGATE | 5 | `0x...20` | 🟡 Medium |
| CHANGEUNIVERSALRECEIVERDELEGATE | 6 | `0x...40` | 🟡 Medium |
| REENTRANCY | 7 | `0x...80` | 🟡 Medium |
| SUPER_TRANSFERVALUE | 8 | `0x...0100` | 🟠 High |
| TRANSFERVALUE | 9 | `0x...0200` | 🟡 Medium |
| SUPER_CALL | 10 | `0x...0400` | 🟠 High |
| CALL | 11 | `0x...0800` | 🟡 Medium |
| SUPER_STATICCALL | 12 | `0x...1000` | 🟢 Low |
| STATICCALL | 13 | `0x...2000` | 🟢 Low |
| SUPER_DELEGATECALL | 14 | `0x...4000` | 🔴 Critical |
| DELEGATECALL | 15 | `0x...8000` | 🔴 Critical |
| DEPLOY | 16 | `0x...010000` | 🟡 Medium |
| SUPER_SETDATA | 17 | `0x...020000` | 🟠 High |
| SETDATA | 18 | `0x...040000` | 🟡 Medium |
| ENCRYPT | 19 | `0x...080000` | 🟢 Low |
| DECRYPT | 20 | `0x...100000` | 🟢 Low |
| SIGN | 21 | `0x...200000` | 🟢 Low |
| EXECUTE_RELAY_CALL | 22 | `0x...400000` | 🟢 Low |

**ALL_PERMISSIONS** = `0x00000000000000000000000000000000000000000000000000000000007f3f7f`

### Combining Permissions

Bitwise OR:

```javascript
// CALL + TRANSFERVALUE + SIGN = 0x200a00
const perm = BigInt(0x800) | BigInt(0x200) | BigInt(0x200000);
const hex = '0x' + perm.toString(16).padStart(64, '0');
```

### SUPER vs. Regular

- **SUPER_CALL** — Call ANY contract; **CALL** — Only addresses in AllowedCalls
- **SUPER_SETDATA** — Set ANY key; **SETDATA** — Only keys in AllowedERC725YDataKeys
- Always prefer restricted + AllowedCalls/AllowedDataKeys for security.

### AllowedCalls Format

CompactBytesArray at `AddressPermissions:AllowedCalls:<address>`. Each 32-byte entry:

```
<callTypes(4)><address(20)><interfaceId(4)><functionSelector(4)>
```

callTypes bits: 0=TRANSFERVALUE, 1=CALL, 2=STATICCALL, 3=DELEGATECALL. Use `0xffffffff...` for wildcards.

---

## 9. ERC725Y Data Keys Reference

### Profile & Metadata

| Key | Hex |
|-----|-----|
| `LSP3Profile` | `0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5` |
| `SupportedStandards:LSP3Profile` | `0xeafec4d89fa9619884b600005ef83ad9559033e6e941db7d7c495acdce616347` |

### Token Metadata (LSP4)

| Key | Hex |
|-----|-----|
| `LSP4TokenName` | `0xdeba1e292f8ba88238e10ab3c7f88bd4be4fac56cad5194b6ecceaf653468af1` |
| `LSP4TokenSymbol` | `0x2f0a68ab07768e01943a599e73362a0e17a63a72e94dd2e384d2c1d4db932756` |
| `LSP4TokenType` | `0xe0261fa95db2eb3b5439bd033cda66d56b96f92f243a8228fd87550ed7bdfdb3` |
| `LSP4Metadata` | `0x9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e` |
| `LSP4Creators[]` | `0x114bd03b3a46d48759680d81ebb2b414fda7d030a7105a851867accf1c2352e7` |

### Received Assets (LSP5)

| Key | Hex |
|-----|-----|
| `LSP5ReceivedAssets[]` | `0x6460ee3c0aac563ccbf76d6e1d07bada78e3a9514e6382b736ed3f478ab7b90b` |
| `LSP5ReceivedAssetsMap:<address>` | `0x812c4334633eb816c80d0000` + address |

### Permissions (LSP6)

| Key | Hex |
|-----|-----|
| `AddressPermissions[]` | `0xdf30dba06db6a30e65354d9a64c609861f089545ca58c6b4dbe31a5f338cb0e3` |
| `AddressPermissions:Permissions:<addr>` | `0x4b80742de2bf82acb3630000` + address |
| `AddressPermissions:AllowedCalls:<addr>` | `0x4b80742de2bf393a64c70000` + address |
| `AddressPermissions:AllowedERC725YDataKeys:<addr>` | `0x4b80742de2bf866c29110000` + address |

### Other Keys

| Key | Hex |
|-----|-----|
| `LSP1UniversalReceiverDelegate` | `0x0cfc51aec37c55a4d0b1a65c6255c4bf2fbdf6277f3cc0730c45b828b6db8b47` |
| `LSP10Vaults[]` | `0x55482936e01da86729a45d2b87a6b1d3bc582bea0ec00e38bdb340e3af6f9f06` |
| `LSP12IssuedAssets[]` | `0x7c8c3416d6cda87cd42c71ea1843df28ac4850354f988d55ee2eaa47b6dc05cd` |
| `LSP8TokenIdFormat` | `0xf675e9361af1c1664c1868cfa3eb97672d6b1a513aa5b81dec34c9ee330e818d` |

### Array Key Encoding

For array types, the base key stores the length. Element keys use the first 16 bytes of the base key + 16 bytes for the index:

```javascript
function getArrayElementKey(baseKey, index) {
  const prefix = baseKey.slice(0, 34); // 0x + 32 hex chars = 16 bytes
  return prefix + index.toString(16).padStart(32, '0');
}
```

---

## 10. Security Best Practices

1. **Principle of Least Privilege** — Grant minimum necessary permissions. Prefer CALL over SUPER_CALL, SETDATA over SUPER_SETDATA.
2. **Use AllowedCalls** — When granting CALL, always restrict to specific contracts, interfaces, and functions via AllowedCalls.
3. **Use AllowedERC725YDataKeys** — When granting SETDATA, restrict to specific data keys.
4. **Avoid DELEGATECALL** — Can execute arbitrary code in the UP's context. Only use for trusted upgrade mechanisms.
5. **Avoid CHANGEOWNER** — Only grant to recovery addresses. Allows transferring profile ownership.
6. **Encrypt keys at rest** — Use the skill's encrypted keystore (AES-256-GCM).
7. **Never log private keys** — The skill never exposes private keys in output.
8. **Validate permissions before granting** — Use `up permissions validate <hex>` to check for risks.
9. **Use validity timestamps for relay calls** — Limit the window during which a signed relay call can be executed.
10. **Test on testnet first** — Always verify operations on LUKSO Testnet (chain 4201) before mainnet.
11. **Monitor relay quota** — Check quota before relying on gasless execution.
12. **Review AllowedCalls entries** — Ensure wildcards (`0xffffffff`) are intentional.

---

## 11. Error Handling

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| `UP_KEY_NOT_FOUND` | Key not found | Controller key not in keystore |
| `UP_KEY_DECRYPT_FAILED` | Decrypt failed | Wrong password for keystore |
| `UP_PERMISSION_DENIED` | Permission denied | Controller lacks required permission |
| `UP_DEPLOYMENT_FAILED` | Deployment failed | Contract deployment error |
| `UP_RELAY_FAILED` | Relay failed | Relay call execution error |
| `UP_INVALID_SIGNATURE` | Invalid signature | LSP25 signature verification failed |
| `UP_QUOTA_EXCEEDED` | Quota exceeded | Relay service quota exhausted |
| `UP_NETWORK_ERROR` | Network error | RPC connection failure |
| `UP_INVALID_ADDRESS` | Invalid address | Not a valid Ethereum address or not a UP |
| `UP_INSUFFICIENT_BALANCE` | Insufficient balance | Not enough LYX for transaction |
| `UP_TRANSACTION_FAILED` | Transaction failed | On-chain transaction reverted |
| `UP_CONFIG_NOT_FOUND` | Config not found | Missing configuration |
| `UP_NOT_AUTHORIZED` | Not authorized | Address is not a controller |

### Common Issues

**"Not authorized"** — The controller address hasn't been added to the UP's permissions. Visit the [authorization UI](https://lukso-network.github.io/openclaw-universalprofile-skill/).

**"Relay failed"** — Check relay quota with `checkRelayQuota()`. Ensure the UP is registered with the relay service. Fall back to direct execution if needed.

**"Invalid signature"** — Ensure you're using the correct chainId (42 mainnet, 4201 testnet), the nonce hasn't been used, and validity timestamps haven't expired.

**"Permission denied"** — Check which permissions the controller has with `up profile info`. The controller may need additional permissions for the action.

---

## 12. Network Configuration

### LUKSO Mainnet

| Property | Value |
|----------|-------|
| Chain ID | 42 (`0x2a`) |
| RPC URL | `https://42.rpc.thirdweb.com` |
| Explorer | `https://explorer.lukso.network` |
| Relay Service | `https://relayer.lukso.network` |
| Native Token | LYX (18 decimals) |

### LUKSO Testnet

| Property | Value |
|----------|-------|
| Chain ID | 4201 (`0x1069`) |
| RPC URL | `https://rpc.testnet.lukso.network` |
| Explorer | `https://explorer.testnet.lukso.network` |
| Relay Service | `https://relayer.testnet.lukso.network` |
| Native Token | LYXt (18 decimals) |

### Factory Contracts (Deterministic, Same on Both Networks)

| Contract | Address |
|----------|---------|
| LSP16 Universal Factory | `0x1600016e23e25D20CA8759338BfB8A8d11563C4e` |
| LSP23 Linked Contracts Factory | `0x2300000A84D25dF63081feAa37ba6b62C4c89a30` |

### NPM Packages

```bash
npm install @lukso/lsp-smart-contracts  # All LSP contract artifacts
npm install @erc725/erc725.js           # ERC725Y data encoding/decoding
npm install ethers                       # Ethereum library (v6)
```

### Reading Profile Data with ERC725.js

```javascript
import ERC725 from '@erc725/erc725.js';
import LSP3Schema from '@erc725/erc725.js/schemas/LSP3ProfileMetadata.json';

const erc725 = new ERC725(LSP3Schema, '0xUPAddress', 'https://42.rpc.thirdweb.com', {
  ipfsGateway: 'https://api.universalprofile.cloud/ipfs',
});

// Fetch profile (resolves IPFS automatically)
const profile = await erc725.fetchData('LSP3Profile');
console.log(profile.value); // { LSP3Profile: { name: '...', ... } }

// Available schemas: LSP3, LSP4, LSP5, LSP6, LSP8, LSP9, LSP10, LSP12
```

### Checking Interface Support

```javascript
const up = new ethers.Contract(address, ['function supportsInterface(bytes4) view returns (bool)'], provider);
const isUP = await up.supportsInterface('0x24871b3d');  // LSP0
const isLSP7 = await up.supportsInterface('0xc52d6008'); // LSP7
const isLSP8 = await up.supportsInterface('0x3a271706'); // LSP8
```

---

## Dependencies

- **Node.js** 18+
- **ethers.js** v6
- Network access to LUKSO RPC

## Links

- [LUKSO Documentation](https://docs.lukso.tech/)
- [Universal Profile Explorer](https://universalprofile.cloud/)
- [LSP6 Key Manager Spec](https://docs.lukso.tech/standards/access-control/lsp6-key-manager)
- [Execute Relay Transactions Guide](https://docs.lukso.tech/learn/universal-profile/key-manager/execute-relay-transactions/)
- [Authorization UI](https://lukso-network.github.io/openclaw-universalprofile-skill/)
- [LSP Smart Contracts (npm)](https://www.npmjs.com/package/@lukso/lsp-smart-contracts)
- [ERC725.js (npm)](https://www.npmjs.com/package/@erc725/erc725.js)
