import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// --- 常量定义 ---
// 保持与主应用一致的配色方案
const PHARM_ORANGE = '#f97316'; // 活力橙 (重点色)

const COLORS = [
  '#0ea5e9', // 天蓝
  '#f97316', // 橙色
  '#3b82f6', // 蓝色
  '#10b981', // 翠绿
  '#8b5cf6', // 紫色
  '#f43f5e', // 玫红
];

/**
 * ChartRenderer 组件
 * * @param {string} type - 图表类型: 'bar', 'line', 'pie', 'table'
 * @param {Array} data - 数据数组，格式通常为 [{ name: '江苏', value: 100 }, ...]
 * @param {string} title - 图表标题
 * @param {number|string} height - 容器高度，默认为 300
 */
const ChartRenderer = ({ type, data, title, height = 300 }) => {
  
  // 安全检查：防止数据为空导致报错
  if (!data || data.length === 0) {
    return (
      <div style={{ height }} className="w-full flex items-center justify-center bg-slate-50 border border-slate-200 rounded text-slate-400 text-sm">
        暂无数据
      </div>
    );
  }

  // --- 1. 表格渲染逻辑 ---
  if (type === 'table') {
    return (
      <div className="w-full bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col" style={{ height }}>
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase flex justify-between sticky top-0 z-10">
          <span>分析维度</span>
          <span>统计数值</span>
        </div>
        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="w-full text-sm text-left text-slate-600">
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="bg-white border-b hover:bg-slate-50 transition-colors last:border-0">
                  <td className="px-4 py-2 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-2 text-right font-mono text-[#0f172a]">
                    {/* 数值格式化，添加千分位 */}
                    {row.value ? row.value.toLocaleString() : 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- 2. 图表渲染逻辑 (Recharts) ---
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {type === 'line' ? (
          // --- 折线图 ---
          <LineChart data={data} margin={{ top: 10, right: 30, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
            />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            <Line
              type="monotone"
              dataKey="value"
              name={title || "数值"}
              stroke={PHARM_ORANGE}
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
              activeDot={{ r: 6, fill: PHARM_ORANGE }}
            />
          </LineChart>
        ) : type === 'pie' ? (
          // --- 饼图 ---
          <PieChart>
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
            />
            <Legend verticalAlign="bottom" height={36} />
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              innerRadius={50} // 甜甜圈效果
              outerRadius={80}
              fill="#8884d8"
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        ) : (
          // --- 柱状图 (默认) ---
          <BarChart data={data} margin={{ top: 10, right: 30, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: '#f1f5f9' }}
              contentStyle={{
                backgroundColor: '#fff',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
            />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            <Bar
              dataKey="value"
              name={title || "数值"}
              fill={COLORS[0]}
              radius={[4, 4, 0, 0]}
              barSize={40}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

export default ChartRenderer;
