import React, { useMemo, useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import EnhancedTable from './EnhancedTable';

// --- 常量定义 ---
const COLORS = [
  '#0ea5e9', // 天蓝
  '#f97316', // 橙色
  '#3b82f6', // 蓝色
  '#10b981', // 翠绿
  '#8b5cf6', // 紫色
  '#f43f5e', // 玫红
  '#eab308', // 金黄
  '#06b6d4', // 青色
];

const PROVINCE_ALIAS = {
  '北京': '北京市', '天津': '天津市', '河北': '河北省', '山西': '山西省', '内蒙古': '内蒙古自治区',
  '辽宁': '辽宁省', '吉林': '吉林省', '黑龙江': '黑龙江省', '上海': '上海市', '江苏': '江苏省',
  '浙江': '浙江省', '安徽': '安徽省', '福建': '福建省', '江西': '江西省', '山东': '山东省',
  '河南': '河南省', '湖北': '湖北省', '湖南': '湖南省', '广东': '广东省', '广西': '广西壮族自治区',
  '海南': '海南省', '重庆': '重庆市', '四川': '四川省', '贵州': '贵州省', '云南': '云南省',
  '西藏': '西藏自治区', '陕西': '陕西省', '甘肃': '甘肃省', '青海': '青海省', '宁夏': '宁夏回族自治区',
  '新疆': '新疆维吾尔自治区', '台湾': '台湾省', '香港': '香港特别行政区', '澳门': '澳门特别行政区'
};

const normalizeProvinceName = (name) => {
  if (!name) return name;
  const cleanName = String(name).trim();
  // 1. 直接匹配
  if (PROVINCE_ALIAS[cleanName]) return PROVINCE_ALIAS[cleanName];
  // 2. 如果已经是完整名称（在 Values 中），直接返回
  if (Object.values(PROVINCE_ALIAS).includes(cleanName)) return cleanName;
  // 3. 尝试移除“省/市”后匹配（例如数据是“陕西省”，Map 可能也是“陕西省”，但防止数据是“陕西”而Map是“陕西省”）
  // 上面的 PROVINCE_ALIAS 处理了“陕西”->“陕西省”。
  // 额外的模糊匹配逻辑可以以后加。
  return cleanName;
};

// 辅助函数：判断是否为百分比字段
const isPercentageKey = (key) => {
  if (!key || typeof key !== 'string') return false;
  const k = key.toLowerCase();
  return k.includes('率') || k.includes('比') || k.includes('份额') || k.includes('percent') || k.includes('rate') || k.includes('ratio');
};

// 通用数值格式化
const formatValue = (value, key = '') => {
  if (value == null || isNaN(value)) return value;
  const num = Number(value);

  // 1. 如果是百分比相关的字段
  if (isPercentageKey(key)) {
    // 假设小数形式 (0.123 -> 12.3%)
    if (Math.abs(num) <= 1.05 && num !== 0) {
      return (num * 100).toFixed(1) + '%';
    }
    // 假设已经是百分数 (12.3 -> 12.3%)
    return num.toFixed(1) + '%';
  }

  // 2. 普通大数字
  if (Math.abs(num) >= 100000000) {
    return (num / 100000000).toFixed(1) + '亿';
  }
  if (Math.abs(num) >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }
  // 小数保留1位，整数不保留
  if (!Number.isInteger(num)) {
    return num.toFixed(1);
  }
  return num.toLocaleString();
};

const formatLargeNumber = (value) => formatValue(value); // 兼容旧调用

/**
 * ChartRenderer 组件 (ECharts 版本)
 * @param {string} type - 图表类型: 'bar', 'line', 'pie', 'area', 'scatter', 'bubble', 'radar', 'funnel', 'table'
 * @param {Array} data - 数据数组
 * @param {string} title - 图表标题
 * @param {number|string} height - 容器高度，默认为 300
 * @param {object} geminiConfig - Gemini 提供的图表配置 (可选)
 */
const ChartRenderer = ({ type, data, title, height = 300, geminiConfig = {}, columnMapping = {} }) => {
  const [metricOverride, setMetricOverride] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const echartRef = React.useRef(null);

  // 自动识别数据列 - Move UP to avoid React Hooks violation (calling useMemo conditionally)
  // 必须放在所有 conditional returns 之前。
  const dataKeys = useMemo(() => {
    if (!data || data.length === 0) return ['value'];
    const keys = Object.keys(data[0]).filter(k => {
      if (k === 'name') return false;
      const val = data[0][k];
      // 1. Check if number
      if (typeof val === 'number') return true;
      // 2. Check if string looking like number or percentage
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === '') return false;
        // Check for percentage
        if (trimmed.endsWith('%')) {
          const num = parseFloat(trimmed.slice(0, -1));
          return !isNaN(num);
        }
        // Check for normal number string
        return !isNaN(Number(trimmed));
      }
      return false;
    });
    return keys.length > 0 ? keys : ['value'];
  }, [data]);

  // 动态加载中国地图数据
  useEffect(() => {
    if (type === 'map') {
      if (!echarts.getMap('china')) {
        fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json')
          .then(res => res.json())
          .then(geoJson => {
            echarts.registerMap('china', geoJson);
            setMapLoaded(true);
          })
          .catch(err => console.error('Failed to load China map:', err));
      } else {
        // 地图已加载，直接设置状态以触发重新渲染
        setMapLoaded(true);
      }
    }
  }, [type]);

  // Force resize on mount and when height changes to ensure map renders correctly
  useEffect(() => {
    const resizeChart = () => {
      if (echartRef.current) {
        const instance = echartRef.current.getEchartsInstance();
        instance && instance.resize();
      }
    };

    // Initial delay resize
    const timer = setTimeout(resizeChart, 100);
    // Secondary delay for slower layouts
    const timer2 = setTimeout(resizeChart, 500);

    window.addEventListener('resize', resizeChart);

    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
      window.removeEventListener('resize', resizeChart);
    };
  }, [height, data, type, mapLoaded]);

  // 从 Gemini 配置中提取样式参数
  const chartColors = (geminiConfig.colors && geminiConfig.colors.length > 0 && geminiConfig.colors[0] !== '#颜色1')
    ? geminiConfig.colors
    : COLORS;
  const xAxisLabel = geminiConfig.xAxisLabel || '';
  const yAxisLabel = geminiConfig.yAxisLabel || '';
  const showLegend = geminiConfig.showLegend !== false;
  const showGrid = geminiConfig.showGrid !== false;
  const unit = geminiConfig.unit || '';

  // 安全检查
  if (type === 'map' && !mapLoaded) {
    return (
      <div style={{ height }} className="w-full flex items-center justify-center bg-slate-50 border border-slate-200 rounded text-slate-400 text-sm">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600"></div>
          <span>地图加载中...</span>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div style={{ height }} className="w-full flex items-center justify-center bg-slate-50 border border-slate-200 rounded text-slate-400 text-sm">
        暂无数据
      </div>
    );
  }

  // 表格渲染
  if (type === 'table') {
    return (
      <EnhancedTable data={data} title={title} height={height} columnMapping={columnMapping} />
    );
  }

  // 图片渲染
  if (type === 'image') {
    const imageUrl = geminiConfig.imageUrl || (data && data[0] && data[0].value);

    if (!imageUrl) {
      return (
        <div style={{ height }} className="w-full flex items-center justify-center bg-slate-50 border border-slate-200 rounded text-slate-400 text-sm">
          暂无图片链接
        </div>
      );
    }

    return (
      <div style={{ height }} className="w-full flex items-center justify-center bg-white overflow-hidden rounded-lg">
        <img
          src={imageUrl}
          alt={title || "图表图片"}
          className="max-w-full max-h-full object-contain"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "https://placehold.co/600x400?text=Image+Load+Failed";
          }}
        />
      </div>
    );
  }

  // 构建 ECharts option
  const getOption = () => {
    // 智能推断 X 轴字段 (Name Dimension)
    const nameKey = (() => {
      // 1. 优先使用 Gemini 指定的维度
      if (geminiConfig.dimension) return geminiConfig.dimension;
      // 2. 查找 explicit 'name' 字段
      if (data[0].name) return 'name';
      // 3. 查找非数值列 (Dimensions)
      const allKeys = Object.keys(data[0]);
      const dimensionKey = allKeys.find(k => !dataKeys.includes(k)); // dataKeys 是数值列
      if (dimensionKey) return dimensionKey;
      return 'name';
    })();
    const names = data.map(d => d[nameKey] || d.name || '');

    // 基础配置
    const baseOption = {
      color: chartColors,
      tooltip: {
        trigger: type === 'pie' || type === 'radar' || type === 'funnel' ? 'item' : 'axis',
        backgroundColor: '#fff',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        textStyle: { color: '#334155' },
        formatter: (params) => {
          if (Array.isArray(params)) {
            let result = `<strong>${params[0].axisValue || params[0].name}</strong><br/>`;
            params.forEach(p => {
              result += `${p.marker} ${p.seriesName}: ${formatValue(p.value, p.seriesName)}${unit}<br/>`;
            });
            return result;
          }
          return `${params.marker} ${params.name}: ${formatValue(params.value, params.seriesName)}${unit}`;
        }
      },
      legend: showLegend ? {
        top: 0,
        left: 'left',
        type: 'scroll',
        pageIconColor: '#94a3b8',
        pageTextStyle: { color: '#64748b' },
        textStyle: { color: '#64748b', fontSize: 12 }
      } : undefined,
      toolbox: {
        feature: {
          dataZoom: { yAxisIndex: 'none' },
          restore: {},
          saveAsImage: {}
        },
        right: 10,
        top: 0
      },
    };

    // 根据图表类型生成配置
    switch (type) {
      case 'line':
      case 'area':
      case 'bar':
      case 'mix':
        const isDefaultLine = type === 'line' || type === 'area';
        // 判断是否需要双轴：既有普通数值，又有百分比字段
        const percentKeys = dataKeys.filter(isPercentageKey);
        const valueKeys = dataKeys.filter(k => !isPercentageKey(k));
        const useDualAxis = percentKeys.length > 0 && valueKeys.length > 0;

        const primaryAxis = {
          type: 'value',
          name: yAxisLabel,
          axisLine: { lineStyle: { color: '#e2e8f0' } },
          axisLabel: {
            color: '#64748b',
            fontSize: 12,
            // 如果没有数值列（全是百分比，虽然会被 useDualAxis=false 处理，但作为主轴也兼容），就用百分比格式
            formatter: (v) => formatValue(v, valueKeys.length > 0 ? valueKeys[0] : percentKeys[0])
          },
          splitLine: showGrid ? { lineStyle: { color: '#f1f5f9' } } : { show: false }
        };

        const secondaryAxis = {
          type: 'value',
          name: '',
          position: 'right',
          alignTicks: true,
          axisLine: { lineStyle: { color: '#e2e8f0' } },
          axisLabel: {
            color: '#64748b',
            fontSize: 12,
            formatter: (v) => formatValue(v, percentKeys[0] || 'rate')
          },
          splitLine: { show: false }
        };

        return {
          ...baseOption,
          grid: {
            top: 40,
            right: 30,
            bottom: 10,
            left: 10,
            containLabel: true
          },
          xAxis: {
            type: 'category',
            data: names,
            name: xAxisLabel,
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisLabel: { color: '#64748b', fontSize: 12, rotate: names.length > 8 ? 30 : 0 }
          },
          yAxis: useDualAxis ? [primaryAxis, secondaryAxis] : primaryAxis,
          series: dataKeys.map((key, index) => {
            const isPercent = isPercentageKey(key);
            // 图表类型策略：
            // 1. 如果是百分比字段 -> 强制折线图 (line)
            // 2. 否则 -> 使用传入的默认类型 (type)
            const seriesType = isPercent ? 'line' : (type === 'mix' ? 'bar' : (isDefaultLine ? 'line' : 'bar'));

            return {
              name: key === 'value' ? (title || '数值') : key,
              type: seriesType,
              yAxisIndex: (useDualAxis && isPercent) ? 1 : 0,
              data: data.map(d => d[key]),
              barMaxWidth: 40,
              itemStyle: seriesType === 'bar' ? { borderRadius: [4, 4, 0, 0] } : undefined,
              smooth: true,
              areaStyle: type === 'area' ? { opacity: 0.3 } : undefined,
              lineStyle: { width: 3 },
              symbol: 'circle',
              symbolSize: 8,
              z: isPercent ? 10 : 2 // 确保折线在柱状图上方
            };
          })
        };

      case 'pie':
        return {
          ...baseOption,
          series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            center: ['50%', '45%'],
            data: data.map((d, i) => ({
              name: d[nameKey] || d.name,
              value: d[dataKeys[0]] || d.value
            })),
            label: {
              formatter: '{b}: {d}%',
              color: '#64748b'
            },
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.3)'
              }
            }
          }]
        };

      case 'scatter':
        return {
          ...baseOption,
          grid: { top: 30, right: 30, bottom: showLegend ? 50 : 30, left: 60 },
          xAxis: {
            type: 'value',
            name: xAxisLabel || (dataKeys[0] || 'X'),
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisLabel: { color: '#64748b', fontSize: 12, formatter: formatLargeNumber }
          },
          yAxis: {
            type: 'value',
            name: yAxisLabel || (dataKeys[1] || 'Y'),
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisLabel: { color: '#64748b', fontSize: 12, formatter: formatLargeNumber },
            splitLine: showGrid ? { lineStyle: { color: '#f1f5f9' } } : { show: false }
          },
          series: [{
            name: title || '数据',
            type: 'scatter',
            symbolSize: 12,
            data: data.map(d => [d[dataKeys[0]] || d.value, d[dataKeys[1]] || d[dataKeys[0]] || d.value]),
            label: {
              show: data.length <= 15,
              formatter: (p) => data[p.dataIndex]?.name || '',
              position: 'top',
              color: '#64748b',
              fontSize: 10
            }
          }]
        };

      case 'bubble':
        // 气泡图：按维度分组显示颜色（Legend）
        const xKey = geminiConfig.xDataKey || dataKeys[0] || 'value';
        const yKey = geminiConfig.yDataKey || dataKeys[1] || dataKeys[0] || 'value';
        const sizeKey = geminiConfig.sizeDataKey || dataKeys[2] || dataKeys[0] || 'value';

        // 寻找分组字段（用于图例颜色）：优先 Config，其次找除了 nameKey 以外的第一个文本列
        const groupKey = geminiConfig.seriesKey || Object.keys(data[0]).find(k =>
          k !== 'name' && k !== nameKey && !dataKeys.includes(k)
        );

        // 计算气泡大小系数
        const maxVal = Math.max(...data.map(d => Math.abs(d[sizeKey] || 0))) || 1;
        const getSize = (val) => {
          const v = Math.abs(val);
          // 简单归一化映射到 10-60
          return Math.max(10, Math.min(80, (Math.sqrt(v) / Math.sqrt(maxVal)) * 60));
        };

        // 数据分组
        const groups = {};
        if (groupKey) {
          data.forEach(d => {
            const g = d[groupKey] || '未分类';
            if (!groups[g]) groups[g] = [];
            groups[g].push(d);
          });
        } else {
          groups['数据'] = data;
        }

        return {
          ...baseOption,
          grid: { top: 40, right: 30, bottom: 10, left: 10, containLabel: true },
          legend: {
            ...baseOption.legend,
            data: Object.keys(groups) // 显式设置图例数据
          },
          tooltip: {
            trigger: 'item',
            backgroundColor: '#fff',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            textStyle: { color: '#334155' },
            formatter: (params) => {
              // params.value = [x, y, size, name]
              if (Array.isArray(params.value) && params.value.length >= 4) {
                const name = params.value[3];
                return `
                   <strong>${name}</strong><br/>
                   ${params.seriesName}<br/>
                   ${xAxisLabel || xKey}: ${formatValue(params.value[0], xAxisLabel || xKey)}<br/>
                   ${yAxisLabel || yKey}: ${formatValue(params.value[1], yAxisLabel || yKey)}<br/>
                   ${sizeKey}: ${formatValue(params.value[2], sizeKey)}
                 `;
              }
              return params.name;
            }
          },
          xAxis: {
            type: 'value',
            name: xAxisLabel || xKey,
            scale: true, // X轴不从0开始，适应气泡分布
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisLabel: { color: '#64748b', fontSize: 12, formatter: (v) => formatValue(v, xAxisLabel || xKey) },
            splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } }
          },
          yAxis: {
            type: 'value',
            name: yAxisLabel || yKey,
            scale: true, // Y轴不从0开始
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisLabel: { color: '#64748b', fontSize: 12, formatter: (v) => formatValue(v, yAxisLabel || yKey) },
            splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } }
          },
          series: Object.keys(groups).map(gName => ({
            name: gName,
            type: 'scatter',
            symbolSize: (val) => getSize(val[2]),
            // data item: [x, y, size, name]
            data: groups[gName].map(d => [
              d[xKey],
              d[yKey],
              d[sizeKey],
              d[nameKey] || d.name || gName // 确保 Name 存在
            ]),
            label: {
              show: true,
              formatter: (p) => p.value[3],
              position: 'top',
              color: '#64748b',
              fontSize: 10
            },
            itemStyle: { opacity: 0.8, shadowBlur: 2, shadowColor: 'rgba(0,0,0,0.1)' }
          }))
        };

      case 'radar':
        // 雷达图
        const indicators = dataKeys.map(k => ({
          name: k,
          max: Math.max(...data.map(d => d[k] || 0)) * 1.2
        }));

        return {
          ...baseOption,
          radar: {
            indicator: indicators,
            shape: 'circle',
            splitNumber: 4,
            axisName: { color: '#64748b', fontSize: 12 },
            splitLine: { lineStyle: { color: '#e2e8f0' } },
            splitArea: { areaStyle: { color: ['#fff', '#f8fafc'] } }
          },
          series: [{
            type: 'radar',
            data: data.map((d, i) => ({
              name: d.name,
              value: dataKeys.map(k => d[k] || 0),
              areaStyle: { opacity: 0.3 }
            }))
          }]
        };

      case 'funnel':
        // 漏斗图
        return {
          ...baseOption,
          series: [{
            type: 'funnel',
            left: '10%',
            top: 30,
            bottom: showLegend ? 50 : 30,
            width: '80%',
            min: 0,
            max: Math.max(...data.map(d => d[dataKeys[0]] || d.value || 0)),
            sort: 'descending',
            gap: 4,
            label: {
              show: true,
              position: 'inside',
              formatter: '{b}: {c}',
              color: '#fff'
            },
            itemStyle: { borderColor: '#fff', borderWidth: 1 },
            data: data.map((d, i) => ({
              name: d.name,
              value: d[dataKeys[0]] || d.value,
              itemStyle: { color: chartColors[i % chartColors.length] }
            }))
          }]
        };

      case 'heatmap':
        // 热力图
        const allKeysHM = Object.keys(data[0]);
        const stringKeysHM = allKeysHM.filter(k => k !== 'name' && !dataKeys.includes(k));

        const hxKey = geminiConfig.xDataKey || stringKeysHM[0] || 'x';
        const hyKey = geminiConfig.yDataKey || stringKeysHM[1] || stringKeysHM[0] || 'y';
        // 使用 Override 或 默认 Metric
        const hValKey = metricOverride || geminiConfig.metricKey || dataKeys[0] || 'value';

        const xCats = Array.from(new Set(data.map(d => d[hxKey]))).filter(Boolean);
        const yCats = Array.from(new Set(data.map(d => d[hyKey]))).filter(Boolean);

        // Helper to parse value
        const parseVal = (v) => {
          if (typeof v === 'number') return v;
          if (typeof v === 'string') {
            const t = v.trim();
            if (t.endsWith('%')) return parseFloat(t);
            return parseFloat(t) || 0;
          }
          return 0;
        };

        const heatmapData = data.map(d => {
          const xIdx = xCats.indexOf(d[hxKey]);
          const yIdx = yCats.indexOf(d[hyKey]);
          const val = parseVal(d[hValKey]);
          return [xIdx, yIdx, val];
        }).filter(item => item[0] !== -1 && item[1] !== -1);

        const maxHVal = Math.max(...data.map(d => parseVal(d[hValKey]))) || 100;

        return {
          ...baseOption,
          grid: { top: 30, right: 30, bottom: 60, left: 100 },
          tooltip: {
            position: 'top',
            formatter: (p) => {
              const x = p.name;
              const y = yCats[p.value[1]];
              const val = formatValue(p.value[2], hValKey);
              return `${x} - ${y}<br/>${p.marker} ${hValKey}: <strong>${val}</strong>`;
            }
          },
          animation: false,
          xAxis: {
            type: 'category',
            data: xCats,
            splitArea: { show: true },
            axisLabel: { interval: 0, rotate: 30, color: '#64748b' }
          },
          yAxis: {
            type: 'category',
            data: yCats,
            splitArea: { show: true },
            axisLabel: { color: '#64748b' }
          },
          visualMap: {
            min: 0,
            max: maxHVal,
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: 10,
            inRange: { color: ['#fff7ed', '#fdba74', '#ea580c'] },
            formatter: (value) => formatValue(value, hValKey)
          },
          series: [{
            name: title || '热力图',
            type: 'heatmap',
            data: heatmapData,
            label: {
              show: true,
              formatter: (p) => formatValue(p.data[2], hValKey)
            },
            itemStyle: {
              borderColor: '#fff',
              borderWidth: 1,
            },
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowColor: 'rgba(0, 0, 0, 0.5)'
              }
            }
          }]
        };

      case 'map':
        const mapValKey = metricOverride || geminiConfig.metricKey || dataKeys[0] || 'value';
        const mapNameKey = nameKey;

        // Ensure values are numbers (handle "12.5%" strings)
        const parseMapVal = (v) => {
          if (typeof v === 'number') return v;
          if (typeof v === 'string') {
            const t = v.trim();
            if (t.endsWith('%')) return parseFloat(t);
            return parseFloat(t) || 0;
          }
          return 0;
        };

        const vals = data.map(d => parseMapVal(d[mapValKey]));
        const maxMapVal = Math.max(...vals) || 100;
        const minMapVal = Math.min(...vals) || 0;

        return {
          ...baseOption,
          tooltip: {
            trigger: 'item',
            backgroundColor: '#fff',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            textStyle: { color: '#334155' },
            formatter: (p) => {
              if (isNaN(p.value)) return `${p.name}<br/>无数据`;
              return `${p.name}<br/>${p.marker} ${mapValKey}: <strong>${formatValue(p.value, mapValKey)}</strong>`;
            }
          },
          visualMap: {
            min: minMapVal,
            max: maxMapVal,
            range: [minMapVal, maxMapVal], // 显式重置滑块范围，防止切换指标时保留上一个指标的过滤状态
            left: 20,
            bottom: 20,
            text: ['高', '低'],
            calculable: true,
            inRange: { color: ['#fff7ed', '#fdba74', '#ea580c'] },
            formatter: (value) => formatValue(value, mapValKey)
          },
          series: [{
            name: title || '地图',
            type: 'map',
            map: 'china',
            roam: true,
            label: { show: true, color: '#666', fontSize: 10 },
            itemStyle: {
              areaColor: '#f8fafc',
              borderColor: '#94a3b8'
            },
            emphasis: {
              itemStyle: { areaColor: '#fed7aa' },
              label: { show: true, color: '#c2410c' }
            },
            data: data.map(d => ({
              name: normalizeProvinceName(d[mapNameKey] || d.name),
              value: parseMapVal(d[mapValKey] || d.value)
            }))
          }]
        };

      default:
        // 默认柱状图
        return {
          ...baseOption,
          grid: { top: 30, right: 30, bottom: showLegend ? 50 : 30, left: 60 },
          xAxis: {
            type: 'category',
            data: names,
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisLabel: { color: '#64748b', fontSize: 12, rotate: names.length > 8 ? 30 : 0 }
          },
          yAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisLabel: { color: '#64748b', fontSize: 12, formatter: formatLargeNumber },
            splitLine: showGrid ? { lineStyle: { color: '#f1f5f9' } } : { show: false }
          },
          series: dataKeys.map((key, index) => ({
            name: key === 'value' ? (title || '数值') : key,
            type: 'bar',
            data: data.map(d => d[key]),
            barMaxWidth: 40,
            itemStyle: { borderRadius: [4, 4, 0, 0] }
          }))
        };
    }
  };

  const effectiveType = geminiConfig?.chartType?.toLowerCase() || type?.toLowerCase() || 'bar';
  // 对于 heatmap/map 类型，如果有多个数值列，则显示指标切换按钮
  const isMapLike = effectiveType === 'heatmap' || effectiveType === 'map' || type === 'map' || type === 'heatmap';
  const showMetricToggle = isMapLike && dataKeys.length > 1;

  return (
    <div style={{ height }} className="w-full relative flex flex-col group">
      {/* 热力图指标切换按钮 */}
      {showMetricToggle && (
        <div className="absolute top-2 right-2 z-10 flex gap-1 bg-white/90 p-1 rounded-lg border border-slate-200 shadow-sm">
          {dataKeys.map(k => (
            <button
              key={k}
              onClick={() => setMetricOverride(k)}
              className={`px-2 py-1 text-xs rounded transition-colors ${(metricOverride || dataKeys[0]) === k
                ? 'bg-orange-100 text-orange-700 font-medium'
                : 'text-slate-500 hover:bg-slate-50'
                }`}
            >
              {k}
            </button>
          ))}
        </div>
      )}
      <ReactECharts
        ref={echartRef}
        option={getOption()}
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  );
};

export default ChartRenderer;
