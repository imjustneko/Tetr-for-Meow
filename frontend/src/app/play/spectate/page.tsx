import { Suspense } from 'react';
import SpectatePageClient from './SpectatePageClient';

export default function SpectatePage() {
  return (
    <Suspense fallback={null}>
      <SpectatePageClient />
    </Suspense>
  );
}
