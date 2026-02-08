import { useState, useEffect, useCallback, useRef } from 'react'
import type { Address } from 'viem'
import {
  Header,
  ConnectionSection,
  ControllerInfo,
  PermissionSelector,
  RiskWarnings,
  AuthorizeButton,
  SuccessConfirmation,
} from './components'
import { useWallet } from './hooks/useWallet'
import { useAuthorization } from './hooks/useAuthorization'
import { parseUrlParams, findMatchingPreset, decodePermissions } from './utils'
import { PERMISSION_PRESETS, PERMISSION_NAMES } from './constants'

function App() {
  // Parse URL parameters
  const urlParams = parseUrlParams()
  
  // Wallet state
  const wallet = useWallet()
  
  // Controller address state
  const [controllerAddress, setControllerAddress] = useState<Address | null>(
    urlParams.controllerAddress || null
  )
  
  // Selected permissions
  const [permissions, setPermissions] = useState<bigint>(
    urlParams.preset && PERMISSION_PRESETS[urlParams.preset]
      ? PERMISSION_PRESETS[urlParams.preset].permissions
      : PERMISSION_PRESETS['wallet'].permissions
  )
  
  // Authorization state
  const authorization = useAuthorization(
    wallet.address,
    wallet.walletClient,
    wallet.publicClient
  )
  
  // Error state
  const [error, setError] = useState<string | null>(null)
  // Info state for existing controller (not an error, just informational)
  const [existingControllerInfo, setExistingControllerInfo] = useState<string | null>(null)
  // Existing permissions for the controller (if any)
  const [existingPermissions, setExistingPermissions] = useState<bigint | null>(null)
  // Track which controller we've already checked to avoid re-running
  const lastCheckedController = useRef<string | null>(null)

  // Check for existing controller when wallet connects or controller address changes
  useEffect(() => {
    const checkKey = `${wallet.address}-${controllerAddress}`
    if (!wallet.isConnected || !controllerAddress || lastCheckedController.current === checkKey) {
      if (!wallet.isConnected || !controllerAddress) {
        setExistingControllerInfo(null)
        setExistingPermissions(null)
        lastCheckedController.current = null
      }
      return
    }
    lastCheckedController.current = checkKey

    const checkController = async () => {
      const existing = await authorization.checkExistingController(controllerAddress)
      if (existing.exists && existing.permissionsBigInt) {
        setExistingPermissions(existing.permissionsBigInt)
        setPermissions(existing.permissionsBigInt)
        
        const matchingPreset = findMatchingPreset(existing.permissionsBigInt)
        const permissionNames = decodePermissions(existing.permissionsBigInt.toString())
          .map(p => PERMISSION_NAMES[p] || p)
          .join(', ')
        
        const presetInfo = matchingPreset 
          ? ` (matches "${PERMISSION_PRESETS[matchingPreset].name}" preset)`
          : ''
        setExistingControllerInfo(
          `This controller already has permissions${presetInfo}: ${permissionNames}. You can update them below.`
        )
        setError(null)
      } else {
        setExistingControllerInfo(null)
        setExistingPermissions(null)
      }
    }
    checkController()
  }, [wallet.isConnected, wallet.address, controllerAddress, authorization])

  // Handle authorization
  const handleAuthorize = useCallback(async () => {
    if (!controllerAddress) {
      setError('Please enter a controller address')
      return
    }

    // Pre-flight check: are permissions identical to what's already on-chain?
    if (existingPermissions !== null && existingPermissions === permissions) {
      setError('NO_CHANGES_NEEDED')
      return
    }
    
    setError(null)
    await authorization.authorize({
      controllerAddress,
      permissions,
    })
  }, [controllerAddress, permissions, authorization, existingPermissions])

  // Handle success modal close
  const handleSuccessClose = useCallback(() => {
    authorization.reset()
    wallet.refetchProfile()
  }, [authorization, wallet])

  // Is ready to authorize?
  const isReady = wallet.isConnected && 
    controllerAddress !== null && 
    /^0x[a-fA-F0-9]{40}$/.test(controllerAddress) &&
    permissions > 0n

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-lukso-dark">
      <Header />
      
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Introduction */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-2">
            Authorize OpenClaw
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Grant OpenClaw permission to interact with your Universal Profile on LUKSO
          </p>
        </div>

        {/* Step 1: Connect Wallet */}
        <section>
          <StepHeader number={1} title="Connect Your Universal Profile" />
          <ConnectionSection
            isConnected={wallet.isConnected}
            isConnecting={wallet.isConnecting}
            address={wallet.address}
            profileData={wallet.profileData}
            isExtensionAvailable={wallet.isExtensionAvailable}
            error={wallet.error}
            onConnect={wallet.connect}
            onDisconnect={wallet.disconnect}
          />
        </section>

        {/* Step 2: Controller Address */}
        {wallet.isConnected && (
          <section>
            <StepHeader number={2} title="Controller Address" />
            <ControllerInfo
              controllerAddress={controllerAddress}
              onAddressChange={setControllerAddress}
              preset={urlParams.preset}
            />
          </section>
        )}

        {/* Step 3: Select Permissions */}
        {wallet.isConnected && controllerAddress && (
          <section>
            <StepHeader number={3} title="Select Permissions" />
            <PermissionSelector
              value={permissions}
              onChange={setPermissions}
              initialPreset={urlParams.preset}
              existingPermissions={existingPermissions}
            />
          </section>
        )}

        {/* Risk Warnings */}
        {wallet.isConnected && controllerAddress && permissions > 0n && (
          <section>
            <RiskWarnings permissions={permissions} />
          </section>
        )}

        {/* Existing controller info (informational, not blocking) */}
        {existingControllerInfo && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-blue-700 dark:text-blue-400">Controller Already Authorized</h4>
                <p className="text-sm text-blue-600 dark:text-blue-300 mt-1 break-words overflow-wrap-anywhere">
                  {existingControllerInfo}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error display */}
        {(error || authorization.error) && (
          <ErrorDisplay rawError={error || authorization.error || ''} />
        )}

        {/* Authorize Button */}
        {wallet.isConnected && (
          <section>
            <AuthorizeButton
              status={authorization.status}
              permissions={permissions}
              isReady={isReady && !error}
              onAuthorize={handleAuthorize}
            />
          </section>
        )}

        {/* Footer info */}
        <footer className="text-center text-sm text-gray-500 dark:text-gray-400 pt-8 border-t border-gray-200 dark:border-gray-800">
          <p>
            This authorization UI is open source and verifiable.{' '}
            <a 
              href="https://github.com/emmet-bot/openclaw-universalprofile-skill"
              target="_blank"
              rel="noopener noreferrer"
              className="text-lukso-pink hover:underline"
            >
              View on GitHub
            </a>
          </p>
          <p className="mt-2">
            Powered by{' '}
            <a 
              href="https://lukso.network" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-lukso-pink hover:underline"
            >
              LUKSO
            </a>
          </p>
        </footer>
      </main>

      {/* Success Modal */}
      {authorization.status === 'success' && authorization.txHash && controllerAddress && wallet.address && (
        <SuccessConfirmation
          txHash={authorization.txHash}
          controllerAddress={controllerAddress}
          upAddress={wallet.address}
          chainId={wallet.chainId || 42}
          onClose={handleSuccessClose}
        />
      )}
    </div>
  )
}

// Friendly error messages for common wallet/contract errors
function getFriendlyError(raw: string): { friendly: string; isWarning: boolean } | null {
  if (raw === 'NO_CHANGES_NEEDED' || raw.includes('already set in an identical way') || raw.includes('identical')) {
    return { friendly: 'No changes needed — these permissions are already set for this controller.', isWarning: true }
  }
  if (raw.includes('User rejected') || raw.includes('user rejected') || raw.includes('User denied')) {
    return { friendly: 'Transaction was cancelled. You can try again when ready.', isWarning: true }
  }
  if (raw.includes('insufficient funds') || raw.includes('Insufficient funds')) {
    return { friendly: 'Your account doesn\'t have enough LYX to pay for gas fees.', isWarning: false }
  }
  if (raw.includes('not the owner')) {
    return { friendly: 'You are not the owner of this Universal Profile. Only the owner can manage controller permissions.', isWarning: false }
  }
  return null
}

function ErrorDisplay({ rawError }: { rawError: string }) {
  const [showDetails, setShowDetails] = useState(false)
  const parsed = getFriendlyError(rawError)
  const isWarning = parsed?.isWarning ?? false

  const bgClass = isWarning
    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
  const iconClass = isWarning ? 'text-yellow-500' : 'text-red-500'
  const titleClass = isWarning ? 'text-yellow-700 dark:text-yellow-400' : 'text-red-700 dark:text-red-400'
  const textClass = isWarning ? 'text-yellow-600 dark:text-yellow-300' : 'text-red-600 dark:text-red-300'

  return (
    <div className={`p-4 rounded-lg border ${bgClass}`}>
      <div className="flex items-start gap-3">
        <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="min-w-0 flex-1">
          <h4 className={`font-medium ${titleClass}`}>
            {isWarning ? 'Warning' : 'Error'}
          </h4>
          <p className={`text-sm mt-1 ${textClass}`}>
            {parsed ? parsed.friendly : rawError}
          </p>
          {parsed && rawError !== 'NO_CHANGES_NEEDED' && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className={`text-xs mt-2 underline opacity-70 hover:opacity-100 ${textClass}`}
            >
              {showDetails ? 'Hide technical details' : 'Show technical details'}
            </button>
          )}
          {showDetails && (
            <pre className={`text-xs mt-2 p-2 rounded bg-black/5 dark:bg-white/5 whitespace-pre-wrap break-words overflow-wrap-anywhere ${textClass}`}>
              {rawError}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

interface StepHeaderProps {
  number: number
  title: string
}

function StepHeader({ number, title }: StepHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-lukso-pink to-lukso-purple flex items-center justify-center text-white font-bold text-sm">
        {number}
      </div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        {title}
      </h2>
    </div>
  )
}

export default App
