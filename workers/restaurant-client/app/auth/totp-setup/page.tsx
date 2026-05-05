'use client';

/**
 * TOTP Setup Page
 * Allows users to set up two-factor authentication
 * Accessible after first login or from settings
 */

import { useRouter } from 'next/navigation';
import TOTPSetup from '@/components/auth/TOTPSetup';

export default function TOTPSetupPage() {
  const router = useRouter();

  const handleComplete = () => {
    // Redirect to admin dashboard after successful setup
    router.push('/admin?totp_setup=success');
  };

  const handleSkip = () => {
    // Allow users to skip setup (they can do it later from settings)
    router.push('/admin');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 py-12 px-4">
      <TOTPSetup onComplete={handleComplete} onSkip={handleSkip} />
    </div>
  );
}
