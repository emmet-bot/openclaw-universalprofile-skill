import { useState, useEffect, useCallback } from 'react'
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
import { parseUrlParams } from './utils'
import { PERMISSION_PRESETS } from './constants'

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

  // Check for existing controller when wallet connects
  useEffect(() => {
    const checkController = async () => {
      if (wallet.isConnected && controllerAddress) {
        const existing = await authorization.checkExistingController(controllerAddress)
        if (existing.exists) {
          setError(`This controller is already authorized with permissions: ${existing.permissions}`)
        } else {
          setError(null)
        }
      }
    }
    checkController()
  }, [wallet.isConnected, controllerAddress, authorization])

  // Handle authorization
  const handleAuthorize = useCallback(async () => {
    if (!controllerAddress) {
      setError('Please enter a controller address')
      return
    }
    
    setError(null)
    await authorization.authorize({
      controllerAddress,
      permissions,
    })
  }, [controllerAddress, permissions, authorization])

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
            />
          </section>
        )}

        {/* Risk Warnings */}
        {wallet.isConnected && controllerAddress && permissions > 0n && (
          <section>
            <RiskWarnings permissions={permissions} />
          </section>
        )}

        {/* Error display */}
        {(error || authorization.error) && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="font-medium text-red-700 dark:text-red-400">Error</h4>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                  {error || authorization.error}
                </p>
              </div>
            </div>
          </div>
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
