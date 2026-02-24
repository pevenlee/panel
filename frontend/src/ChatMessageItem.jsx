import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
    Code, ChevronUp, ChevronDown, Maximize2, X, Sparkles, Wand2, Plus, Edit3, Activity, Check, CheckCircle2, Edit2, Loader2, Copy
} from 'lucide-react';
import ChartRenderer from './components/ChartRenderer';
import { THEME } from './theme';

// Helper for Copy Button
const CopyButton = ({ text }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    return (
        <button
            onClick={handleCopy}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"
            title="复制内容"
        >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
    );
};

// Generic Table Component (reused)
const GenericTable = ({ records, maxHeight = 300 }) => {
    if (!records || records.length === 0) return <div className="p-4 text-center text-slate-400 text-sm">无数据</div>;
    const columns = Object.keys(records[0]);
    return (
        <div className="overflow-x-auto custom-scrollbar" style={{ maxHeight }}>
            <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                        {columns.map((col, idx) => (
                            <th key={idx} className="px-3 py-2 font-medium text-slate-600 border-b border-slate-200 whitespace-nowrap">
                                {col}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {records.map((row, rIdx) => (
                        <tr key={rIdx} className="border-b border-slate-100 hover:bg-slate-50/50">
                            {columns.map((col, cIdx) => (
                                <td key={cIdx} className="px-3 py-2 text-slate-600 whitespace-nowrap">
                                    {row[col]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// Main Chat Message Item Component
const ChatMessageItem = ({
    msg,
    idx,
    pendingChartConfig,
    setPendingChartConfig,
    setExpandedChart,
    handleSmartChart,
    handleCustomChartClick,
    addToDashboard,
    handleRequestChart,
    handleExecutePlan
}) => {
    // Local state for this message item
    const [codeExpanded, setCodeExpanded] = useState(false);
    const [renamingHeadersMsgIdx, setRenamingHeadersMsgIdx] = useState(null); // Just boolean or local state?
    // Actually, the original logic used index to track *which* message is renaming. 
    // Inside a component, we just need "isRenaming".
    const [isRenaming, setIsRenaming] = useState(false);
    const [pendingColumnMapping, setPendingColumnMapping] = useState({});
    const [editingPlanItem, setEditingPlanItem] = useState(null); // { itemIdx, title, description }

    // Handlers for renaming
    const handleStartRenaming = (dr) => {
        setPendingColumnMapping(dr.columnMapping || {});
        setIsRenaming(true);
    };

    const cancelRenaming = () => {
        setIsRenaming(false);
        setPendingColumnMapping({});
    };

    const handleSaveRenaming = () => {
        // We need to update the data in the *parent* state. 
        // This is tricky because we don't have a direct setter for messages here.
        // Ideally, we should pass a callback `onUpdateMessage` from parent.
        // For now, let's just log or implement if possible.
        // TODO: Implement onUpdateMessage
        setIsRenaming(false);
    };

    // Handlers for Plan Editing
    const handleEditPlanItem = (itemIdx, item) => {
        setEditingPlanItem({ itemIdx, ...item });
    };

    const handleSavePlanItem = () => {
        // TODO: Implement update
        setEditingPlanItem(null);
    };


    return (
        <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            {/* Avatar */}
            <div className="flex-shrink-0">
                {msg.role === 'user' ? (
                    <img src="/user-avatar.jpg" alt="User" className="w-9 h-9 rounded-full object-cover shadow-sm" onError={(e) => { e.target.onerror = null; e.target.src = 'https://ui-avatars.com/api/?name=User&background=6366f1&color=fff'; }} />
                ) : (
                    <img src="/pmc-icon.png" alt="AI" className="w-9 h-9 rounded-full object-cover shadow-sm bg-white" onError={(e) => { e.target.onerror = null; e.target.src = 'https://ui-avatars.com/api/?name=AI&background=8b5cf6&color=fff'; }} />
                )}
            </div>

            {/* Message Content */}
            <div
                className={`max-w-[85%] p-4 shadow-sm text-sm leading-relaxed transition-all relative group ${msg.role === 'user'
                        ? `bg-gradient-to-br ${THEME.primaryGradient} text-white rounded-2xl rounded-tr-sm shadow-indigo-200`
                        : msg.role === 'system'
                            ? 'bg-gradient-to-br from-slate-50 to-indigo-50/50 border border-indigo-100/50 text-slate-700 rounded-2xl rounded-tl-sm'
                            : msg.content.includes('查询出错') || msg.content.includes('出错啦') || msg.content.includes('已中止生成')
                                ? 'bg-red-50/50 border border-red-100 text-red-700 rounded-2xl rounded-tl-sm'
                                : 'bg-white border border-slate-100 text-slate-700 rounded-2xl rounded-tl-sm shadow-sm'
                    } `}
            >
                {msg.role === 'assistant' && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <CopyButton text={typeof msg.content === 'string' ? msg.content : ''} />
                    </div>
                )}

                {/* Text Content */}
                <ReactMarkdown
                    components={{
                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                        a: ({ node, ...props }) => <a className="text-blue-600 hover:underline" {...props} />,
                        code: ({ node, inline, ...props }) => inline
                            ? <code className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono text-pink-600" {...props} />
                            : <code className="block bg-slate-900 text-slate-50 p-3 rounded-lg text-xs font-mono overflow-x-auto my-2" {...props} />
                    }}
                >
                    {typeof msg.content === 'string' ? msg.content : ''}
                </ReactMarkdown>

                {/* Table Result */}
                {msg.type === 'table_result' && msg.dataResult && (() => {
                    const dr = msg.dataResult;
                    const isAnalysis = dr.mode === 'analysis';

                    return (
                        <div className="mt-4 space-y-4">
                            {/* Simple 模式 */}
                            {dr.mode === 'simple' && (() => {
                                const uiId = `msg_${idx}_main`;
                                const isConfiguring = pendingChartConfig?._uiId === uiId;

                                return (
                                    <>
                                        {/* Logic Description */}
                                        {dr.logicDescription && (
                                            <div className="bg-blue-50/80 border border-blue-100 rounded-lg p-3 mb-2">
                                                <p className="text-sm text-slate-700">{dr.logicDescription}</p>
                                            </div>
                                        )}

                                        {/* Code Block */}
                                        {dr.code && (
                                            <div className="mb-2">
                                                <button
                                                    onClick={() => setCodeExpanded(!codeExpanded)}
                                                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                                                >
                                                    <Code className="w-3.5 h-3.5" />
                                                    <span>执行代码</span>
                                                    {codeExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                </button>
                                                {codeExpanded && (
                                                    <div className="mt-2 bg-slate-900 rounded-lg p-3 overflow-x-auto">
                                                        <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">{dr.code}</pre>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Summary */}
                                        {dr.summary && (dr.summary.intent || dr.summary.logic) && (
                                            <div className="bg-blue-50/80 border border-blue-100 rounded-lg p-3 text-sm text-slate-700">
                                                {dr.summary.intent && <p className="font-medium text-slate-800 mb-1">{dr.summary.intent}</p>}
                                                {(dr.summary.scope || dr.summary.metrics) && <p className="text-xs text-slate-600">{[dr.summary.scope, dr.summary.metrics].filter(Boolean).join(' · ')}</p>}
                                                {dr.summary.logic && <p className="text-xs text-slate-500 mt-1">{dr.summary.logic}</p>}
                                            </div>
                                        )}

                                        {/* Main Table Preview */}
                                        <div className="bg-slate-50 rounded border border-slate-200 p-2 mb-2 relative group">
                                            <button onClick={() => setExpandedChart({ ...dr, data: dr.fullData || dr.data, type: 'table' })} className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white text-slate-400 hover:text-blue-600 rounded-md shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 transition-all z-10" title="放大查看"><Maximize2 className="w-3.5 h-3.5" /></button>
                                            <div className="text-xs text-slate-400 mb-1 font-mono">{dr.logicDescription || '数据查询结果'}</div>
                                            <ChartRenderer type="table" data={dr.fullData || dr.data || []} title={dr.title} height={180} />
                                        </div>

                                        {/* Other Tables */}
                                        {dr.tables && Object.keys(dr.tables).length > 1 && (
                                            <div className="space-y-2">
                                                <div className="text-xs font-semibold text-slate-500">其他结果表</div>
                                                {Object.entries(dr.tables).filter(([k]) => k !== dr.title).map(([tableName, rows]) => (
                                                    <div key={tableName} className="border border-slate-200 rounded-lg overflow-hidden">
                                                        <div className="bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">{tableName}</div>
                                                        <GenericTable records={rows} maxHeight={160} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Actions */}
                                        {isConfiguring ? (
                                            <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                                                <button onClick={handleSmartChart} className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"><Sparkles className="w-3.5 h-3.5" /> 智能推荐</button>
                                                <button onClick={handleCustomChartClick} className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-semibold rounded-lg transition-all"><Wand2 className="w-3.5 h-3.5" /> 自定义</button>
                                                <button onClick={() => setPendingChartConfig(null)} className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2">
                                                <button onClick={() => addToDashboard(dr, 'table')} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg"><Plus className="w-3.5 h-3.5" /> 保存表格</button>
                                                {/* Renaming is tricky without parent callback, temporarily disabled or need passed callback */}
                                                <button onClick={() => handleStartRenaming(dr)} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg"><Edit3 className="w-3.5 h-3.5" /> 重命名</button>
                                                <button onClick={() => handleRequestChart({ ...dr, _uiId: uiId })} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg"><Activity className="w-3.5 h-3.5" /> 生成图表</button>
                                            </div>
                                        )}

                                        {/* Renaming Modal */}
                                        {isRenaming && (
                                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                                                <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-96 overflow-hidden animate-in zoom-in-95 duration-200">
                                                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                                        <h3 className="font-semibold text-slate-700">重命名表头</h3>
                                                        <button onClick={cancelRenaming} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                                                    </div>
                                                    <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
                                                        {Object.keys(dr.fullData?.[0] || dr.data?.[0] || {}).map(col => (
                                                            <div key={col} className="space-y-1">
                                                                <label className="text-xs font-medium text-slate-500">{col}</label>
                                                                <input
                                                                    type="text"
                                                                    value={pendingColumnMapping[col] || col}
                                                                    onChange={e => setPendingColumnMapping(prev => ({ ...prev, [col]: e.target.value }))}
                                                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                                                                    placeholder="新列名..."
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex gap-2 justify-end">
                                                        <button onClick={cancelRenaming} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">取消</button>
                                                        <button onClick={handleSaveRenaming} className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors">保存更改</button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}

                            {/* Plan Confirmation Mode */}
                            {dr.mode === 'plan_confirmation' && (
                                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                        <h3 className="font-semibold text-slate-700">{dr.title || '生产计划确认'}</h3>
                                        <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">{dr.plan?.length || 0} 个表格</span>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <p className="text-sm text-slate-600 mb-2">{dr.logicDescription}</p>
                                        <div className="space-y-2">
                                            {dr.plan?.map((item, pIdx) => {
                                                const isEditing = editingPlanItem?.itemIdx === pIdx;
                                                return (
                                                    <div key={pIdx} className="flex gap-3 p-3 bg-slate-50 rounded border border-slate-100 items-start group">
                                                        <div className="mt-0.5 w-5 h-5 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full text-xs font-bold shrink-0">{pIdx + 1}</div>
                                                        <div className="flex-1">
                                                            {isEditing ? (
                                                                <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                                                    <input className="w-full text-sm font-medium border border-blue-300 rounded px-2 py-1.5 outline-none"
                                                                        value={editingPlanItem.title}
                                                                        onChange={e => setEditingPlanItem({ ...editingPlanItem, title: e.target.value })}
                                                                    />
                                                                    <textarea className="w-full text-xs text-slate-600 border border-blue-300 rounded px-2 py-1.5 min-h-[80px] outline-none resize-none"
                                                                        value={editingPlanItem.description}
                                                                        onChange={e => setEditingPlanItem({ ...editingPlanItem, description: e.target.value })}
                                                                    />
                                                                    <div className="flex gap-2 justify-end">
                                                                        <button onClick={handleSavePlanItem} className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-600 hover:bg-green-100 rounded text-xs font-medium border border-green-200 transition-colors"><Check className="w-3.5 h-3.5" /> 保存</button>
                                                                        <button onClick={() => setEditingPlanItem(null)} className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded text-xs font-medium transition-colors"><X className="w-3.5 h-3.5" /> 取消</button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="flex justify-between items-start">
                                                                        <div className="font-medium text-slate-800 text-sm">{item.title}</div>
                                                                        <button onClick={() => handleEditPlanItem(pIdx, item)} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all opacity-0 group-hover:opacity-100"><Edit2 className="w-3.5 h-3.5" /></button>
                                                                    </div>
                                                                    <div className="text-xs text-slate-500 mt-1">{item.description}</div>
                                                                    <div className="text-xs text-slate-400 mt-1 italic group-hover:text-slate-500 transition-colors">逻辑: {item.logic}</div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="pt-2 flex justify-end">
                                            <button onClick={() => handleExecutePlan(dr.plan)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"><CheckCircle2 className="w-4 h-4" /> 确认并生产所有表格</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Analysis Mode (Simplified for now, similar logic) */}

                        </div>
                    );
                })()}

                {/* Chart Result */}
                {msg.type === 'chart_result' && msg.chartResult && (
                    <div className="mt-4">
                        <div className="bg-white rounded border border-slate-100 p-2 mb-3 relative group">
                            <button onClick={() => setExpandedChart({ ...msg.chartResult, type: msg.chartResult.chartType })} className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white text-slate-400 hover:text-blue-600 rounded-md shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 transition-all z-10" title="放大查看"><Maximize2 className="w-3.5 h-3.5" /></button>
                            <ChartRenderer type={msg.chartResult.chartType} data={msg.chartResult.fullData || msg.chartResult.data || []} title={msg.chartResult.title} height={180} geminiConfig={msg.chartResult.geminiConfig || {}} />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => addToDashboard(msg.chartResult, msg.chartResult.chartType)} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg transition-colors"><Plus className="w-3.5 h-3.5" /> 保存图表</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatMessageItem;
