'use client';

import { useState, useRef } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { useRole } from '@/lib/role';

type ImportTarget = 'customers' | 'tags' | 'knowledge';
type ImportFormat = 'csv' | 'json';
type Step = 'upload' | 'preview' | 'result';

interface ValidationRow {
  valid: boolean;
  row: number;
  data: Record<string, string>;
  errors: string[];
  warnings: string[];
}

interface PreviewData {
  target: string;
  total: number;
  valid: number;
  errors: number;
  preview: ValidationRow[];
}

interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
  errors?: string[];
}

const TARGET_INFO: Record<ImportTarget, { labelJa: string; labelEn: string; descJa: string; descEn: string; columnsJa: string; columnsEn: string }> = {
  customers: {
    labelJa: '顧客', labelEn: 'Customers',
    descJa: '顧客データを一括インポートします', descEn: 'Bulk import customer data',
    columnsJa: 'display_name (必須), line_user_id, status, tags', columnsEn: 'display_name (required), line_user_id, status, tags',
  },
  tags: {
    labelJa: 'タグ', labelEn: 'Tags',
    descJa: 'タグを一括インポートします', descEn: 'Bulk import tags',
    columnsJa: 'name (必須), color, description', columnsEn: 'name (required), color, description',
  },
  knowledge: {
    labelJa: 'ナレッジベース', labelEn: 'Knowledge Base',
    descJa: 'ナレッジ記事を一括インポートします', descEn: 'Bulk import knowledge base entries',
    columnsJa: 'title (必須), content (必須), category', columnsEn: 'title (required), content (required), category',
  },
};

export default function ImportPage() {
  const { locale } = useTranslation();
  const { canWrite, loading: roleLoading } = useRole();
  const ja = locale === 'ja';

  const [step, setStep] = useState<Step>('upload');
  const [target, setTarget] = useState<ImportTarget>('customers');
  const [format, setFormat] = useState<ImportFormat>('csv');
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError('');

    // Detect format from extension
    if (file.name.endsWith('.json')) setFormat('json');
    else if (file.name.endsWith('.csv')) setFormat('csv');

    const reader = new FileReader();
    reader.onload = (ev) => {
      setFileContent(ev.target?.result as string || '');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handlePreview = async () => {
    if (!fileContent) {
      setError(ja ? 'ファイルを選択してください' : 'Please select a file');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetchWithAuth(`${getApiUrl()}/api/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, format, data: fileContent }),
      });
      const json = await res.json();

      if (json.success) {
        setPreview(json.data);
        setStep('preview');
      } else {
        setError(json.error || (ja ? 'プレビューに失敗しました' : 'Preview failed'));
      }
    } catch (e) {
      setError(ja ? '通信エラーが発生しました' : 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetchWithAuth(`${getApiUrl()}/api/import/${target}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, data: fileContent }),
      });
      const json = await res.json();

      if (json.success) {
        setResult(json.data);
        setStep('result');
      } else {
        setError(json.error || (ja ? 'インポートに失敗しました' : 'Import failed'));
      }
    } catch (e) {
      setError(ja ? '通信エラーが発生しました' : 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setFileContent('');
    setFileName('');
    setPreview(null);
    setResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!canWrite) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">{ja ? 'アクセス権限がありません' : 'Access Denied'}</h2>
          <p className="text-gray-500">{ja ? 'インポートにはオペレーター以上の権限が必要です' : 'Import requires operator or admin access'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Step indicator */}
      <div className="flex items-center gap-4">
        {(['upload', 'preview', 'result'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step === s ? 'bg-blue-500 text-white' :
              (['upload', 'preview', 'result'].indexOf(step) > i) ? 'bg-green-500 text-white' :
              'bg-gray-200 text-gray-500'
            }`}>
              {i + 1}
            </div>
            <span className={`text-sm font-medium ${step === s ? 'text-gray-900' : 'text-gray-400'}`}>
              {s === 'upload' ? (ja ? 'ファイル選択' : 'Select File') :
               s === 'preview' ? (ja ? 'プレビュー' : 'Preview') :
               ja ? '結果' : 'Results'}
            </span>
            {i < 2 && <div className="w-8 h-px bg-gray-300" />}
          </div>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">{error}</div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="space-y-6">
          {/* Target selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.entries(TARGET_INFO) as [ImportTarget, typeof TARGET_INFO[ImportTarget]][]).map(([key, info]) => (
              <div
                key={key}
                onClick={() => setTarget(key)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  target === key
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <h3 className="font-bold text-gray-900">{ja ? info.labelJa : info.labelEn}</h3>
                <p className="text-sm text-gray-500 mt-1">{ja ? info.descJa : info.descEn}</p>
                <p className="text-xs text-gray-400 mt-2 font-mono">{ja ? info.columnsJa : info.columnsEn}</p>
              </div>
            ))}
          </div>

          {/* File upload */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-4">{ja ? 'ファイルアップロード' : 'File Upload'}</h3>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFileSelect}
                className="hidden"
              />
              {fileName ? (
                <div>
                  <svg className="w-12 h-12 text-green-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium text-gray-900">{fileName}</p>
                  <p className="text-xs text-gray-400 mt-1">{format.toUpperCase()} | {(fileContent.length / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-gray-500">{ja ? 'CSV または JSON ファイルを選択' : 'Select a CSV or JSON file'}</p>
                  <p className="text-xs text-gray-400 mt-1">{ja ? 'クリックしてファイルを選択' : 'Click to choose file'}</p>
                </div>
              )}
            </div>

            {/* Format toggle */}
            <div className="flex items-center gap-4 mt-4">
              <span className="text-sm text-gray-500">{ja ? 'フォーマット:' : 'Format:'}</span>
              <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                <button onClick={() => setFormat('csv')} className={`px-4 py-1.5 text-sm font-medium ${format === 'csv' ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>CSV</button>
                <button onClick={() => setFormat('json')} className={`px-4 py-1.5 text-sm font-medium ${format === 'json' ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>JSON</button>
              </div>
            </div>

            <button
              onClick={handlePreview}
              disabled={!fileContent || loading}
              className="mt-6 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
              {ja ? 'プレビュー' : 'Preview'}
            </button>
          </div>

          {/* CSV template examples */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <h4 className="text-sm font-bold text-gray-700 mb-2">{ja ? 'CSVテンプレート例' : 'CSV Template Example'}</h4>
            <pre className="text-xs text-gray-500 bg-white rounded-lg p-3 overflow-x-auto font-mono">
{target === 'customers' ? `display_name,status,tags
田中太郎,active,VIP,新規
佐藤花子,active,リピーター` :
 target === 'tags' ? `name,color,description
VIP,#FFD700,VIP顧客
新規,#06C755,新規登録ユーザー` :
`title,content,category
営業時間,月〜金 9:00-18:00,FAQ
返品ポリシー,商品到着後7日以内に...,ポリシー`}
            </pre>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && preview && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{preview.total}</p>
              <p className="text-sm text-gray-500">{ja ? '合計行数' : 'Total Rows'}</p>
            </div>
            <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{preview.valid}</p>
              <p className="text-sm text-gray-500">{ja ? '有効' : 'Valid'}</p>
            </div>
            <div className="bg-white rounded-xl border border-red-200 p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{preview.errors}</p>
              <p className="text-sm text-gray-500">{ja ? 'エラー' : 'Errors'}</p>
            </div>
          </div>

          {/* Preview table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-16">#</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-20">{ja ? '状態' : 'Status'}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{ja ? 'データ' : 'Data'}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{ja ? 'メッセージ' : 'Messages'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.preview.map((row) => (
                    <tr key={row.row} className={row.valid ? '' : 'bg-red-50'}>
                      <td className="px-4 py-3 text-sm text-gray-500">{row.row}</td>
                      <td className="px-4 py-3">
                        {row.valid ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">OK</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">NG</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                        {Object.entries(row.data).map(([k, v]) => (
                          <span key={k} className="inline-block mr-2">
                            <span className="text-gray-400">{k}:</span> {String(v).substring(0, 30) || '-'}
                          </span>
                        ))}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {row.errors.map((e, i) => (
                          <span key={i} className="block text-red-600">{e}</span>
                        ))}
                        {row.warnings.map((w, i) => (
                          <span key={i} className="block text-yellow-600">{w}</span>
                        ))}
                        {row.errors.length === 0 && row.warnings.length === 0 && (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              {ja ? '戻る' : 'Back'}
            </button>
            <button
              onClick={handleImport}
              disabled={loading || preview.valid === 0}
              className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
              {ja ? `${preview.valid}件をインポート` : `Import ${preview.valid} rows`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 'result' && result && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {ja ? 'インポート完了' : 'Import Complete'}
            </h2>
            <div className="flex items-center justify-center gap-8 mt-4">
              <div>
                <p className="text-3xl font-bold text-green-600">{result.imported}</p>
                <p className="text-sm text-gray-500">{ja ? 'インポート成功' : 'Imported'}</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-yellow-600">{result.skipped}</p>
                <p className="text-sm text-gray-500">{ja ? 'スキップ' : 'Skipped'}</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-400">{result.total}</p>
                <p className="text-sm text-gray-500">{ja ? '合計' : 'Total'}</p>
              </div>
            </div>

            {result.errors && result.errors.length > 0 && (
              <div className="mt-4 text-left bg-red-50 rounded-lg p-3">
                <p className="text-sm font-medium text-red-800 mb-1">{ja ? 'エラー詳細:' : 'Error details:'}</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">{e}</p>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleReset}
            className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {ja ? '新しいインポートを開始' : 'Start New Import'}
          </button>
        </div>
      )}
    </div>
  );
}
