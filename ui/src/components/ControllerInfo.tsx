import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { generateAuthUrl } from '../utils'
import { LuksoProfileAvatar } from './LuksoProfileAvatar'
import type { Address } from 'viem'

interface ControllerInfoProps {
  controllerAddress: Address | null
  onAddressChange: (address: Address) => void
  preset?: string
}

export function ControllerInfo({
  controllerAddress,
  onAddressChange,
  preset,
}: ControllerInfoProps) {
  const [inputValue, setInputValue] = useState(controllerAddress || '')
  const [showQR, setShowQR] = useState(false)
  const [isValidAddress, setIsValidAddress] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (controllerAddress) {
      setInputValue(controllerAddress)
    }
  }, [controllerAddress])

  useEffect(() => {
    // Validate address format
    const isValid = /^0x[a-fA-F0-9]{40}$/.test(inputValue)
    setIsValidAddress(isValid)
  }, [inputValue])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    if (/^0x[a-fA-F0-9]{40}$/.test(value)) {
      onAddressChange(value as Address)
    }
  }

  const handleCopy = async () => {
    if (controllerAddress) {
      await navigator.clipboard.writeText(controllerAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const authUrl = controllerAddress 
    ? generateAuthUrl(window.location.origin + window.location.pathname, controllerAddress, preset)
    : ''

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-lukso-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
        Controller Address
      </h3>

      <div className="space-y-4">
        <div>
          <label className="label">Clawdbot's Controller Address</label>
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder="0x..."
              className={`input font-mono pr-20 ${
                inputValue && !isValidAddress 
                  ? 'border-red-500 focus:ring-red-500' 
                  : ''
              }`}
            />
            {controllerAddress && (
              <button
                onClick={handleCopy}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                title="Copy address"
              >
                {copied ? (
                  <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                )}
              </button>
            )}
          </div>
          {inputValue && !isValidAddress && (
            <p className="mt-1 text-sm text-red-500">
              Please enter a valid Ethereum address (0x followed by 40 hex characters)
            </p>
          )}
          {controllerAddress && isValidAddress && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center gap-3">
              <LuksoProfileAvatar
                address={controllerAddress}
                size="md"
                showIdenticon={true}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Controller</p>
                <p className="text-xs text-gray-500 font-mono">
                  {controllerAddress.slice(0, 10)}...{controllerAddress.slice(-8)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* QR Code for mobile */}
        {controllerAddress && (
          <div>
            <button
              onClick={() => setShowQR(!showQR)}
              className="btn-secondary text-sm w-full flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              {showQR ? 'Hide QR Code' : 'Show QR Code for Mobile'}
            </button>

            {showQR && (
              <div className="mt-4 p-4 bg-white rounded-xl flex flex-col items-center">
                <QRCodeSVG
                  value={authUrl}
                  size={200}
                  level="M"
                  includeMargin
                  bgColor="#ffffff"
                  fgColor="#0D0D12"
                />
                <p className="mt-2 text-sm text-gray-600 text-center">
                  Scan to open on mobile
                </p>
              </div>
            )}
          </div>
        )}

        {/* Info box */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium">What is this?</p>
              <p className="mt-1 text-blue-600 dark:text-blue-400">
                This is the address that Clawdbot will use to interact with your Universal Profile. 
                By authorizing this address, you're granting it specific permissions to act on your behalf.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
