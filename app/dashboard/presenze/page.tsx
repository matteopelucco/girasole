import { PaginaClassi } from '@/components/PaginaClassi';

export const dynamic = 'force-dynamic';

export default function PresenzeClassiPage({
  searchParams,
}: {
  searchParams: { data?: string };
}) {
  return (
    <PaginaClassi titolo="Presenze" basePath="/dashboard/presenze" searchParams={searchParams} tipo="presenze" />
  );
}
