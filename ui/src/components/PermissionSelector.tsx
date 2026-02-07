import { useState, useEffect, useRef } from 'react'
import { 
  PERMISSION_PRESETS, 
  PERMISSIONS, 
  PERMISSION_NAMES, 
  PERMISSION_DESCRIPTIONS, 
  PERMISSION_RISK,
  type PermissionPreset 
} from '../constants'
import { decodePermissions, findMatchingPreset } from '../utils'

interface PermissionSelectorProps {
  value: bigint
  onChange: (permissions: bigint) => void
  initialPreset?: string
  existingPermissions?: bigint | null
}

type Mode = 'preset' | 'custom'

export function PermissionSelector({
  value,
  onChange,
  initialPreset,
  existingPermissions,
}: PermissionSelectorProps) {
  const [mode, setMode] = useState<Mode>('preset')
  const [selectedPreset, setSelectedPreset] = useState<string | null>(initialPreset || null)
  const [customPermissions, setCustomPermissions] = useState<Set<string>>(new Set())
  const hasInitializedExisting = useRef(false)

  // Initialize from preset if provided
  useEffect(() => {
    if (initialPreset && PERMISSION_PRESETS[initialPreset]) {
      setSelectedPreset(initialPreset)
      onChange(PERMISSION_PRESETS[initialPreset].permissions)
    }
  }, [initialPreset, onChange])

  // Handle existing permissions - auto-select matching preset or switch to custom
  useEffect(() => {
    if (existingPermissions !== null && existingPermissions !== undefined && existingPermissions > 0n && !hasInitializedExisting.current) {
      hasInitializedExisting.current = true
      
      // Try to find a matching preset
      const matchingPreset = findMatchingPreset(existingPermissions)
      if (matchingPreset) {
        setSelectedPreset(matchingPreset)
        setMode('preset')
      } else {
        // No matching preset - stay in preset mode but show info
        // Custom mode will show existing permissions when switched
        const decoded = decodePermissions(existingPermissions.toString())
        setCustomPermissions(new Set(decoded))
      }
    }
  }, [existingPermissions])

  // Reset the initialization flag when existingPermissions changes to null
  useEffect(() => {
    if (!existingPermissions) {
      hasInitializedExisting.current = false
    }
  }, [existingPermissions])

  // Update custom permissions when value changes
  useEffect(() => {
    if (mode === 'custom' && value) {
      const decoded = decodePermissions(value.toString())
      setCustomPermissions(new Set(decoded))
    }
  }, [value, mode])

  const handlePresetSelect = (presetKey: string) => {
    setSelectedPreset(presetKey)
    onChange(PERMISSION_PRESETS[presetKey].permissions)
  }

  const handleCustomToggle = (permName: string) => {
    const newPermissions = new Set(customPermissions)
    if (newPermissions.has(permName)) {
      newPermissions.delete(permName)
    } else {
      newPermissions.add(permName)
    }
    setCustomPermissions(newPermissions)

    // Calculate combined permissions
    let combined = 0n
    for (const perm of newPermissions) {
      combined |= BigInt(PERMISSIONS[perm as keyof typeof PERMISSIONS])
    }
    onChange(combined)
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'safe':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
      case 'high':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800'
      case 'critical':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
    }
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-lukso-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        Permissions
      </h3>

      {/* Existing permissions notice */}
      {existingPermissions !== null && existingPermissions !== undefined && existingPermissions > 0n && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <span className="font-medium">Existing permissions detected.</span>{' '}
            {(() => {
              const matchingPreset = findMatchingPreset(existingPermissions)
              return matchingPreset 
                ? `Matches "${PERMISSION_PRESETS[matchingPreset].name}" preset.`
                : 'Switch to Custom mode to see individual permissions.'
            })()}
          </p>
        </div>
      )}

      {/* Mode tabs */}
      <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1 mb-4">
        <button
          onClick={() => setMode('preset')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            mode === 'preset'
              ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Presets
        </button>
        <button
          onClick={() => setMode('custom')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            mode === 'custom'
              ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Custom
        </button>
      </div>

      {mode === 'preset' ? (
        <div className="space-y-3">
          {Object.entries(PERMISSION_PRESETS).map(([key, preset]) => (
            <PresetCard
              key={key}
              presetKey={key}
              preset={preset}
              isSelected={selectedPreset === key}
              onSelect={handlePresetSelect}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Select individual permissions. Be careful with high-risk permissions.
          </p>
          
          {/* Group permissions by risk */}
          {['safe', 'medium', 'high', 'critical'].map(risk => {
            const permissionsInGroup = Object.entries(PERMISSION_RISK)
              .filter(([, r]) => r === risk)
              .map(([name]) => name)
            
            if (permissionsInGroup.length === 0) return null

            return (
              <div key={risk} className="mb-4">
                <h4 className={`text-sm font-medium mb-2 capitalize ${
                  risk === 'critical' ? 'text-red-600 dark:text-red-400' :
                  risk === 'high' ? 'text-orange-600 dark:text-orange-400' :
                  risk === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-green-600 dark:text-green-400'
                }`}>
                  {risk === 'safe' ? '✓ Safe' : 
                   risk === 'medium' ? '⚠ Medium Risk' :
                   risk === 'high' ? '⚠️ High Risk' :
                   '🚫 Critical - Use with Extreme Caution'}
                </h4>
                <div className="space-y-1">
                  {permissionsInGroup.map(permName => (
                    <label
                      key={permName}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        customPermissions.has(permName)
                          ? getRiskColor(risk)
                          : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={customPermissions.has(permName)}
                        onChange={() => handleCustomToggle(permName)}
                        className="mt-1 rounded border-gray-300 text-lukso-pink focus:ring-lukso-pink"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {PERMISSION_NAMES[permName]}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${getRiskColor(risk)}`}>
                            {risk}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {PERMISSION_DESCRIPTIONS[permName]}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Selected permissions summary */}
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Selected Permissions:
        </p>
        <div className="flex flex-wrap gap-2">
          {decodePermissions(value.toString()).map(perm => (
            <span
              key={perm}
              className={`text-xs px-2 py-1 rounded-full ${getRiskColor(PERMISSION_RISK[perm])}`}
            >
              {PERMISSION_NAMES[perm]}
            </span>
          ))}
          {decodePermissions(value.toString()).length === 0 && (
            <span className="text-xs text-gray-500">No permissions selected</span>
          )}
        </div>
      </div>
    </div>
  )
}

interface PresetCardProps {
  presetKey: string
  preset: PermissionPreset
  isSelected: boolean
  onSelect: (key: string) => void
}

function PresetCard({ presetKey, preset, isSelected, onSelect }: PresetCardProps) {
  const decodedPermissions = decodePermissions(preset.permissions.toString())

  return (
    <button
      onClick={() => onSelect(presetKey)}
      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
        isSelected
          ? 'border-lukso-pink bg-lukso-pink/5'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold">{preset.name}</h4>
            {preset.recommended && (
              <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                Recommended
              </span>
            )}
            {preset.warning && (
              <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
                Dangerous
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {preset.description}
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            {decodedPermissions.slice(0, 4).map(perm => (
              <span
                key={perm}
                className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded"
              >
                {PERMISSION_NAMES[perm]}
              </span>
            ))}
            {decodedPermissions.length > 4 && (
              <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                +{decodedPermissions.length - 4} more
              </span>
            )}
          </div>
        </div>
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
          isSelected 
            ? 'border-lukso-pink bg-lukso-pink' 
            : 'border-gray-300 dark:border-gray-600'
        }`}>
          {isSelected && (
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>
    </button>
  )
}
