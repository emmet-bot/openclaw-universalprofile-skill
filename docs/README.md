# Universal Profile Skill Documentation

Welcome to the Universal Profile skill documentation!

## Quick Links

- **[SKILL.md](./SKILL.md)** - Complete skill documentation
- **[Examples](./examples/)** - Code examples and tutorials
- **[API Reference](./api-reference.md)** - Detailed API documentation

## What is this skill?

The Universal Profile skill enables Clawdbot to interact with LUKSO blockchain, manage Universal Profiles (LSP0), deploy and manage LSP7/LSP8 tokens, trade on DEXs, and interact with NFT marketplaces.

## Quick Start

```bash
# Install
npm install -g openclaw-universalprofile-skill

# Configure
export UP_PRIVATE_KEY=0x...
export UP_ADDRESS=0x...

# Use CLI
up profile info <address>
up token deploy-lsp7 --name "My Token" --symbol "MTK"

# Or use with Clawdbot
"Deploy an LSP7 token called MyToken"
```

## Documentation Structure

```
docs/
├── SKILL.md              # Main skill documentation
├── README.md             # This file
├── api-reference.md      # Detailed API docs
└── examples/             # Code examples
    ├── basic-profile.md
    ├── token-deployment.md
    ├── nft-marketplace.md
    └── dex-trading.md
```

## Support

- GitHub Issues: https://github.com/openclaw/universalprofile-skill/issues
- Clawdbot Discord: https://discord.com/invite/clawd
- LUKSO Discord: https://discord.gg/lukso
