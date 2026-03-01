import KnowledgeDetailClient from './client';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function KnowledgeDetailPage() {
  return <KnowledgeDetailClient />;
}
