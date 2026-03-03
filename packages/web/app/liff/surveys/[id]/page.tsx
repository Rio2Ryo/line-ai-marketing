import LiffSurveyDetailClient from './client';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function LiffSurveyDetailPage() {
  return <LiffSurveyDetailClient />;
}
