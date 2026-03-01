import ScenarioDetailClient from './client';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function ScenarioDetailPage() {
  return <ScenarioDetailClient />;
}
