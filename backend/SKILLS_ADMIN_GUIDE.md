# Skills 中台系统使用指南

## 🎉 系统已完成

Skills 中台管理系统已经成功创建！这是一个可视化的管理平台，用于管理和配置所有 Skills。

---

## 📁 已创建的文件

### 后端文件
1. **backend/app/skills/admin.py** - Skills 管理核心逻辑
   - SkillsConfigManager: 配置管理
   - SkillsMetricsManager: 指标管理

2. **backend/app/main.py** (已更新) - 添加了管理 API
   - GET /api/admin/skills - 获取所有 Skills
   - GET /api/admin/skills/{name} - 获取详情
   - PUT /api/admin/skills/{name}/config - 更新配置
   - POST /api/admin/skills/{name}/toggle - 启用/禁用
   - POST /api/admin/skills/{name}/test - 测试执行
   - GET /api/admin/skills/{name}/metrics - 获取统计

### 前端文件
1. **frontend/src/components/SkillsAdmin.jsx** - 完整的管理界面
   - SkillsAdmin: 主组件
   - SkillsList: Skills 列表
   - SkillCard: Skills 卡片
   - SkillDetail: 详情弹窗
   - ConfigTab: 配置管理
   - MetricsTab: 监控面板
   - TestTab: 测试工具

---

## 🚀 启动步骤

### 1. 启动后端
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. 启动前端
```bash
cd frontend
npm install
npm run dev
```

### 3. 访问中台
在浏览器中访问前端，然后导航到 Skills 管理页面。

---

## 💡 功能说明

### 1. Skills 列表页
- 查看所有已注册的 Skills
- 搜索和筛选 Skills
- 快速启用/禁用 Skills
- 点击卡片查看详情

### 2. 配置管理
- 查看 Skill 基本信息
- 实时修改配置参数
- 保存配置到文件
- 配置立即生效

### 3. 监控面板
- 总执行次数
- 成功率统计
- 平均执行时间
- 最近执行记录

### 4. 测试工具
- 输入 JSON 格式的测试参数
- 在线执行 Skill
- 查看执行结果
- 显示执行时间

---

## 📊 界面预览

### Skills 列表
```
┌─────────────────────────────────────────────────────┐
│  Skills 管理中台                    [搜索框]         │
├─────────────────────────────────────────────────────┤
│  research_plan_generator              [已启用 ✓]    │
│  生成市场调研计划                                    │
│  版本: 1.0.0                                        │
├─────────────────────────────────────────────────────┤
│  research_data_collector              [已启用 ✓]    │
│  从数据库收集调研数据                                │
│  版本: 1.0.0                                        │
└─────────────────────────────────────────────────────┘
```

### 详情弹窗
```
┌─────────────────────────────────────────────────────┐
│  research_plan_generator                      [✕]   │
├─────────────────────────────────────────────────────┤
│  [配置] [监控] [测试]                               │
├─────────────────────────────────────────────────────┤
│  基本信息:                                          │
│  名称: research_plan_generator                      │
│  描述: 生成市场调研计划                             │
│  版本: 1.0.0                                        │
│                                                      │
│  配置参数:                                          │
│  model: [gemini-3-pro-preview      ]               │
│  max_steps: [10                    ]               │
│                                                      │
│  [保存配置]                                         │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 集成到现有应用

### 方式 1: 作为独立页面
在 App.jsx 中添加路由：

```jsx
import SkillsAdmin from './components/SkillsAdmin';

// 在路由中添加
<Route path="/admin/skills" element={<SkillsAdmin />} />
```

### 方式 2: 作为模块集成
在现有页面中嵌入：

```jsx
import SkillsAdmin from './components/SkillsAdmin';

function AdminPage() {
  return (
    <div>
      <h1>管理后台</h1>
      <SkillsAdmin />
    </div>
  );
}
```

---

## 📝 使用示例

### 1. 查看所有 Skills
访问中台首页，自动加载所有已注册的 Skills。

### 2. 修改配置
1. 点击 Skill 卡片
2. 切换到"配置"标签
3. 修改参数值
4. 点击"保存配置"

### 3. 测试 Skill
1. 点击 Skill 卡片
2. 切换到"测试"标签
3. 输入测试参数（JSON 格式）
4. 点击"执行测试"
5. 查看执行结果

### 4. 查看监控数据
1. 点击 Skill 卡片
2. 切换到"监控"标签
3. 查看执行统计和历史记录

---

## 🎯 核心特性

✅ **可视化管理**: 直观的界面展示所有 Skills
✅ **实时配置**: 修改配置立即生效
✅ **在线测试**: 无需编写代码即可测试 Skills
✅ **执行监控**: 实时追踪 Skills 执行情况
✅ **搜索筛选**: 快速找到目标 Skill
✅ **启用控制**: 一键启用/禁用 Skills

---

## 📚 相关文档

- `SKILLS_ADMIN_DESIGN.md` - 中台设计方案
- `SKILLS_DESIGN.md` - Skills 架构设计
- `SKILLS_USAGE_GUIDE.md` - Skills 使用指南
- `SKILLS_IMPLEMENTATION_SUMMARY.md` - 实现总结

---

**创建日期**: 2026-02-01
**状态**: ✅ 已完成
**维护者**: PharmCube BI Team
