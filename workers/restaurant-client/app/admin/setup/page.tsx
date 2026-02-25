'use client';

import { useSearchParams } from 'next/navigation';
import { SetupWizard } from '../../components/admin/setup/SetupWizard';
import { Suspense } from 'react';

function SetupPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  return <SetupWizard adminToken={token} />;
}

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <SetupPageContent />
    </Suspense>
  );
}
