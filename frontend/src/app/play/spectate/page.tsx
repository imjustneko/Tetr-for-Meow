import { Suspense } from 'react';
import SpectatePageClient from './SpectatePageClient';

export const dynamic = 'force-dynamic';

export default function SpectatePage() {
  return (
    <Suspense fallback={null}>
      <SpectatePageClient />
    </Suspense>
  );
}
