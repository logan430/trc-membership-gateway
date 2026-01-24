'use client';

/**
 * Client-side Providers
 *
 * Wraps the app with necessary client-side context providers.
 * Created with useState to ensure QueryClient is created once per client.
 */

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/queries';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // Create QueryClient once per client using useState
  // This ensures SSR safety - not created at module level
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
