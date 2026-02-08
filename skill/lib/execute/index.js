/**
 * Execute Module - Unified Transaction Execution
 * 
 * Provides two execution methods:
 * 
 * 1. DIRECT - Controller pays gas
 *    - executeDirect(operation, target, value, data)
 *    - executeRelayCallDirect(payload) - for controllers with EXECUTE_RELAY_CALL
 * 
 * 2. RELAY - Gasless (relayer pays from UP's quota)
 *    - executeRelay(payload) - requires SIGN permission
 * 
 * Both methods are transaction-type agnostic. They just sign and submit
 * whatever payload you give them. Use the token modules (lib/tokens/*)
 * to build the payloads.
 * 
 * Example:
 *   import { executeRelay, buildExecutePayload } from './lib/execute/index.js';
 *   import { buildLSP7TransferPayload } from './lib/tokens/lsp7.js';
 *   
 *   // 1. Build token transfer calldata
 *   const tokenData = await buildLSP7TransferPayload(tokenAddr, from, to, amount);
 *   
 *   // 2. Wrap in UP.execute()
 *   const payload = buildExecutePayload(0, tokenAddr, 0, tokenData);
 *   
 *   // 3. Execute via relay (or direct)
 *   const { txHash, explorerUrl } = await executeRelay(payload);
 */

// Re-export from direct execution module
export { 
  executeDirect, 
  executeRelayCallDirect, 
  buildExecutePayload 
} from './direct.js';

// Re-export from relay execution module
export { 
  executeRelay, 
  getRelayQuota 
} from './relay.js';

// Default export with all methods
import directModule from './direct.js';
import relayModule from './relay.js';

export default {
  ...directModule,
  ...relayModule
};
