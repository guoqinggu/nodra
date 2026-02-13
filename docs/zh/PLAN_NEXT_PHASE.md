# Nodra 下一阶段实施计划

> 目标：实现无代码 MVP（最小可用产品）
> 时间：2-3 个月
> 重点：Desk 前端界面 + API 增强 + 权限完善

---

## 概述

当前 Nodra 后端框架已完成约 70-80%，具备完整的元数据驱动架构。要实现无代码开发，**最紧迫的任务是构建可视化前端界面（Desk）**。

本计划详细描述了从无代码开发角度出发的下一阶段具体任务、优先级和依赖关系。

---

## 阶段目标

### 核心目标

1. **用户可以通过可视化界面创建和管理 DocType**，无需手写 JSON
2. **自动生成列表视图和表单视图**，支持基础的数据操作
3. **完整的权限控制**，确保数据安全
4. **可通过界面完成简单应用开发**，验证无代码开发流程

### 成功标准

- [ ] 用户可以在 5 分钟内通过界面创建一个新的 DocType
- [ ] 自动生成的基础列表和表单可以正常使用
- [ ] 支持字段拖拽、属性配置
- [ ] 支持基础的角色权限配置
- [ ] 端到端测试覆盖主要用户流程

---

## 任务分解

### 模块 A：API 层增强（阶段 15）

**目标**：为 Desk 前端提供完整的 API 支持

**工期**：2 周
**依赖**：无（基于现有 API 扩展）

#### A1. 方法端点（Method Routes）- 3 天

**任务清单**：

- [ ] **A1.1** 设计方法白名单机制
  - 定义白名单注册方式（装饰器/配置）
  - 支持 DocType 控制器方法和全局方法
  - 方法权限注解

- [ ] **A1.2** 实现 `/api/method/{method_path}` 端点
  - 方法路由解析
  - 参数解析与验证
  - 返回值序列化
  - 错误处理

- [ ] **A1.3** 测试覆盖
  - 白名单方法调用测试
  - 非白名单方法拒绝测试
  - 参数验证测试
  - 权限检查测试

**交付物**：
- `src/api/routes/method.ts` - 方法端点路由
- `src/api/method-registry.ts` - 方法注册表
- `tests/unit/api/method.test.ts` - 测试文件

#### A2. API Key 认证 - 3 天

**任务清单**：

- [ ] **A2.1** 设计 API Key 机制
  - API Key 生成算法（安全随机）
  - Key 存储格式（哈希存储）
  - 权限范围设计

- [ ] **A2.2** 实现 API Key 管理
  - 生成 API Key 接口
  - 撤销 API Key 接口
  - 列出用户 API Keys 接口

- [ ] **A2.3** 实现 API Key 认证中间件
  - Header 中提取 API Key
  - Key 验证逻辑
  - 权限检查
  - 与 JWT 认证共存

- [ ] **A2.4** 测试覆盖
  - API Key 生成测试
  - 认证流程测试
  - 权限检查测试
  - 过期处理测试

**交付物**：
- `src/auth/api-key.ts` - API Key 管理
- `src/api/middleware/api-key-auth.ts` - 认证中间件
- `tests/unit/auth/api-key.test.ts` - 测试文件

#### A3. OpenAPI 生成 - 4 天

**任务清单**：

- [ ] **A3.1** 设计 OpenAPI 生成策略
  - 从 DocType 生成 Schema
  - 端点自动生成规则
  - 自定义注解支持

- [ ] **A3.2** 实现 DocType 到 OpenAPI Schema 转换
  - 字段类型映射
  - 验证规则转换
  - 权限信息集成

- [ ] **A3.3** 实现 OpenAPI 文档生成器
  - 生成 OpenAPI 3.0 规范
  - 资源端点文档
  - 方法端点文档
  - 认证方式文档

- [ ] **A3.4** 集成 Swagger UI
  - 提供 `/api/docs` 端点
  - 动态加载生成的规范
  - 支持在线测试

- [ ] **A3.5** 测试覆盖
  - Schema 生成测试
  - 文档结构验证
  - 端点覆盖检查

**交付物**：
- `src/api/openapi/generator.ts` - OpenAPI 生成器
- `src/api/openapi/swagger.ts` - Swagger UI 集成
- `tests/unit/api/openapi.test.ts` - 测试文件

---

### 模块 B：权限系统完善（阶段 16）

**目标**：实现细粒度权限控制，支持 Desk 前端的权限管理

**工期**：2 周
**依赖**：模块 A（部分 API 需要权限支持）

#### B1. 字段级权限 - 4 天

**任务清单**：

- [ ] **B1.1** 设计字段级权限模型
  - 扩展 DocPerm 定义
  - 字段权限数据结构
  - 权限级别（permlevel）实现

- [ ] **B1.2** 实现字段权限检查
  - 读取权限检查
  - 写入权限检查
  - 批量字段权限检查

- [ ] **B1.3** 集成到 API 层
  - 响应字段过滤中间件
  - 更新字段验证中间件
  - 错误信息处理

- [ ] **B1.4** 测试覆盖
  - 字段可见性测试
  - 字段编辑权限测试
  - API 响应过滤测试

**交付物**：
- `src/permissions/field-permission.ts` - 字段权限模块
- 更新 `src/api/middleware/permissions.ts`
- `tests/unit/permissions/field-permission.test.ts`

#### B2. 行级权限（User Permission）- 4 天

**任务清单**：

- [ ] **B2.1** 实现 User Permission 检查
  - 基于条件的过滤
  - Link 字段值限制
  - 多条件组合

- [ ] **B2.2** 集成到查询构建器
  - 自动添加权限过滤条件
  - 查询优化（避免 N+1）
  - 缓存权限规则

- [ ] **B2.3** 实现 User Permission 管理 API
  - 创建/更新/删除接口
  - 批量配置接口
  - 权限验证接口

- [ ] **B2.4** 测试覆盖
  - 行级过滤测试
  - Link 字段限制测试
  - 查询性能测试

**交付物**：
- `src/permissions/row-permission.ts` - 行级权限模块
- 更新 `src/orm/crud.ts` 集成权限检查
- `tests/unit/permissions/row-permission.test.ts`

#### B3. 权限中间件完善 - 2 天

**任务清单**：

- [ ] **B3.1** 统一权限中间件
  - 整合 DocType/字段/行级权限
  - 权限缓存策略
  - 权限审计日志

- [ ] **B3.2** 角色层次结构
  - 角色继承机制
  - 权限合并规则
  - 默认角色设置

- [ ] **B3.3** 测试覆盖
  - 综合权限场景测试
  - 角色继承测试
  - 性能测试

**交付物**：
- `src/permissions/middleware.ts` - 统一权限中间件
- `tests/unit/permissions/integration.test.ts`

---

### 模块 C：Desk 前端框架（阶段 17.1）

**目标**：搭建 Desk 前端基础框架

**工期**：2 周
**依赖**：模块 A（需要完整的 API 支持）

#### C1. 技术选型与项目初始化 - 2 天

**决策清单**：

- [ ] **C1.1** 前端框架选型
  - React 18 + TypeScript（推荐）
  - 或 Vue 3 + TypeScript
  - 评估：团队熟悉度、生态、性能

- [ ] **C1.2** UI 组件库选型
  - Ant Design（推荐，企业级）
  - 或 Element Plus
  - 或自研组件库（工作量大）

- [ ] **C1.3** 状态管理选型
  - Zustand（推荐，轻量）
  - 或 Redux Toolkit
  - 或 Jotai

- [ ] **C1.4** 其他工具
  - 路由：React Router v6
  - 请求：TanStack Query (React Query)
  - 表单：React Hook Form + Zod
  - 构建：Vite

**交付物**：
- `desk/` 目录（前端项目）
- `desk/package.json`
- `desk/vite.config.ts`
- `desk/tsconfig.json`

#### C2. 基础架构搭建 - 3 天

**任务清单**：

- [ ] **C2.1** 项目结构搭建
```
desk/
├── src/
│   ├── components/       # 通用组件
│   ├── pages/           # 页面组件
│   ├── hooks/           # 自定义 Hooks
│   ├── stores/          # 状态管理
│   ├── api/             # API 客户端
│   ├── types/           # TypeScript 类型
│   ├── utils/           # 工具函数
│   ├── styles/          # 全局样式
│   └── App.tsx
├── public/
├── index.html
└── package.json
```

- [ ] **C2.2** API 客户端封装
  - 基于 fetch/axios 的封装
  - 自动认证（JWT/API Key）
  - 错误处理
  - 请求/响应拦截器

- [ ] **C2.3** 状态管理实现
  - 用户状态（登录信息、权限）
  - 全局配置状态
  - 缓存策略

- [ ] **C2.4** 路由配置
  - 基础路由结构
  - 权限路由守卫
  - 动态路由（DocType 路由）

- [ ] **C2.5** 布局组件
  - 侧边栏导航
  - 顶部工具栏
  - 内容区域
  - 响应式布局

**交付物**：
- `desk/src/api/client.ts`
- `desk/src/stores/`
- `desk/src/components/layout/`
- `desk/src/App.tsx`

#### C3. 主题与样式系统 - 3 天

**任务清单**：

- [ ] **C3.1** 设计系统定义
  - 颜色系统（主色、功能色、中性色）
  - 字体系统
  - 间距系统
  - 圆角/阴影

- [ ] **C3.2** 主题配置
  - 亮色/暗色主题
  - 主题切换机制
  - CSS 变量定义

- [ ] **C3.3** 全局样式
  - 重置样式
  - 基础样式
  - 工具类

- [ ] **C3.4** 通用组件封装
  - 按钮封装
  - 表单组件封装
  - 表格封装
  - 弹窗/抽屉封装

**交付物**：
- `desk/src/styles/theme.css`
- `desk/src/styles/global.css`
- `desk/src/components/ui/`

#### C4. 与后端集成 - 2 天

**任务清单**：

- [ ] **C4.1** 开发环境配置
  - 代理配置（解决跨域）
  - 环境变量配置
  - 开发脚本

- [ ] **C4.2** 登录页面
  - 登录表单
  - 认证流程
  - Token 存储

- [ ] **C4.3** 首页/仪表盘框架
  - 欢迎页面
  - 导航菜单（从后端获取）
  - 快捷入口

- [ ] **C4.4** 构建配置
  - 生产构建
  - 静态文件输出
  - 与后端集成部署

**交付物**：
- `desk/src/pages/Login.tsx`
- `desk/src/pages/Dashboard.tsx`
- `desk/.env.development`

---

### 模块 D：DocType 设计器（阶段 17.2）

**目标**：实现可视化 DocType 设计器

**工期**：3 周
**依赖**：模块 C（Desk 基础框架）

#### D1. 设计器架构 - 2 天

**任务清单**：

- [ ] **D1.1** 设计器状态管理
  - 当前编辑的 DocType 状态
  - 字段列表状态
  - 历史记录（撤销/重做）

- [ ] **D1.2** 组件拆分
  - 设计器容器
  - 字段面板
  - 属性面板
  - 预览面板
  - 工具栏

- [ ] **D1.3** 数据流设计
  - 与后端 API 的交互
  - 自动保存机制
  - 验证反馈

**交付物**：
- `desk/src/stores/doctype-designer.ts`
- 设计器组件目录结构

#### D2. 字段管理 - 4 天

**任务清单**：

- [ ] **D2.1** 字段类型选择器
  - 所有字段类型列表
  - 字段类型图标
  - 字段类型说明

- [ ] **D2.2** 字段拖拽添加
  - 从字段面板拖拽
  - 拖拽排序
  - 拖拽删除

- [ ] **D2.3** 字段列表展示
  - 字段卡片/行展示
  - 字段基本信息显示
  - 选中状态

- [ ] **D2.4** 字段操作
  - 添加字段
  - 删除字段
  - 复制字段
  - 排序字段

**交付物**：
- `desk/src/components/doctype-designer/FieldPalette.tsx`
- `desk/src/components/doctype-designer/FieldList.tsx`
- `desk/src/components/doctype-designer/FieldItem.tsx`

#### D3. 属性面板 - 4 天

**任务清单**：

- [ ] **D3.1** 基础属性编辑
  - 字段名称（fieldname）
  - 标签（label）
  - 字段类型（fieldtype）
  - 必填（reqd）
  - 默认值（default）

- [ ] **D3.2** 高级属性编辑
  - 选项（options）- Select/Link 类型
  - 验证规则（validate）
  - 依赖字段（depends_on）
  - 隐藏规则（hidden）

- [ ] **D3.3** 属性表单组件
  - 根据字段类型动态显示属性
  - 属性验证
  - 属性联动（如 Link 类型显示 Options）

- [ ] **D3.4** DocType 级别属性
  - 名称
  - 模块
  - 命名规则
  - 是否可提交
  - 是否子表

**交付物**：
- `desk/src/components/doctype-designer/PropertyPanel.tsx`
- `desk/src/components/doctype-designer/FieldPropertyForm.tsx`

#### D4. 实时预览 - 3 天

**任务清单**：

- [ ] **D4.1** 表单预览
  - 根据字段定义渲染表单
  - 字段组件映射
  - 实时更新

- [ ] **D4.2** 列表预览
  - 列表布局预览
  - 列显示

- [ ] **D4.3** 预览数据
  - 示例数据生成
  - 预览模式切换

**交付物**：
- `desk/src/components/doctype-designer/PreviewPanel.tsx`
- `desk/src/components/preview/FormPreview.tsx`
- `desk/src/components/preview/ListPreview.tsx`

#### D5. 权限配置界面 - 3 天

**任务清单**：

- [ ] **D5.1** 权限规则列表
  - 显示现有权限规则
  - 角色选择
  - 权限开关（读/写/创建/删除）

- [ ] **D5.2** 权限规则编辑
  - 添加新规则
  - 编辑规则
  - 删除规则
  - 条件配置（if_owner）

- [ ] **D5.3** 权限预览
  - 模拟不同角色权限
  - 权限冲突提示

**交付物**：
- `desk/src/components/doctype-designer/PermissionPanel.tsx`
- `desk/src/components/permission/PermissionRuleForm.tsx`

#### D6. 保存与验证 - 2 天

**任务清单**：

- [ ] **D6.1** 表单验证
  - 字段名称唯一性
  - 必填项检查
  - 命名规则验证

- [ ] **D6.2** 保存逻辑
  - 自动保存
  - 手动保存
  - 保存提示

- [ ] **D6.3** 错误处理
  - 验证错误显示
  - 后端错误处理
  - 冲突解决

**交付物**：
- 更新 `desk/src/stores/doctype-designer.ts`
- 保存和验证逻辑

---

### 模块 E：列表视图（阶段 17.3）

**目标**：实现自动生成的列表视图

**工期**：2 周
**依赖**：模块 D（需要 DocType 定义）

#### E1. 列表页面框架 - 2 天

**任务清单**：

- [ ] **E1.1** 列表页面路由
  - 动态路由 `/list/:doctype`
  - 路由参数解析
  - 无效 DocType 处理

- [ ] **E1.2** 列表页面布局
  - 页面标题
  - 操作栏（新建、刷新、导出）
  - 过滤器区域
  - 表格区域
  - 分页区域

- [ ] **E1.3** 数据获取
  - 调用 `/api/resource/:doctype` API
  - 分页处理
  - 加载状态

**交付物**：
- `desk/src/pages/ListView.tsx`
- `desk/src/hooks/useListData.ts`

#### E2. 表格组件 - 3 天

**任务清单**：

- [ ] **E2.1** 基础表格
  - 列渲染
  - 行渲染
  - 空状态
  - 加载状态

- [ ] **E2.2** 列配置
  - 从 DocType 获取列定义
  - 列宽调整
  - 列排序
  - 列显示/隐藏

- [ ] **E2.3** 行操作
  - 查看详情
  - 编辑
  - 删除
  - 批量选择

- [ ] **E2.4** 数据格式化
  - 日期格式化
  - 数值格式化
  - Link 字段显示
  - Check 字段显示

**交付物**：
- `desk/src/components/list/ListTable.tsx`
- `desk/src/components/list/TableColumn.tsx`
- `desk/src/components/list/TableRow.tsx`

#### E3. 过滤器 - 3 天

**任务清单**：

- [ ] **E3.1** 过滤器 UI
  - 过滤器按钮
  - 过滤器面板
  - 已选过滤器展示

- [ ] **E3.2** 过滤器组件
  - 文本过滤
  - 日期范围过滤
  - 选择过滤（Select）
  - Link 字段搜索过滤
  - 数字范围过滤

- [ ] **E3.3** 过滤器逻辑
  - 过滤器组合
  - 过滤器应用
  - 过滤器重置
  - 保存的过滤器

**交付物**：
- `desk/src/components/list/FilterPanel.tsx`
- `desk/src/components/list/filters/`

#### E4. 分页与排序 - 2 天

**任务清单**：

- [ ] **E4.1** 分页组件
  - 页码显示
  - 每页条数选择
  - 上一页/下一页
  - 跳转到指定页

- [ ] **E4.2** 排序功能
  - 列头点击排序
  - 多列排序
  - 排序指示器

**交付物**：
- `desk/src/components/list/Pagination.tsx`
- `desk/src/components/list/TableHeader.tsx`

#### E5. 批量操作 - 2 天

**任务清单**：

- [ ] **E5.1** 批量选择
  - 全选
  - 单选
  - 已选计数

- [ ] **E5.2** 批量操作
  - 批量删除
  - 批量导出
  - 批量修改（可选）

**交付物**：
- `desk/src/components/list/BulkActions.tsx`

---

### 模块 F：表单视图（阶段 17.4）

**目标**：实现自动生成的表单视图

**工期**：2 周
**依赖**：模块 E（列表视图可导航到表单）

#### F1. 表单页面框架 - 2 天

**任务清单**：

- [ ] **F1.1** 表单页面路由
  - 新建 `/form/:doctype/new`
  - 编辑 `/form/:doctype/:name`
  - 路由参数解析

- [ ] **F1.2** 表单页面布局
  - 页面标题（动态）
  - 操作栏（保存、提交、取消、删除）
  - 表单区域
  - 侧边栏（信息、历史）

- [ ] **F1.3** 数据获取
  - 新建：获取默认值
  - 编辑：获取文档数据
  - 加载状态

**交付物**：
- `desk/src/pages/FormView.tsx`
- `desk/src/hooks/useFormData.ts`

#### F2. 表单渲染引擎 - 4 天

**任务清单**：

- [ ] **F2.1** 字段组件映射
  - Data -> Input
  - Text -> Textarea
  - Int/Float -> Number Input
  - Date -> DatePicker
  - Select -> Select
  - Link -> Search Select
  - Check -> Checkbox
  - Table -> SubTable
  - Attach -> Upload

- [ ] **F2.2** 表单布局
  - 字段顺序渲染
  - 分组（Section）
  - 列布局（2列/3列）
  - 标签位置

- [ ] **F2.3** 字段联动
  - 显示/隐藏（depends_on）
  - 只读控制
  - 默认值设置
  - 选项动态加载

- [ ] **F2.4** 子表（Table）
  - 子表渲染
  - 行添加/删除
  - 行内编辑
  - 子表排序

**交付物**：
- `desk/src/components/form/FormRenderer.tsx`
- `desk/src/components/form/fields/`（字段组件目录）
- `desk/src/components/form/SubTable.tsx`

#### F3. 表单验证 - 2 天

**任务清单**：

- [ ] **F3.1** 客户端验证
  - 必填验证
  - 类型验证
  - 格式验证
  - 自定义验证规则

- [ ] **F3.2** 验证提示
  - 字段级错误提示
  - 表单级错误提示
  - 实时验证
  - 提交前验证

- [ ] **F3.3** 服务端验证
  - 提交后验证错误处理
  - 错误字段高亮

**交付物**：
- `desk/src/utils/validation.ts`
- 更新字段组件支持错误状态

#### F4. 表单操作 - 2 天

**任务清单**：

- [ ] **F4.1** 保存操作
  - 新建保存（POST）
  - 编辑保存（PUT）
  - 保存提示
  - 保存后跳转

- [ ] **F4.2** 其他操作
  - 提交（Submit）
  - 取消（Cancel）
  - 删除（Delete）
  - 刷新（Reload）

- [ ] **F4.3** 操作权限
  - 根据权限显示/隐藏操作
  - 操作确认对话框

**交付物**：
- `desk/src/components/form/FormActions.tsx`
- `desk/src/hooks/useFormActions.ts`

#### F5. 表单状态管理 - 2 天

**任务清单**：

- [ ] **F5.1** 表单状态
  - 表单数据状态
  - 脏检查（是否有修改）
  - 初始值记录

- [ ] **F5.2** 自动保存（可选）
  - 定时自动保存草稿
  - 离开页面提示

- [ ] **F5.3** 版本历史（可选）
  - 显示修改历史
  - 版本对比

**交付物**：
- `desk/src/stores/form.ts`

---

## 依赖关系图

```
模块 A：API 增强
    │
    ├──> 模块 B：权限完善
    │
    └──> 模块 C：Desk 框架
              │
              ├──> 模块 D：DocType 设计器
              │         │
              │         └──> 模块 E：列表视图
              │                   │
              │                   └──> 模块 F：表单视图
              │
              └──> 模块 E/F：列表/表单视图（并行）
```

---

## 时间线

### 第 1-2 周：后端增强

| 天数 | 模块 | 任务 |
|------|------|------|
| 1-3 | A1 | 方法端点 |
| 4-6 | A2 | API Key 认证 |
| 7-10 | A3 | OpenAPI 生成 |
| 11-14 | B1 | 字段级权限 |

### 第 3-4 周：权限完善 + Desk 启动

| 天数 | 模块 | 任务 |
|------|------|------|
| 15-18 | B2 | 行级权限 |
| 19-20 | B3 | 权限中间件 |
| 21-22 | C1 | 技术选型 |
| 23-28 | C2 | 基础架构 |

### 第 5-6 周：Desk 基础

| 天数 | 模块 | 任务 |
|------|------|------|
| 29-31 | C3 | 主题样式 |
| 32-35 | C4 | 后端集成 |
| 36-42 | D1-D2 | 设计器架构 + 字段管理 |

### 第 7-8 周：DocType 设计器

| 天数 | 模块 | 任务 |
|------|------|------|
| 43-46 | D3 | 属性面板 |
| 47-49 | D4 | 实时预览 |
| 50-52 | D5 | 权限配置 |
| 53-54 | D6 | 保存与验证 |

### 第 9-10 周：列表视图

| 天数 | 模块 | 任务 |
|------|------|------|
| 55-56 | E1 | 列表框架 |
| 57-59 | E2 | 表格组件 |
| 60-62 | E3 | 过滤器 |
| 63-64 | E4 | 分页排序 |
| 65-66 | E5 | 批量操作 |

### 第 11-12 周：表单视图

| 天数 | 模块 | 任务 |
|------|------|------|
| 67-68 | F1 | 表单框架 |
| 69-72 | F2 | 表单渲染 |
| 73-74 | F3 | 表单验证 |
| 75-76 | F4 | 表单操作 |
| 77-78 | F5 | 状态管理 |

---

## 风险与应对

### 风险 1：前端工作量大

**风险**：Desk 前端开发工作量超出预期，影响整体进度。

**应对**：
- 使用成熟的 UI 组件库（Ant Design），减少自研组件
- 优先实现核心功能，高级功能延后
- 考虑分阶段交付，先完成基础功能

### 风险 2：前后端联调问题

**风险**：API 设计不符合前端需求，导致返工。

**应对**：
- 在开发前进行 API 设计评审
- 使用 OpenAPI 规范提前定义接口
- 保持前后端密切沟通

### 风险 3：性能问题

**风险**：前端渲染大量数据时出现性能问题。

**应对**：
- 使用虚拟滚动（React Virtual）
- 分页加载数据
- 字段级权限缓存

### 风险 4：权限复杂性

**风险**：权限规则复杂，实现难度大。

**应对**：
- 先实现基础权限，逐步完善
- 充分测试边界情况
- 参考 Frappe 的实现方式

---

## 验收标准

### 功能验收

- [ ] 用户可以通过界面创建 DocType
- [ ] 可以添加、删除、排序字段
- [ ] 可以配置字段属性
- [ ] 可以配置权限规则
- [ ] 自动生成列表视图，支持分页、排序、过滤
- [ ] 自动生成表单视图，支持所有字段类型
- [ ] 表单支持验证和保存
- [ ] 权限控制正常工作

### 性能验收

- [ ] 列表页加载 < 2 秒（1000 条数据）
- [ ] 表单页加载 < 1 秒
- [ ] DocType 设计器响应流畅
- [ ] 前端包大小 < 500KB（gzipped）

### 质量验收

- [ ] 单元测试覆盖率 > 80%
- [ ] 端到端测试覆盖主要流程
- [ ] 无严重 Bug
- [ ] 代码审查通过

---

## 下一步行动

1. **评审本计划**：团队讨论并确认计划
2. **技术选型确认**：确定前端技术栈
3. **创建任务**：将计划分解为具体的开发任务
4. **启动开发**：按照模块顺序开始开发
5. **定期检查**：每周检查进度，调整计划

---

*本计划基于当前代码状态分析制定，实际执行中可能需要根据具体情况调整。*
