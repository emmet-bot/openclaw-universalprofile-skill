# LUKSO Universal Profile Skill

> ⚠️ **Early Draft Version** — This skill is under active development. Use at your own risk.

This skill enables interaction with LUKSO Universal Profiles using LSP-25 ExecuteRelayCall.

## Features

- **LSP-25 Signature Encoding** - Correct EIP-191 v0 signature format
- **Direct Transactions** - Execute with gas payment (always works)
- **Relay Service** - Gasless execution (may have restrictions)
- **Profile Following** - Store following data on-chain

## Credentials Setup

Store credentials at `~/.clawdbot/credentials/universal-profile-key.json`:

```json
{
  "universalProfile": {
    "address": "0x..."
  },
  "controller": {
    "address": "0x...",
    "privateKey": "0x..."
  }
}
```

## Usage

### Direct Transaction (Recommended)

```bash
# Test with direct transaction
node skill/lsp25-relay-call.js test

# Follow a profile
node skill/lsp25-relay-call.js follow 0xCDeC110F9c255357E37f46CD2687be1f7E9B02F7
```

### Relay Service (Gasless)

```bash
# Try relay (falls back to direct if relay fails)
node skill/lsp25-relay-call.js test --relay
node skill/lsp25-relay-call.js follow <UP_ADDRESS> --relay
```

## LSP-25 Signature Format

The signature is constructed according to [LSP-25 specification](https://github.com/lukso-network/LIPs/blob/main/LSPs/LSP-25-ExecuteRelayCall.md):

1. **Message**: `abi.encodePacked(LSP25_VERSION, chainId, nonce, validityTimestamps, value, payload)`
2. **Hash**: EIP-191 v0 - `keccak256(0x19 || 0x00 || keyManagerAddress || message)`
3. **Sign**: Raw hash signing (NOT `signMessage` which adds Ethereum Signed Message prefix)

```javascript
import { signLSP25Message, createLSP25Message, hashDataWithIntendedValidator } from './lsp25-relay-call.js';

// Create message
const message = createLSP25Message(chainId, nonce, validityTimestamps, value, payload);

// Sign (uses EIP-191 v0 with Key Manager as intended validator)
const signature = signLSP25Message(keyManagerAddress, message, privateKey);
```

## Relay Service Notes

**⚠️ Important**: The LUKSO relay service may reject valid signatures for UPs not created through their official wallet. This is an external service limitation, not a signature encoding issue.

If relay returns `401 "Invalid signature provided"`:
1. Verify your signature works with direct `executeRelayCall` on-chain
2. Use direct mode (default) which pays gas but always works
3. Contact LUKSO support if you need relay for a specific UP

## API

### executeRelayCall(payload, options)

Execute a relay call with the given payload.

```javascript
const result = await executeRelayCall(payload, {
  useRelay: false,        // Try relay first (default: false)
  value: 0,              // LYX value to send
  validityTimestamps: 0n, // 0 = no expiry
  channel: 0,            // Nonce channel
  verbose: true          // Log output
});
```

### followProfile(targetAddress, options)

Follow a Universal Profile.

```javascript
const result = await followProfile('0x...', { useRelay: false });
console.log('TX:', result.transactionHash);
```

## Verified Working

- ✅ Direct `executeRelayCall` on Key Manager
- ✅ Local signature verification
- ✅ Following profiles
- ⚠️ Relay service (may have restrictions)

## Resources

- [LSP-25 Specification](https://github.com/lukso-network/LIPs/blob/main/LSPs/LSP-25-ExecuteRelayCall.md)
- [LUKSO Passkey Auth](https://github.com/lukso-network/service-auth-simple/tree/main/packages/passkey-auth)
- [EIP-191 Signer](https://github.com/lukso-network/tools-eip191-signer)
