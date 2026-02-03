# Universal Profile Skill

**Version:** 1.0.0  
**Author:** Clawdbot  
**Repository:** https://github.com/openclaw/universalprofile-skill

## Overview

The Universal Profile skill enables Clawdbot to interact with LUKSO blockchain Universal Profiles, manage LSP tokens (LSP7 fungible, LSP8 NFTs), trade on decentralized exchanges, and deploy smart contracts.

## Features

### Core Capabilities
- **Universal Profile Management** (LSP0)
  - Create and configure Universal Profiles
  - Manage profile metadata and permissions
  - Execute transactions through Universal Profiles
  
- **Token Operations** (LSP7 & LSP8)
  - Deploy LSP7 fungible tokens
  - Deploy LSP8 NFTs with metadata
  - Transfer tokens and NFTs
  - Query balances and metadata
  
- **NFT Marketplace**
  - List NFTs for sale
  - Purchase NFTs
  - Browse marketplace listings
  - Manage collection metadata
  
- **DEX Trading**
  - Swap tokens on LUKSO DEXs
  - Query liquidity pools
  - Check prices and slippage
  
- **Smart Contract Deployment**
  - Deploy custom LSP contracts
  - Verify contracts on LUKSO Explorer
  - Manage contract permissions

## Installation

### Via npm (when published)
```bash
npm install -g openclaw-universalprofile-skill
```

### From source
```bash
git clone https://github.com/openclaw/universalprofile-skill.git
cd openclaw-universalprofile-skill
npm install
npm run build
npm link
```

## Configuration

### Environment Variables

Create a `.env` file or set these in your environment:

```bash
# Required
UP_PRIVATE_KEY=0x...          # Your Universal Profile controller private key
UP_ADDRESS=0x...              # Your Universal Profile address (LSP0)

# Optional
LUKSO_RPC_URL=https://rpc.mainnet.lukso.network  # Default: LUKSO mainnet
LUKSO_CHAIN_ID=42                                 # Default: LUKSO mainnet
```

### Clawdbot Integration

Add to your Clawdbot `config.yaml`:

```yaml
skills:
  universalprofile:
    enabled: true
    command: up
    description: "LUKSO Universal Profile operations"
```

## CLI Usage

The skill provides a `up` command-line interface:

### Profile Management

```bash
# Create a new Universal Profile
up profile create --name "My Profile"

# Get profile information
up profile info <address>

# Update profile metadata
up profile update --set-name "New Name" --set-image <ipfs-hash>
```

### Token Operations

```bash
# Deploy LSP7 fungible token
up token deploy-lsp7 \
  --name "My Token" \
  --symbol "MTK" \
  --decimals 18 \
  --supply 1000000

# Deploy LSP8 NFT collection
up token deploy-lsp8 \
  --name "My NFT Collection" \
  --symbol "MNFT"

# Transfer tokens
up token transfer \
  --token <token-address> \
  --to <recipient-address> \
  --amount 100

# Mint NFT
up token mint-nft \
  --token <nft-address> \
  --to <recipient-address> \
  --token-id 1 \
  --metadata <ipfs-hash>
```

### NFT Marketplace

```bash
# List NFT for sale
up marketplace list \
  --token <nft-address> \
  --token-id 1 \
  --price 10 \
  --currency LYX

# Buy NFT
up marketplace buy \
  --listing-id <listing-id>

# Browse listings
up marketplace browse --collection <collection-address>
```

### DEX Trading

```bash
# Swap tokens
up dex swap \
  --from-token <token-address> \
  --to-token <token-address> \
  --amount 100 \
  --slippage 0.5

# Get price quote
up dex quote \
  --from-token <token-address> \
  --to-token <token-address> \
  --amount 100
```

## Clawdbot Agent Usage

When integrated with Clawdbot, use natural language:

**Profile Management:**
- "Create a new Universal Profile called 'Emmet AI'"
- "Show me my UP profile info"
- "Update my profile name to 'Emmet the Octopus'"

**Token Operations:**
- "Deploy an LSP7 token called 'EmmetCoin' with symbol EMT"
- "Transfer 100 EMT tokens to 0x..."
- "Mint an NFT in my collection with metadata from IPFS hash xyz"

**Marketplace:**
- "List my NFT #42 for sale at 10 LYX"
- "Browse NFTs in the Chillwhales collection"
- "Buy the NFT in listing ID 123"

**DEX Trading:**
- "Swap 50 LYX for CHILL tokens"
- "What's the price to swap 100 CHILL for LYX?"

## Architecture

### Key Components

```
src/
├── skill.ts          # Main skill implementation
├── index.ts          # Entry point and exports
├── lib/              # Core libraries
│   ├── profile.ts    # Universal Profile operations
│   ├── lsp7.ts       # LSP7 token operations
│   ├── lsp8.ts       # LSP8 NFT operations
│   ├── marketplace.ts # NFT marketplace integration
│   ├── dex.ts        # DEX trading operations
│   └── contract.ts   # Contract deployment utilities
├── utils/            # Utility functions
│   ├── ipfs.ts       # IPFS metadata handling
│   └── validation.ts # Input validation
└── types/            # TypeScript type definitions
```

### LSP Standards Supported

- **LSP0** - Universal Profile (ERC725Account)
- **LSP1** - Universal Receiver Delegate
- **LSP2** - ERC725Y JSON Schema
- **LSP3** - Universal Profile Metadata
- **LSP4** - Digital Asset Metadata
- **LSP6** - Key Manager (permissions)
- **LSP7** - Digital Asset (Fungible Token)
- **LSP8** - Identifiable Digital Asset (NFT)

## Examples

### Example 1: Deploy and Transfer LSP7 Token

```typescript
import { deployLSP7Token, transferLSP7 } from 'openclaw-universalprofile-skill';

// Deploy token
const tokenAddress = await deployLSP7Token({
  name: 'MyToken',
  symbol: 'MTK',
  decimals: 18,
  initialSupply: '1000000',
  profileAddress: '0x...' // Your UP address
});

// Transfer tokens
await transferLSP7({
  tokenAddress,
  from: '0x...', // Your UP address
  to: '0x...',   // Recipient address
  amount: '100'
});
```

### Example 2: Create NFT Collection and Mint

```typescript
import { deployLSP8NFT, mintLSP8 } from 'openclaw-universalprofile-skill';

// Deploy NFT collection
const nftAddress = await deployLSP8NFT({
  name: 'My NFT Collection',
  symbol: 'MNFT',
  profileAddress: '0x...'
});

// Mint NFT with metadata
await mintLSP8({
  nftAddress,
  to: '0x...',
  tokenId: '1',
  metadata: {
    name: 'Cool NFT #1',
    description: 'A very cool NFT',
    image: 'ipfs://...',
    attributes: [
      { trait_type: 'Rarity', value: 'Legendary' }
    ]
  }
});
```

### Example 3: List and Sell NFT

```typescript
import { listNFT, buyNFT } from 'openclaw-universalprofile-skill';

// List NFT for sale
const listingId = await listNFT({
  nftAddress: '0x...',
  tokenId: '1',
  price: '10', // 10 LYX
  seller: '0x...' // Your UP address
});

// Buy NFT (as buyer)
await buyNFT({
  listingId,
  buyer: '0x...' // Buyer UP address
});
```

## Security Considerations

### Private Key Management
- **NEVER** commit private keys to version control
- Use environment variables or secure key management systems
- Consider using hardware wallets for production Universal Profiles

### Permission Management (LSP6)
- Universal Profiles use LSP6 Key Manager for fine-grained permissions
- Ensure controller keys have appropriate permissions for operations
- Use separate keys for different permission levels

### Transaction Signing
- All transactions are signed by the Universal Profile controller
- Transactions are executed through the Universal Profile (LSP0)
- Gas is paid by the controller EOA, but executed in UP context

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## Resources

- [LUKSO Documentation](https://docs.lukso.tech)
- [LSP Standards](https://github.com/lukso-network/LIPs/tree/main/LSPs)
- [Universal Profile Playground](https://universalprofile.cloud)
- [Clawdbot Documentation](https://docs.clawd.bot)

## License

MIT License - see LICENSE file for details
