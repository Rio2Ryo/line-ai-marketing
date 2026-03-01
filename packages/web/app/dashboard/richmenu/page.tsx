'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

interface RichMenuSize {
  width: number;
  height: number;
}

interface RichMenuBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RichMenuAction {
  type: 'message' | 'uri' | 'postback';
  label: string;
  text?: string;
  uri?: string;
  data?: string;
}

interface RichMenuArea {
  bounds: RichMenuBounds;
  action: RichMenuAction;
}

interface RichMenu {
  richMenuId: string;
  name: string;
  chatBarText: string;
  size: RichMenuSize;
  areas: RichMenuArea[];
  selected: boolean;
}

type TemplateType = '2col' | '3col';

interface AreaFormData {
  type: 'message' | 'uri' | 'postback';
  label: string;
  value: string;
}

export default function RichMenuPage() {
  const [menus, setMenus] = useState<RichMenu[]>([]);
  const [defaultMenuId, setDefaultMenuId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formChatBarText, setFormChatBarText] = useState('');
  const [template, setTemplate] = useState<TemplateType>('2col');
  const [areaForms, setAreaForms] = useState<AreaFormData[]>([
    { type: 'message', label: '', value: '' },
    { type: 'message', label: '', value: '' },
  ]);

  const fetchMenus = useCallback(async () => {
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/richmenu');
      if (res.ok) {
        const data = await res.json();
        setMenus(Array.isArray(data) ? data : data.richmenus || []);
      }
    } catch (err) {
      console.error('Failed to fetch rich menus:', err);
    }
  }, []);

  const fetchDefault = useCallback(async () => {
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/richmenu/default');
      if (res.ok) {
        const data = await res.json();
        setDefaultMenuId(data.richMenuId || '');
      }
    } catch (err) {
      console.error('Failed to fetch default rich menu:', err);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchMenus(), fetchDefault()]);
      setLoading(false);
    };
    loadData();
  }, [fetchMenus, fetchDefault]);

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetchWithAuth(
        getApiUrl() + '/api/richmenu/' + id + '/default',
        { method: 'POST' }
      );
      if (res.ok) {
        setDefaultMenuId(id);
      }
    } catch (err) {
      console.error('Failed to set default rich menu:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('このリッチメニューを削除しますか？')) return;
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/richmenu/' + id, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMenus((prev) => prev.filter((m) => m.richMenuId !== id));
        if (defaultMenuId === id) {
          setDefaultMenuId('');
        }
      }
    } catch (err) {
      console.error('Failed to delete rich menu:', err);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormChatBarText('');
    setTemplate('2col');
    setAreaForms([
      { type: 'message', label: '', value: '' },
      { type: 'message', label: '', value: '' },
    ]);
  };

  const handleTemplateChange = (newTemplate: TemplateType) => {
    setTemplate(newTemplate);
    const count = newTemplate === '2col' ? 2 : 3;
    const newAreas: AreaFormData[] = [];
    for (let i = 0; i < count; i++) {
      newAreas.push(
        areaForms[i] || { type: 'message', label: '', value: '' }
      );
    }
    setAreaForms(newAreas);
  };

  const updateAreaForm = (
    index: number,
    field: keyof AreaFormData,
    value: string
  ) => {
    setAreaForms((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const buildAreas = (): RichMenuArea[] => {
    const count = template === '2col' ? 2 : 3;
    const areaWidth = Math.floor(2500 / count);

    return areaForms.slice(0, count).map((form, i) => {
      const action: RichMenuAction = {
        type: form.type,
        label: form.label,
      };
      if (form.type === 'message') {
        action.text = form.value;
      } else if (form.type === 'uri') {
        action.uri = form.value;
      } else if (form.type === 'postback') {
        action.data = form.value;
      }

      return {
        bounds: {
          x: areaWidth * i,
          y: 0,
          width: areaWidth,
          height: 1686,
        },
        action,
      };
    });
  };

  const handleCreate = async () => {
    if (!formName.trim() || !formChatBarText.trim()) return;
    setCreating(true);
    try {
      const body = {
        size: { width: 2500, height: 1686 },
        selected: true,
        name: formName,
        chatBarText: formChatBarText,
        areas: buildAreas(),
      };
      const res = await fetchWithAuth(getApiUrl() + '/api/richmenu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowCreateModal(false);
        resetForm();
        fetchMenus();
      }
    } catch (err) {
      console.error('Failed to create rich menu:', err);
    } finally {
      setCreating(false);
    }
  };

  const getActionPlaceholder = (type: string): string => {
    switch (type) {
      case 'message':
        return '送信するテキストを入力';
      case 'uri':
        return 'https://example.com';
      case 'postback':
        return 'action=buy&itemid=123';
      default:
        return '';
    }
  };

  const getActionValueLabel = (type: string): string => {
    switch (type) {
      case 'message':
        return 'テキスト';
      case 'uri':
        return 'URI';
      case 'postback':
        return 'データ';
      default:
        return '値';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">リッチメニュー管理</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
            >
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
              <div className="flex gap-2">
                <div className="h-8 bg-gray-200 rounded w-24" />
                <div className="h-8 bg-gray-200 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">リッチメニュー管理</h1>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="px-4 py-2 bg-[#06C755] text-white rounded-lg font-medium hover:bg-[#05b34c] transition-colors"
        >
          新規作成
        </button>
      </div>

      {/* メニューカード一覧 */}
      {menus.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <svg
            className="w-16 h-16 text-gray-300 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2zm0 8a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2z"
            />
          </svg>
          <p className="text-gray-500">
            リッチメニューがありません。「新規作成」からリッチメニューを追加しましょう。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {menus.map((menu) => (
            <div
              key={menu.richMenuId}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-gray-900">{menu.name}</h3>
                {defaultMenuId === menu.richMenuId && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                    デフォルト
                  </span>
                )}
              </div>
              <div className="space-y-1 mb-4">
                <p className="text-sm text-gray-500">
                  <span className="text-gray-700 font-medium">メニューバー:</span>{' '}
                  {menu.chatBarText}
                </p>
                <p className="text-sm text-gray-500">
                  <span className="text-gray-700 font-medium">サイズ:</span>{' '}
                  {menu.size.width} x {menu.size.height}
                </p>
                <p className="text-sm text-gray-500">
                  <span className="text-gray-700 font-medium">エリア:</span>{' '}
                  {menu.areas.length}エリア
                </p>
              </div>
              <div className="flex items-center gap-2">
                {defaultMenuId !== menu.richMenuId && (
                  <button
                    onClick={() => handleSetDefault(menu.richMenuId)}
                    className="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  >
                    デフォルトに設定
                  </button>
                )}
                <button
                  onClick={() => handleDelete(menu.richMenuId)}
                  className="text-sm text-red-500 hover:text-red-700 font-medium px-3 py-1.5"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 作成モーダル */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                リッチメニュー新規作成
              </h2>
              <div className="space-y-4">
                {/* 名前 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    メニュー名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent"
                    placeholder="例: メインメニュー"
                  />
                </div>

                {/* chatBarText */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    メニューバーテキスト <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formChatBarText}
                    onChange={(e) => setFormChatBarText(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent"
                    placeholder="例: メニューを開く"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    チャット画面下部のメニューバーに表示されるテキスト
                  </p>
                </div>

                {/* テンプレート選択 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    テンプレート
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleTemplateChange('2col')}
                      className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
                        template === '2col'
                          ? 'border-[#06C755] bg-[#06C755]/10 text-[#06C755]'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex gap-1 justify-center mb-1">
                        <div
                          className={`w-8 h-6 rounded ${
                            template === '2col' ? 'bg-[#06C755]/30' : 'bg-gray-200'
                          }`}
                        />
                        <div
                          className={`w-8 h-6 rounded ${
                            template === '2col' ? 'bg-[#06C755]/30' : 'bg-gray-200'
                          }`}
                        />
                      </div>
                      <span className="text-sm">2列</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTemplateChange('3col')}
                      className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
                        template === '3col'
                          ? 'border-[#06C755] bg-[#06C755]/10 text-[#06C755]'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex gap-1 justify-center mb-1">
                        <div
                          className={`w-5 h-6 rounded ${
                            template === '3col' ? 'bg-[#06C755]/30' : 'bg-gray-200'
                          }`}
                        />
                        <div
                          className={`w-5 h-6 rounded ${
                            template === '3col' ? 'bg-[#06C755]/30' : 'bg-gray-200'
                          }`}
                        />
                        <div
                          className={`w-5 h-6 rounded ${
                            template === '3col' ? 'bg-[#06C755]/30' : 'bg-gray-200'
                          }`}
                        />
                      </div>
                      <span className="text-sm">3列</span>
                    </button>
                  </div>
                </div>

                {/* エリア設定 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    エリア設定
                  </label>
                  <div className="space-y-4">
                    {areaForms.map((area, index) => (
                      <div
                        key={index}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3"
                      >
                        <p className="text-sm font-medium text-gray-700">
                          エリア {index + 1}
                        </p>
                        {/* アクションタイプ */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            アクションタイプ
                          </label>
                          <select
                            value={area.type}
                            onChange={(e) =>
                              updateAreaForm(index, 'type', e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent bg-white text-sm"
                          >
                            <option value="message">メッセージ (message)</option>
                            <option value="uri">URI (uri)</option>
                            <option value="postback">ポストバック (postback)</option>
                          </select>
                        </div>
                        {/* ラベル */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            ラベル
                          </label>
                          <input
                            type="text"
                            value={area.label}
                            onChange={(e) =>
                              updateAreaForm(index, 'label', e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent text-sm"
                            placeholder="例: お問い合わせ"
                          />
                        </div>
                        {/* 値 */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            {getActionValueLabel(area.type)}
                          </label>
                          <input
                            type="text"
                            value={area.value}
                            onChange={(e) =>
                              updateAreaForm(index, 'value', e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent text-sm"
                            placeholder={getActionPlaceholder(area.type)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ボタン */}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleCreate}
                  disabled={
                    creating || !formName.trim() || !formChatBarText.trim()
                  }
                  className="px-4 py-2 bg-[#06C755] text-white rounded-lg hover:bg-[#05b34c] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? '作成中...' : '作成'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
