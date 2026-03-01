import CustomerDetailClient from './client';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function CustomerDetailPage() {
  return <CustomerDetailClient />;
}
