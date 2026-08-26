import { PaginaClassi } from '@/components/PaginaClassi';

export const dynamic = 'force-dynamic';

export default function PastiClassiPage({
  searchParams,
}: {
  searchParams: { data?: string };
}) {
  return (
    <PaginaClassi
      titolo="Pasti"
      basePath="/dashboard/pasti"
      searchParams={searchParams}
      tipo="pasti"
      escludiAssistente
    />
  );
}
