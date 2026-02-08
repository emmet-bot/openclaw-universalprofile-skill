---
name: universal-profile
description: Manage LUKSO Universal Profiles — identity, permissions, tokens, and blockchain operations via direct or gasless relay transactions
version: 0.3.0
author: frozeman
---

# Universal Profile Skill

> ⚠️ **Early Draft Version** — Use at your own risk.

> To authorize your OpenClaw bot, create a profile at [my.universalprofile.cloud](https://my.universalprofile.cloud), generate a controller key, then authorize it via the [Authorization UI](https://lukso-network.github.io/openclaw-universalprofile-skill/).

## Installation

```bash
npm install
```

## CLI Commands

```bash
up status                                      # Config, keys, connectivity
up profile info [<address>] [--chain <chain>]  # Profile details
up profile configure <address> [--chain lukso]  # Save UP for use
up key generate [--save] [--password <pw>]     # Generate controller keypair
up permissions encode <perm1> [<perm2> ...]    # Encode to bytes32
up permissions decode <hex>                    # Decode to names
up permissions presets                         # List presets
up authorize url [--permissions <preset|hex>]  # Generate auth URL
up quota                                       # Check relay gas quota
```

**Permission presets:** `read-only` 🟢 | `token-operator` 🟡 | `nft-trader` 🟡 | `defi-trader` 🟠 | `profile-manager` 🟡 | `full-access` 🔴

## Credentials

Loaded from (in order): `UP_CREDENTIALS_PATH` env → `~/.openclaw/universal-profile/config.json` → `~/.clawdbot/universal-profile/config.json` → `./credentials/config.json`

Key files: `UP_KEY_PATH` env → `~/.openclaw/credentials/universal-profile-key.json` → `~/.clawdbot/credentials/universal-profile-key.json`

## Transactions

### Direct (controller pays gas)

```
Controller EOA → KeyManager.execute(payload) → UP.execute(...) → Target
```

```javascript
const payload = up.interface.encodeFunctionData('execute', [0, recipient, ethers.parseEther('1.5'), '0x']);
await (await km.execute(payload)).wait();
```

### Relay / Gasless (LSP25)

Controller signs off-chain, relayer submits on-chain. UPs created via universalprofile.cloud have monthly gas quota from LUKSO.

**LSP25 Signature (EIP-191 v0 — CRITICAL: do NOT use `signMessage()`):**

```javascript
const encodedMessage = ethers.solidityPacked(
  ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
  [25, chainId, nonce, validityTimestamps, msgValue, payload]
);

// EIP-191 v0: keccak256(0x19 || 0x00 || keyManagerAddress || encodedMessage)
const prefix = new Uint8Array([0x19, 0x00]);
const msg = new Uint8Array([...prefix, ...ethers.getBytes(keyManagerAddress), ...ethers.getBytes(encodedMessage)]);
const hash = ethers.keccak256(msg);

const signature = ethers.Signature.from(new ethers.SigningKey(privateKey).sign(hash)).serialized;
```

Or use `@lukso/eip191-signer.js`:
```javascript
const { signature } = await new EIP191Signer().signDataWithIntendedValidator(kmAddress, encodedMessage, privateKey);
```

**Relay API (LSP-15):**
```bash
POST https://relayer.mainnet.lukso.network/api/execute
{ "address": "0xUP", "transaction": { "abi": "0xpayload", "signature": "0x...", "nonce": 0, "validityTimestamps": "0x0" } }
```

**Quota check** requires signed request — use `up quota` CLI or `checkRelayQuota()` from `lib/execute/relay.js`.

**Nonce channels:** `getNonce(controller, channelId)` — same channel = sequential, different = parallel.

**Validity timestamps:** `(startTimestamp << 128) | endTimestamp`. Use `0` for no restriction.

## Permission System

Permissions are a bytes32 BitArray at `AddressPermissions:Permissions:<address>`. Combine with bitwise OR.

| Permission | Hex | Risk |
|------------|-----|------|
| CHANGEOWNER | `0x01` | 🔴 |
| ADDCONTROLLER | `0x02` | 🟠 |
| EDITPERMISSIONS | `0x04` | 🟠 |
| ADDEXTENSIONS | `0x08` | 🟡 |
| CHANGEEXTENSIONS | `0x10` | 🟡 |
| ADDUNIVERSALRECEIVERDELEGATE | `0x20` | 🟡 |
| CHANGEUNIVERSALRECEIVERDELEGATE | `0x40` | 🟡 |
| REENTRANCY | `0x80` | 🟡 |
| SUPER_TRANSFERVALUE | `0x0100` | 🟠 |
| TRANSFERVALUE | `0x0200` | 🟡 |
| SUPER_CALL | `0x0400` | 🟠 |
| CALL | `0x0800` | 🟡 |
| SUPER_STATICCALL | `0x1000` | 🟢 |
| STATICCALL | `0x2000` | 🟢 |
| SUPER_DELEGATECALL | `0x4000` | 🔴 |
| DELEGATECALL | `0x8000` | 🔴 |
| DEPLOY | `0x010000` | 🟡 |
| SUPER_SETDATA | `0x020000` | 🟠 |
| SETDATA | `0x040000` | 🟡 |
| ENCRYPT | `0x080000` | 🟢 |
| DECRYPT | `0x100000` | 🟢 |
| SIGN | `0x200000` | 🟢 |
| EXECUTE_RELAY_CALL | `0x400000` | 🟢 |

**SUPER vs Regular:** SUPER_CALL = any contract; CALL = only AllowedCalls. SUPER_SETDATA = any key; SETDATA = only AllowedERC725YDataKeys. Prefer restricted.

**AllowedCalls:** CompactBytesArray at `AddressPermissions:AllowedCalls:<addr>`. Each entry: `<callTypes(4)><address(20)><interfaceId(4)><selector(4)>`.

## LSP Ecosystem

| LSP | Name | Purpose |
|-----|------|---------|
| LSP0 (`0x24871b3d`) | ERC725Account | Smart contract account (UP) |
| LSP1 (`0x6bb56a14`) | UniversalReceiver | Notification hooks |
| LSP2 | ERC725Y JSON Schema | Key encoding for on-chain data |
| LSP3 | Profile Metadata | Name, avatar, links, tags |
| LSP4 | Digital Asset Metadata | Token name, symbol, type |
| LSP5 | ReceivedAssets | Tracks owned tokens/NFTs |
| LSP6 (`0x23f34c62`) | KeyManager | Permission-based access control |
| LSP7 (`0xc52d6008`) | DigitalAsset | Fungible tokens (like ERC20) |
| LSP8 (`0x3a271706`) | IdentifiableDigitalAsset | NFTs (bytes32 token IDs) |
| LSP9 (`0x28af17e6`) | Vault | Sub-account for asset segregation |
| LSP14 (`0x94be5999`) | Ownable2Step | Two-step ownership transfer |
| LSP25 (`0x5ac79908`) | ExecuteRelayCall | Gasless meta-transactions |
| LSP26 (`0x2b299cea`) | FollowerSystem | On-chain follow/unfollow |

Full ABIs, interface IDs, and ERC725Y data keys are in `lib/constants.js`.

## Network Config

| | Mainnet | Testnet |
|---|---|---|
| Chain ID | 42 | 4201 |
| RPC | `https://42.rpc.thirdweb.com` | `https://rpc.testnet.lukso.network` |
| Explorer | `https://explorer.lukso.network` | `https://explorer.testnet.lukso.network` |
| Relay | `https://relayer.mainnet.lukso.network/api` | `https://relayer.testnet.lukso.network/api` |
| Token | LYX (18 dec) | LYXt (18 dec) |

## Security

- Grant minimum permissions. Prefer CALL over SUPER_CALL.
- Use AllowedCalls/AllowedERC725YDataKeys to restrict access.
- Avoid DELEGATECALL and CHANGEOWNER unless absolutely necessary.
- Use validity timestamps for relay calls.
- Test on testnet (chain 4201) first.
- Never log private keys.

## Forever Moments (NFT Moments & Collections)

Forever Moments is a social NFT platform on LUKSO. The Agent API lets you mint Moment NFTs, join/create collections, and pin images to IPFS — all via gasless relay.

**Base URL:** `https://www.forevermoments.life/api/agent/v1`

### IPFS Pinning

```bash
# Pin image via FM's Pinata proxy (multipart form upload)
POST /api/pinata   # NOTE: /api/pinata, NOT /api/agent/v1/pinata
Content-Type: multipart/form-data
Body: file=@image.png
Response: { "IpfsHash": "Qm...", "PinSize": 123456 }
```

### Relay Flow (3-step pattern for all on-chain actions)

1. **Build** — call build endpoint → get `derived.upExecutePayload`
2. **Prepare** — `POST /relay/prepare` with payload → get `hashToSign` + `nonce`
3. **Sign & Submit** — sign `hashToSign` as RAW DIGEST (not `signMessage`!) → `POST /relay/submit`

```javascript
// Step 1: Build (example: mint moment)
const build = await fetch(`${API}/moments/build-mint`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userUPAddress: UP, collectionUP: COLLECTION, metadataJson: { LSP4Metadata: { name, description, images, icon, tags } } })
});
const { data: { derived: { upExecutePayload } } } = await build.json();

// Step 2: Prepare
const prep = await fetch(`${API}/relay/prepare`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ upAddress: UP, controllerAddress: CONTROLLER, payload: upExecutePayload })
});
const { data: { hashToSign, nonce, relayerUrl } } = await prep.json();

// Step 3: Sign as raw digest + submit
const signature = ethers.Signature.from(new ethers.SigningKey(privateKey).sign(hashToSign)).serialized;
await fetch(`${API}/relay/submit`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ upAddress: UP, payload: upExecutePayload, signature, nonce, validityTimestamps: '0x0', relayerUrl })
});
```

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/collections/build-join` | POST | Join an existing collection |
| `/collections/build-create` | POST | Create collection (step 1: LSP23 deploy) |
| `/collections/finalize-create` | POST | Finalize collection (step 2: register) |
| `/moments/build-mint` | POST | Mint a Moment NFT in a collection |
| `/relay/prepare` | POST | Get hashToSign + nonce for relay |
| `/relay/submit` | POST | Submit signed relay tx to LUKSO relayer |
| `/api/pinata` | POST | Pin file to IPFS (multipart) |

### Metadata Format (LSP4)

```json
{
  "LSP4Metadata": {
    "name": "Moment Title",
    "description": "Description text",
    "images": [[{ "width": 1024, "height": 1024, "url": "ipfs://Qm..." }]],
    "icon": [{ "width": 1024, "height": 1024, "url": "ipfs://Qm..." }],
    "tags": ["tag1", "tag2"],
    "createdAt": "2026-02-08T16:30:00.000Z"
  }
}
```

Pass `metadataJson` to build-mint and the API auto-pins it to IPFS.

### Key Notes

- **Signing:** The `hashToSign` from `/relay/prepare` is already a full hash — sign it as a raw digest with `SigningKey.sign()`, NOT `wallet.signMessage()`
- **Join before mint:** You may need to join a collection before minting. If join fails with gas estimation error, you might already be a member
- **Collection creation** is 2-step: `build-create` (deploys contracts via LSP23) → `finalize-create` (registers)
- **Known collection:** "Art by the Machine" = `0x439f6793b10b0a9d88ad05293a074a8141f19d77`

## Error Codes

| Code | Cause |
|------|-------|
| `UP_PERMISSION_DENIED` | Controller lacks required permission |
| `UP_RELAY_FAILED` | Relay execution error — check quota |
| `UP_INVALID_SIGNATURE` | Wrong chainId, used nonce, or expired timestamps |
| `UP_QUOTA_EXCEEDED` | Monthly relay quota exhausted |
| `UP_NOT_AUTHORIZED` | Address not a controller — use [Authorization UI](https://lukso-network.github.io/openclaw-universalprofile-skill/) |

## Dependencies

- Node.js 18+ / ethers.js v6
- `@lukso/lsp-smart-contracts` / `@erc725/erc725.js` (optional)

## Links

- [LUKSO Docs](https://docs.lukso.tech/) · [UP Explorer](https://universalprofile.cloud/) · [LSP6 Spec](https://docs.lukso.tech/standards/access-control/lsp6-key-manager) · [Authorization UI](https://lukso-network.github.io/openclaw-universalprofile-skill/)
