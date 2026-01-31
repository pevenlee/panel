import React, { useState, useMemo, useEffect } from 'react';
import {
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Plus,
    Trash2,
    CheckSquare,
    Square,
    Filter,
    Download,
    X,
    GripHorizontal
} from 'lucide-react';

export default function EnhancedTable({ data, title = '数据表', height = 300, columnMapping = {} }) {
    if (!data || data.length === 0) {
        return <div className="p-4 text-center text-slate-400">暂无数据</div>;
    }

    // Initial Columns
    const initialColumns = useMemo(() => Object.keys(data[0]), [data]);

    // Formatting Helpers
    const isPercentageKey = (key) => {
        if (!key || typeof key !== 'string') return false;
        const k = key.toLowerCase();
        return k.includes('率') || k.includes('比') || k.includes('份额') || k.includes('percent') || k.includes('rate') || k.includes('ratio');
    };

    const formatValue = (value, key = '') => {
        if (value == null || isNaN(value)) return value;
        const num = Number(value);
        if (isPercentageKey(key)) {
            if (Math.abs(num) <= 1.05 && num !== 0) return (num * 100).toFixed(1) + '%';
            return num.toFixed(1) + '%';
        }
        if (Math.abs(num) >= 100000000) return (num / 100000000).toFixed(1) + '亿';
        if (Math.abs(num) >= 10000) return (num / 10000).toFixed(1) + '万';
        if (!Number.isInteger(num)) return num.toFixed(1);
        return num.toLocaleString();
    };

    // State
    const [columns, setColumns] = useState(initialColumns);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [filters, setFilters] = useState({});
    const [showFilters, setShowFilters] = useState(false);
    const [draggedCol, setDraggedCol] = useState(null);

    // Slicer State
    const [activeSlicers, setActiveSlicers] = useState([]); // List of keys: ['province', 'type']
    const [slicerSelections, setSlicerSelections] = useState({}); // { province: ['Beijing', 'Shanghai'] }
    const [showSlicerMenu, setShowSlicerMenu] = useState(false);

    // Update columns if data changes drastically (new schema)
    useEffect(() => {
        setColumns(Object.keys(data[0]));
        // Clear slicers on data change to avoid invalid keys
        setActiveSlicers([]);
        setSlicerSelections({});
    }, [data]);

    // Analyze columns for slicability (cardinality < 20)
    const slicableColumns = useMemo(() => {
        const candidates = [];
        const uniqueMaps = {};

        Object.keys(data[0]).forEach(key => {
            const values = new Set(data.map(d => String(d[key])));
            if (values.size <= 20 && values.size > 1) { // >1 to avoid useless single-value slicers unless strictly needed, but let's keep simple
                candidates.push(key);
                uniqueMaps[key] = Array.from(values).sort();
            }
        });
        return { candidates, uniqueMaps };
    }, [data]);

    // Handlers
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleDragStart = (e, col) => {
        setDraggedCol(col);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, col) => {
        e.preventDefault();
        if (draggedCol === col) return;
    };

    const handleDrop = (e, targetCol) => {
        e.preventDefault();
        if (draggedCol && draggedCol !== targetCol) {
            const newCols = [...columns];
            const draggedIdx = newCols.indexOf(draggedCol);
            const targetIdx = newCols.indexOf(targetCol);
            newCols.splice(draggedIdx, 1);
            newCols.splice(targetIdx, 0, draggedCol);
            setColumns(newCols);
        }
        setDraggedCol(null);
    };

    const toggleSlicer = (key) => {
        if (activeSlicers.includes(key)) {
            setActiveSlicers(prev => prev.filter(k => k !== key));
            // Also clean up selections
            setSlicerSelections(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        } else {
            setActiveSlicers(prev => [...prev, key]);
        }
        setShowSlicerMenu(false);
    };

    const toggleSlicerSelection = (key, value) => {
        setSlicerSelections(prev => {
            const current = prev[key] || [];
            if (current.includes(value)) {
                // Remove
                const nextVal = current.filter(v => v !== value);
                if (nextVal.length === 0) {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                }
                return { ...prev, [key]: nextVal };
            } else {
                // Add
                return { ...prev, [key]: [...current, value] };
            }
        });
    };

    const handleExport = () => {
        // Basic CSV Export
        const headers = columns.join(',');
        const rows = processedData.map(row =>
            columns.map(col => {
                const val = row[col];
                return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
            }).join(',')
        );
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${title || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Process Data
    const processedData = useMemo(() => {
        let filtered = [...data];

        // 1. Text Filters
        Object.keys(filters).forEach(key => {
            const val = filters[key];
            if (val) {
                filtered = filtered.filter(item =>
                    String(item[key]).toLowerCase().includes(val.toLowerCase())
                );
            }
        });

        // 2. Slicer Filters
        Object.keys(slicerSelections).forEach(key => {
            const selectedVals = slicerSelections[key];
            if (selectedVals && selectedVals.length > 0) {
                filtered = filtered.filter(item => selectedVals.includes(String(item[key])));
            }
        });

        // 3. Sort
        if (sortConfig.key) {
            filtered.sort((a, b) => {
                const aVal = a[sortConfig.key];
                const bVal = b[sortConfig.key];

                if (aVal === bVal) return 0;

                // Try numeric sort
                const aNum = Number(aVal);
                const bNum = Number(bVal);
                const isNum = !isNaN(aNum) && !isNaN(bNum);

                if (isNum) {
                    return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
                }

                // String sort
                const aStr = String(aVal);
                const bStr = String(bVal);
                return sortConfig.direction === 'asc'
                    ? aStr.localeCompare(bStr, 'zh-CN')
                    : bStr.localeCompare(aStr, 'zh-CN');
            });
        }

        return filtered;
    }, [data, filters, sortConfig, slicerSelections]);

    return (
        <div className="w-full h-full flex flex-col bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                <span className="text-xs font-semibold text-slate-500">
                    {processedData.length} 条记录
                </span>
                <div className="flex gap-2 relative">
                    {/* Add Slicer Button */}
                    <div className="relative">
                        <button
                            onClick={() => setShowSlicerMenu(!showSlicerMenu)}
                            className={`flex items-center gap-1 px-2 py-1.5 rounded transition-colors text-xs font-medium border border-transparent 
                             ${showSlicerMenu ? 'bg-orange-50 text-orange-600 border-orange-200' : 'hover:bg-slate-200 text-slate-600'}`}
                            title="添加切片器"
                            disabled={slicableColumns.candidates.length === 0}
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>切片器</span>
                        </button>

                        {/* Dropdown */}
                        {showSlicerMenu && (
                            <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50">
                                <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 border-b border-slate-50">可用字段</div>
                                <div className="max-h-56 overflow-y-auto">
                                    {slicableColumns.candidates.map(key => (
                                        <button
                                            key={key}
                                            onClick={() => toggleSlicer(key)}
                                            className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between group"
                                        >
                                            <span className={activeSlicers.includes(key) ? 'text-orange-600 font-medium' : 'text-slate-600'}>
                                                {key}
                                            </span>
                                            {activeSlicers.includes(key) && <CheckSquare className="w-3 h-3 text-orange-500" />}
                                        </button>
                                    ))}
                                    {slicableColumns.candidates.length === 0 && (
                                        <div className="px-3 py-2 text-xs text-slate-400">没有适合切片的字段</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="w-px h-6 bg-slate-200 mx-1"></div>

                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-1.5 rounded transition-colors ${showFilters ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-200 text-slate-500'}`}
                        title="筛选"
                    >
                        <Filter className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleExport}
                        className="p-1.5 hover:bg-slate-200 text-slate-500 rounded transition-colors"
                        title="导出 CSV"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Main Content Area: Table + Slicers */}
            <div className="flex-1 overflow-hidden flex flex-row">

                {/* Table Area */}
                <div className="flex-1 overflow-auto w-full relative" style={{ maxHeight: typeof height === 'string' ? height : `${height}px`, minHeight: 0 }}>
                    <table className="w-full text-sm text-left text-slate-600 border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                {columns.map((col, index) => (
                                    <th
                                        key={col}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, col)}
                                        onDragOver={(e) => handleDragOver(e, col)}
                                        onDrop={(e) => handleDrop(e, col)}
                                        className={`
                        px-3 py-2 font-semibold text-slate-600 border-b border-r border-slate-200 last:border-r-0 select-none
                        ${draggedCol === col ? 'opacity-50 bg-blue-50' : 'hover:bg-slate-100'}
                        cursor-move transition-colors
                      `}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1 overflow-hidden" onClick={() => handleSort(col)}>
                                                <span className="truncate cursor-pointer hover:text-blue-600" title={col}>
                                                    {columnMapping[col] || col}
                                                </span>
                                                {sortConfig.key === col ? (
                                                    sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />
                                                ) : (
                                                    <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100" />
                                                )}
                                            </div>
                                        </div>

                                        {/* Filter Input */}
                                        {showFilters && (
                                            <div className="mt-2">
                                                <input
                                                    type="text"
                                                    placeholder="筛..."
                                                    value={filters[col] || ''}
                                                    onChange={(e) => handleFilterChange(col, e.target.value)}
                                                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-400 font-normal"
                                                    onMouseDown={(e) => e.stopPropagation()} // Prevent drag start when clicking input
                                                />
                                            </div>
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {processedData.map((row, i) => (
                                <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                    {columns.map((col) => (
                                        <td key={col} className="px-3 py-2 border-r border-slate-100 last:border-r-0 whitespace-nowrap">
                                            {row[col] != null ? (typeof row[col] === 'number' ? formatValue(row[col], col) : String(row[col])) : '—'}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Slicer Panel (Right Side) */}
                {activeSlicers.length > 0 && (
                    <div className="w-60 flex-shrink-0 border-l border-slate-200 bg-slate-50 flex flex-col overflow-hidden">
                        <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-white">
                            <span className="text-xs font-bold text-slate-600">切片器 ({activeSlicers.length})</span>
                            <button onClick={() => setActiveSlicers([])} className="text-xs text-slate-400 hover:text-red-500">
                                清空
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-3">
                            {activeSlicers.map(key => (
                                <div key={key} className="bg-white border border-slate-200 rounded shadow-sm flex flex-col max-h-60">
                                    {/* Slicer Header */}
                                    <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                        <span className="text-xs font-semibold text-slate-700 truncate" title={key}>{key}</span>
                                        <button onClick={() => toggleSlicer(key)} className="text-slate-400 hover:text-slate-600">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                    {/* Slicer List */}
                                    <div className="overflow-y-auto p-1 space-y-0.5">
                                        {slicableColumns.uniqueMaps[key].map(val => {
                                            const isSelected = (slicerSelections[key] || []).includes(val);
                                            return (
                                                <button
                                                    key={val}
                                                    onClick={() => toggleSlicerSelection(key, val)}
                                                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded text-left transition-colors
                                                       ${isSelected ? 'bg-orange-50 text-orange-700' : 'hover:bg-slate-50 text-slate-600'}
                                                     `}
                                                >
                                                    {isSelected ? (
                                                        <CheckSquare className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                                                    ) : (
                                                        <Square className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                                                    )}
                                                    <span className="truncate">{val}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
