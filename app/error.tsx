'use client';

import { ErroreAzione } from '@/components/ErroreAzione';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErroreAzione error={error} reset={reset} />;
}
