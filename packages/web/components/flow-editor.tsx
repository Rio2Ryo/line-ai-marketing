'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

// ─── Types ───

export interface FlowNode {
  id: string;
  node_type: 'trigger' | 'message' | 'delay' | 'condition';
  message_type: string;
  message_content: string;
  delay_minutes: number;
  condition_json: string | null;
  position_x: number;
  position_y: number;
  step_order: number;
  next_step_id: string | null;
  condition_true_step_id: string | null;
  condition_false_step_id: string | null;
}

interface FlowEditorProps {
  nodes: FlowNode[];
  onAddNode: (node: { node_type: string; message_type: string; message_content: string; delay_minutes: number; condition_json: string | null; position_x: number; position_y: number }) => Promise<void>;
  onUpdateNode: (stepId: string, data: Partial<FlowNode>) => Promise<void>;
  onDeleteNode: (stepId: string) => Promise<void>;
  onSaveLayout: (nodes: Array<{ id: string; position_x: number; position_y: number; next_step_id: string | null; condition_true_step_id: string | null; condition_false_step_id: string | null }>) => Promise<void>;
  triggerType: string;
}

// ─── Constants ───

const NODE_WIDTH = 220;
const NODE_HEIGHT = 100;
const GRID_SIZE = 20;

function snapToGrid(val: number): number {
  return Math.round(val / GRID_SIZE) * GRID_SIZE;
}

// ─── Node Colors ───

function getNodeStyle(type: string): { bg: string; border: string; icon: string } {
  switch (type) {
    case 'trigger': return { bg: 'bg-green-50', border: 'border-green-400', icon: '▶' };
    case 'message': return { bg: 'bg-blue-50', border: 'border-blue-400', icon: '💬' };
    case 'delay': return { bg: 'bg-yellow-50', border: 'border-yellow-400', icon: '⏱' };
    case 'condition': return { bg: 'bg-purple-50', border: 'border-purple-400', icon: '🔀' };
    default: return { bg: 'bg-gray-50', border: 'border-gray-400', icon: '●' };
  }
}

// ─── Component ───

export default function FlowEditor({ nodes, onAddNode, onUpdateNode, onDeleteNode, onSaveLayout, triggerType }: FlowEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; nodeX: number; nodeY: number } | null>(null);
  const [connecting, setConnecting] = useState<{ fromId: string; type: 'next' | 'true' | 'false'; startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const [editingNode, setEditingNode] = useState<FlowNode | null>(null);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [localNodes, setLocalNodes] = useState<FlowNode[]>([]);

  useEffect(() => {
    setLocalNodes(nodes);
  }, [nodes]);

  // Create trigger node position for display
  const triggerNode: FlowNode = {
    id: '__trigger__',
    node_type: 'trigger',
    message_type: 'text',
    message_content: triggerType === 'follow' ? '友だち追加' : triggerType === 'message_keyword' ? 'キーワード受信' : triggerType === 'tag_added' ? 'タグ追加' : '手動実行',
    delay_minutes: 0,
    condition_json: null,
    position_x: 300,
    position_y: 40,
    step_order: 0,
    next_step_id: localNodes.length > 0 ? localNodes.find(n => n.step_order === 1)?.id || null : null,
    condition_true_step_id: null,
    condition_false_step_id: null,
  };

  const allDisplayNodes = [triggerNode, ...localNodes];

  // ─── Mouse handlers for dragging nodes ───

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    if (nodeId === '__trigger__') return; // Can't drag trigger
    e.stopPropagation();
    e.preventDefault();
    const node = localNodes.find(n => n.id === nodeId);
    if (!node) return;
    setDragging({ id: nodeId, startX: e.clientX, startY: e.clientY, nodeX: node.position_x, nodeY: node.position_y });
    setSelectedNode(nodeId);
  }, [localNodes]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      const dx = (e.clientX - dragging.startX) / zoom;
      const dy = (e.clientY - dragging.startY) / zoom;
      const newX = snapToGrid(dragging.nodeX + dx);
      const newY = snapToGrid(dragging.nodeY + dy);
      setLocalNodes(prev => prev.map(n => n.id === dragging.id ? { ...n, position_x: newX, position_y: newY } : n));
      setHasUnsavedChanges(true);
    }
    if (connecting) {
      setConnecting(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
    }
    if (panning) {
      const dx = e.clientX - panning.startX;
      const dy = e.clientY - panning.startY;
      setCanvasOffset({ x: panning.offsetX + dx, y: panning.offsetY + dy });
    }
  }, [dragging, connecting, panning, zoom]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (connecting && canvasRef.current) {
      // Check if dropped on a node
      const rect = canvasRef.current.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left - canvasOffset.x) / zoom;
      const canvasY = (e.clientY - rect.top - canvasOffset.y) / zoom;
      const targetNode = localNodes.find(n =>
        canvasX >= n.position_x && canvasX <= n.position_x + NODE_WIDTH &&
        canvasY >= n.position_y && canvasY <= n.position_y + NODE_HEIGHT &&
        n.id !== connecting.fromId
      );
      if (targetNode) {
        const updates: Partial<FlowNode> = {};
        if (connecting.type === 'next') updates.next_step_id = targetNode.id;
        else if (connecting.type === 'true') updates.condition_true_step_id = targetNode.id;
        else if (connecting.type === 'false') updates.condition_false_step_id = targetNode.id;

        setLocalNodes(prev => prev.map(n => n.id === connecting.fromId ? { ...n, ...updates } : n));
        setHasUnsavedChanges(true);
      }
    }
    setDragging(null);
    setConnecting(null);
    setPanning(null);
  }, [connecting, localNodes, canvasOffset, zoom]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-bg')) {
      setSelectedNode(null);
      setPanning({ startX: e.clientX, startY: e.clientY, offsetX: canvasOffset.x, offsetY: canvasOffset.y });
    }
  }, [canvasOffset]);

  // ─── Connection port handler ───

  const handlePortMouseDown = useCallback((e: React.MouseEvent, nodeId: string, portType: 'next' | 'true' | 'false') => {
    e.stopPropagation();
    e.preventDefault();
    setConnecting({ fromId: nodeId, type: portType, startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY });
  }, []);

  // ─── Add node ───

  const handleAddNode = useCallback(async (type: 'message' | 'delay' | 'condition') => {
    const maxY = localNodes.reduce((max, n) => Math.max(max, n.position_y), 0);
    const newNode = {
      node_type: type,
      message_type: type === 'message' ? 'text' : type === 'delay' ? 'text' : 'text',
      message_content: type === 'message' ? '' : type === 'delay' ? '' : '',
      delay_minutes: type === 'delay' ? 60 : 0,
      condition_json: type === 'condition' ? JSON.stringify({ field: 'tag', operator: 'has', value: '' }) : null,
      position_x: 300,
      position_y: maxY + 140,
    };
    await onAddNode(newNode);
  }, [localNodes, onAddNode]);

  // ─── Save layout ───

  const handleSaveLayout = useCallback(async () => {
    const layoutData = localNodes.map(n => ({
      id: n.id,
      position_x: n.position_x,
      position_y: n.position_y,
      next_step_id: n.next_step_id,
      condition_true_step_id: n.condition_true_step_id,
      condition_false_step_id: n.condition_false_step_id,
    }));
    await onSaveLayout(layoutData);
    setHasUnsavedChanges(false);
  }, [localNodes, onSaveLayout]);

  // ─── Draw connections (SVG) ───

  const renderConnections = () => {
    const lines: React.ReactElement[] = [];

    for (const node of allDisplayNodes) {
      const fromX = node.position_x + NODE_WIDTH / 2;
      const fromY = node.position_y + NODE_HEIGHT;

      // next_step_id connection
      if (node.next_step_id) {
        const target = allDisplayNodes.find(n => n.id === node.next_step_id);
        if (target) {
          const toX = target.position_x + NODE_WIDTH / 2;
          const toY = target.position_y;
          const midY = (fromY + toY) / 2;
          lines.push(
            <path
              key={`${node.id}-next`}
              d={`M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`}
              stroke="#06C755"
              strokeWidth={2}
              fill="none"
              markerEnd="url(#arrowhead)"
            />
          );
        }
      }

      // condition_true connection
      if (node.condition_true_step_id) {
        const target = allDisplayNodes.find(n => n.id === node.condition_true_step_id);
        if (target) {
          const toX = target.position_x + NODE_WIDTH / 2;
          const toY = target.position_y;
          const midY = (fromY + toY) / 2;
          lines.push(
            <g key={`${node.id}-true`}>
              <path
                d={`M ${fromX - 30} ${fromY} C ${fromX - 30} ${midY}, ${toX} ${midY}, ${toX} ${toY}`}
                stroke="#22c55e"
                strokeWidth={2}
                fill="none"
                strokeDasharray="6 3"
                markerEnd="url(#arrowhead-green)"
              />
              <text x={fromX - 50} y={fromY + 16} fill="#22c55e" fontSize={11} fontWeight="bold">YES</text>
            </g>
          );
        }
      }

      // condition_false connection
      if (node.condition_false_step_id) {
        const target = allDisplayNodes.find(n => n.id === node.condition_false_step_id);
        if (target) {
          const toX = target.position_x + NODE_WIDTH / 2;
          const toY = target.position_y;
          const midY = (fromY + toY) / 2;
          lines.push(
            <g key={`${node.id}-false`}>
              <path
                d={`M ${fromX + 30} ${fromY} C ${fromX + 30} ${midY}, ${toX} ${midY}, ${toX} ${toY}`}
                stroke="#ef4444"
                strokeWidth={2}
                fill="none"
                strokeDasharray="6 3"
                markerEnd="url(#arrowhead-red)"
              />
              <text x={fromX + 20} y={fromY + 16} fill="#ef4444" fontSize={11} fontWeight="bold">NO</text>
            </g>
          );
        }
      }
    }

    // Active connecting line
    if (connecting && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const startNode = allDisplayNodes.find(n => n.id === connecting.fromId);
      if (startNode) {
        const sx = startNode.position_x + NODE_WIDTH / 2;
        const sy = startNode.position_y + NODE_HEIGHT;
        const ex = (connecting.currentX - rect.left - canvasOffset.x) / zoom;
        const ey = (connecting.currentY - rect.top - canvasOffset.y) / zoom;
        lines.push(
          <path
            key="connecting"
            d={`M ${sx} ${sy} L ${ex} ${ey}`}
            stroke="#9ca3af"
            strokeWidth={2}
            strokeDasharray="5 5"
            fill="none"
          />
        );
      }
    }

    return lines;
  };

  // ─── Render node ───

  const renderNode = (node: FlowNode) => {
    const style = getNodeStyle(node.node_type);
    const isSelected = selectedNode === node.id;
    const isTrigger = node.id === '__trigger__';

    return (
      <div
        key={node.id}
        className={`absolute rounded-xl border-2 shadow-sm cursor-grab active:cursor-grabbing select-none transition-shadow ${style.bg} ${style.border} ${isSelected ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:shadow-md'}`}
        style={{
          left: node.position_x,
          top: node.position_y,
          width: NODE_WIDTH,
          minHeight: NODE_HEIGHT,
          zIndex: isSelected ? 10 : 1,
        }}
        onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
        onClick={(e) => { e.stopPropagation(); setSelectedNode(node.id); }}
        onDoubleClick={(e) => { e.stopPropagation(); if (!isTrigger) setEditingNode(node); }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-2 pb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{style.icon}</span>
            <span className="text-xs font-bold text-gray-700 uppercase">{
              node.node_type === 'trigger' ? 'トリガー' :
              node.node_type === 'message' ? 'メッセージ' :
              node.node_type === 'delay' ? '待機' :
              node.node_type === 'condition' ? '条件分岐' : node.node_type
            }</span>
          </div>
          {!isTrigger && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }}
              className="text-gray-400 hover:text-red-500 transition-colors text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-3 pb-2">
          {node.node_type === 'trigger' && (
            <p className="text-xs text-gray-600">{node.message_content}</p>
          )}
          {node.node_type === 'message' && (
            <p className="text-xs text-gray-600 line-clamp-2">{node.message_content || '(未設定)'}</p>
          )}
          {node.node_type === 'delay' && (
            <p className="text-xs text-gray-600">
              {node.delay_minutes >= 1440
                ? `${Math.floor(node.delay_minutes / 1440)}日${node.delay_minutes % 1440 > 0 ? ` ${Math.floor((node.delay_minutes % 1440) / 60)}時間` : ''}`
                : node.delay_minutes >= 60
                  ? `${Math.floor(node.delay_minutes / 60)}時間${node.delay_minutes % 60 > 0 ? ` ${node.delay_minutes % 60}分` : ''}`
                  : `${node.delay_minutes}分`
              }後に実行
            </p>
          )}
          {node.node_type === 'condition' && (
            <p className="text-xs text-gray-600">
              {(() => {
                try {
                  const c = JSON.parse(node.condition_json || '{}');
                  return `${c.field || '?'} ${c.operator || '?'} ${c.value || '?'}`;
                } catch { return '条件未設定'; }
              })()}
            </p>
          )}
        </div>

        {/* Connection ports */}
        {!isTrigger && node.node_type !== 'condition' && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
            <div
              className="w-5 h-5 bg-white border-2 border-gray-400 rounded-full cursor-crosshair hover:border-green-500 hover:bg-green-50 flex items-center justify-center transition-colors"
              onMouseDown={(e) => handlePortMouseDown(e, node.id, 'next')}
            >
              <span className="text-[8px] text-gray-400">▼</span>
            </div>
          </div>
        )}
        {isTrigger && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
            <div
              className="w-5 h-5 bg-white border-2 border-green-400 rounded-full cursor-crosshair hover:bg-green-50 flex items-center justify-center"
              onMouseDown={(e) => handlePortMouseDown(e, node.id, 'next')}
            >
              <span className="text-[8px] text-green-500">▼</span>
            </div>
          </div>
        )}
        {node.node_type === 'condition' && (
          <>
            <div className="absolute -bottom-3 left-1/4 -translate-x-1/2">
              <div
                className="w-5 h-5 bg-white border-2 border-green-500 rounded-full cursor-crosshair hover:bg-green-50 flex items-center justify-center"
                onMouseDown={(e) => handlePortMouseDown(e, node.id, 'true')}
                title="YES"
              >
                <span className="text-[8px] text-green-600 font-bold">Y</span>
              </div>
            </div>
            <div className="absolute -bottom-3 left-3/4 -translate-x-1/2">
              <div
                className="w-5 h-5 bg-white border-2 border-red-500 rounded-full cursor-crosshair hover:bg-red-50 flex items-center justify-center"
                onMouseDown={(e) => handlePortMouseDown(e, node.id, 'false')}
                title="NO"
              >
                <span className="text-[8px] text-red-600 font-bold">N</span>
              </div>
            </div>
          </>
        )}

        {/* Input port (top) */}
        {!isTrigger && (
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-gray-300 rounded-full" />
        )}
      </div>
    );
  };

  // ─── Edit Modal ───

  const renderEditModal = () => {
    if (!editingNode) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingNode(null)}>
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            {editingNode.node_type === 'message' ? 'メッセージ編集' :
             editingNode.node_type === 'delay' ? '待機時間設定' :
             editingNode.node_type === 'condition' ? '条件設定' : 'ノード編集'}
          </h3>

          <div className="space-y-4">
            {editingNode.node_type === 'message' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">メッセージタイプ</label>
                  <select
                    value={editingNode.message_type}
                    onChange={(e) => setEditingNode({ ...editingNode, message_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="text">テキスト</option>
                    <option value="image">画像</option>
                    <option value="flex">Flex Message</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">メッセージ内容</label>
                  <textarea
                    value={editingNode.message_content}
                    onChange={(e) => setEditingNode({ ...editingNode, message_content: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    placeholder="メッセージを入力..."
                  />
                </div>
              </>
            )}

            {editingNode.node_type === 'delay' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">待機時間 (分)</label>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[
                    { label: '30分', value: 30 },
                    { label: '1時間', value: 60 },
                    { label: '1日', value: 1440 },
                    { label: '3日', value: 4320 },
                  ].map(p => (
                    <button
                      key={p.value}
                      onClick={() => setEditingNode({ ...editingNode, delay_minutes: p.value })}
                      className={`px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                        editingNode.delay_minutes === p.value
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={editingNode.delay_minutes}
                  onChange={(e) => setEditingNode({ ...editingNode, delay_minutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={0}
                />
              </div>
            )}

            {editingNode.node_type === 'condition' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">条件フィールド</label>
                  <select
                    value={(() => { try { return JSON.parse(editingNode.condition_json || '{}').field || 'tag'; } catch { return 'tag'; } })()}
                    onChange={(e) => {
                      const c = (() => { try { return JSON.parse(editingNode.condition_json || '{}'); } catch { return {}; } })();
                      setEditingNode({ ...editingNode, condition_json: JSON.stringify({ ...c, field: e.target.value }) });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="tag">タグ</option>
                    <option value="status">ステータス</option>
                    <option value="message_count">メッセージ数</option>
                    <option value="last_active_days">最終活動日数</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">演算子</label>
                  <select
                    value={(() => { try { return JSON.parse(editingNode.condition_json || '{}').operator || 'has'; } catch { return 'has'; } })()}
                    onChange={(e) => {
                      const c = (() => { try { return JSON.parse(editingNode.condition_json || '{}'); } catch { return {}; } })();
                      setEditingNode({ ...editingNode, condition_json: JSON.stringify({ ...c, operator: e.target.value }) });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="has">含む</option>
                    <option value="not_has">含まない</option>
                    <option value="equals">等しい</option>
                    <option value="greater_than">より大きい</option>
                    <option value="less_than">より小さい</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">値</label>
                  <input
                    type="text"
                    value={(() => { try { return JSON.parse(editingNode.condition_json || '{}').value || ''; } catch { return ''; } })()}
                    onChange={(e) => {
                      const c = (() => { try { return JSON.parse(editingNode.condition_json || '{}'); } catch { return {}; } })();
                      setEditingNode({ ...editingNode, condition_json: JSON.stringify({ ...c, value: e.target.value }) });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="値を入力..."
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setEditingNode(null)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              onClick={async () => {
                const updates: Partial<FlowNode> = {
                  message_type: editingNode.message_type,
                  message_content: editingNode.message_content,
                  delay_minutes: editingNode.delay_minutes,
                  condition_json: editingNode.condition_json,
                };
                await onUpdateNode(editingNode.id, updates);
                setEditingNode(null);
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-sm font-medium text-gray-700 mr-2">ノード追加:</span>
        <button
          onClick={() => handleAddNode('message')}
          className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
        >
          💬 メッセージ
        </button>
        <button
          onClick={() => handleAddNode('delay')}
          className="px-3 py-1.5 text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors"
        >
          ⏱ 待機
        </button>
        <button
          onClick={() => handleAddNode('condition')}
          className="px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
        >
          🔀 条件分岐
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50">−</button>
          <span className="text-xs text-gray-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(1.5, z + 0.1))} className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50">+</button>
        </div>
        {hasUnsavedChanges && (
          <button
            onClick={handleSaveLayout}
            className="px-4 py-1.5 text-xs font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            レイアウト保存
          </button>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative bg-gray-50 rounded-xl border border-gray-200 overflow-hidden"
        style={{ height: 600, cursor: panning ? 'grabbing' : 'grab' }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Grid pattern */}
        <div
          className="canvas-bg absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
            backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`,
            backgroundPosition: `${canvasOffset.x}px ${canvasOffset.y}px`,
          }}
        />

        {/* Transformed content */}
        <div
          style={{
            transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            position: 'absolute',
            inset: 0,
          }}
        >
          {/* SVG connections */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#06C755" />
              </marker>
              <marker id="arrowhead-green" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#22c55e" />
              </marker>
              <marker id="arrowhead-red" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
              </marker>
            </defs>
            {renderConnections()}
          </svg>

          {/* Nodes */}
          {allDisplayNodes.map(renderNode)}
        </div>

        {/* Empty state */}
        {localNodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-gray-400">ノードを追加してフローを作成してください</p>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-2">ダブルクリックでノード編集 / ポート(●)をドラッグして接続 / 右クリックキャンバスでパン</p>

      {/* Edit modal */}
      {renderEditModal()}
    </div>
  );
}
