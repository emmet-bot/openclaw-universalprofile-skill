import { useEffect, useState } from 'react';

// Import lukso components on client side only
if (typeof window !== 'undefined') {
  import('@lukso/web-components');
}

type LuksoSize = '2x-small' | 'x-small' | 'small' | 'medium' | 'large' | 'x-large' | '2x-large';

interface LuksoProfileAvatarProps {
  /** Profile address for identicon generation */
  address: string;
  /** Profile picture URL (optional) */
  profileUrl?: string | null;
  /** Profile name (for accessibility, not displayed) */
  name?: string | null;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Show identicon badge when profile pic exists */
  showIdenticon?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// Map our size variants to LUKSO's size names
const sizeMap: Record<string, LuksoSize> = {
  'xs': '2x-small',
  'sm': 'x-small',
  'md': 'small',
  'lg': 'medium',
  'xl': 'large',
  '2xl': 'x-large',
};

/**
 * LUKSO Profile Avatar Component
 * 
 * Wrapper around the official lukso-profile web component.
 * 
 * Handles:
 * - Client-side only loading (web components)
 * - Size mapping
 * - Identicon display with profile pictures
 */
export function LuksoProfileAvatar({
  address,
  profileUrl,
  name,
  size = 'md',
  showIdenticon = true,
  className = '',
}: LuksoProfileAvatarProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const luksoSize = sizeMap[size] || 'small';

  // Show placeholder during SSR
  if (!isMounted) {
    return <div className={`rounded-full bg-gray-200 animate-pulse ${className}`} />;
  }

  return (
    <lukso-profile
      profile-url={profileUrl || undefined}
      profile-address={address}
      has-identicon={showIdenticon}
      size={luksoSize}
      className={className}
    />
  );
}

/**
 * Profile display with avatar and optional name
 */
export function ProfileDisplay({
  address,
  profileUrl,
  name,
  size = 'md',
  className = '',
}: {
  address: string;
  profileUrl?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LuksoProfileAvatar
        address={address}
        profileUrl={profileUrl}
        name={name}
        size={size}
        showIdenticon={true}
      />
      {name && (
        <div className="flex flex-col">
          <span className="font-medium">{name}</span>
          <span className="text-sm text-gray-500">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </div>
      )}
      {!name && (
        <span className="font-mono text-sm">
          {address.slice(0, 10)}...{address.slice(-8)}
        </span>
      )}
    </div>
  );
}
