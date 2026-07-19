# AI 探索平台 - 需求文档

## 项目背景

面向初中生的 AI 体验平台，提供 DeepSeek Flash 对话模型和 Seedream 5.0 Lite 生图模型。

---

## P0 - 必须完成

### 1. 图片放大查看
- **范围**：Gallery 作品墙、ImagePage"我的作品"、AdminPage 作品审核
- **方案**：引入轻量级图片查看库（如 react-viewer 或自定义模态框）
- **要求**：支持点击放大、优雅过渡动画、ESC 关闭

### 2. 图片列表优化
- **范围**：Gallery、ImagePage、AdminPage
- **方案**：改为网格卡片布局（responsive grid），缩小单张图片尺寸
- **要求**：优美 hover 效果、卡片阴影、过渡动画、瀑布流或等宽网格

### 3. 点赞取消功能
- **后端**：`/images/like` 改为 toggle 模式，返回当前状态和点赞数
- **前端**：已点赞显示红心 ❤️，未点赞显示空心 🤍，点击切换

### 4. 批量审核
- **范围**：AdminPage 作品审核
- **功能**：复选框多选、全选/反选、批量公开、批量取消公开
- **交互**：顶部操作栏，选中后显示操作按钮

### 5. Token 统计
- **后端**：`ChatMessage` 表新增 `tokens_used` 字段，从 DeepSeek API `usage` 提取
- **前端**：AdminPage 用户列表增加 Token 消耗列，显示累计消耗

### 6. System Prompt 助手
- **预置助手**：通用助手、编程导师、创意写作、学习辅导（由开发者预置）
- **管理后台**：管理员可增删改助手（名称、描述、system prompt）
- **用户自定义**：用户可创建自己的助手，保存到账号下
- **对话配置**：新建对话时弹出"编辑系统提示词"面板，显示输入框 + 预置助手按钮 + 自定义按钮
- **存储**：`ChatSession` 表新增 `system_prompt` 字段

### 7. 会话命名
- **AI 生成**：用户发送第一条消息后，后台异步调用 AI 生成简短标题
- **用户编辑**：会话列表支持 inline 编辑标题
- **失败处理**：AI 生成失败保留默认"新会话"

### 8. Markdown 渲染
- **范围**：ChatPage AI 回复内容
- **功能**：支持代码高亮（highlight.js/prismjs）、数学公式（KaTeX）
- **样式**：与当前 UI 风格保持一致，代码块深色背景

### 9. 联网搜索
- **功能**：对话界面增加"联网搜索"开关
- **实现**：使用 Python `duckduckgo-search` 库，无需 API Key
- **逻辑**：开启后，用户消息先搜索，搜索结果拼入 prompt 再调用 AI
- **展示**：搜索结果不展示引用来源，仅作为 AI 上下文

### 10. 生图修复
- **Prompt 截断**：限制 300 汉字或 500 英文，超出时截断并提示用户
- **Loading 动画**：生图过程中显示优雅 loading 状态
- **错误处理**：修复 422 错误和白屏问题，API 返回非预期格式时优雅降级

### 11. 排序功能
- **范围**：Gallery 和 AdminPage 作品列表
- **维度**：最新发布（默认）、最多点赞、最早发布
- **交互**：顶部下拉选择框

### 12. 数据统计增强
- **新增指标**：总点赞数、额度耗尽用户数、待审核作品数
- **展示**：扩展 AdminPage 统计卡片
- **计算**：实时计算，无需缓存

### 13. UI 美化
- **范围**：全站前端界面
- **方向**：配色优化、间距调整、卡片阴影、过渡动画、字体层次、按钮样式
- **要求**：现代、简洁、有设计感，避免"AI 味"模板感

---

## P2 - 低优先级

### 14. 深色/浅色模式
- 跟随系统偏好或用户手动切换
- 使用 Tailwind `dark:` 前缀实现
- 待 P0 全部完成后再考虑

---

## 技术决策

### 图片查看库
- 待调研：react-viewer、yet-another-react-lightbox、或自定义实现

### Markdown 渲染栈
- `react-markdown` + `remark-gfm` + `rehype-highlight` + `rehype-katex`

### 联网搜索
- Python 库：`duckduckgo-search`
- 每次搜索取前 3-5 条结果拼入 prompt

### 数据库变更
- `ChatMessage` 表：`tokens_used` (Integer, nullable)
- `ChatSession` 表：`system_prompt` (Text, nullable)
- 新增 `SystemPrompt` 表：id, name, description, prompt, is_builtin, user_id, is_active, created_at

---

## 实现顺序建议

1. 生图修复（Bug 修复，影响体验）
2. UI 美化（基础工作，影响所有页面）
3. 图片列表优化 + 放大查看（关联性强）
4. 点赞取消 + 排序（关联性强）
5. Markdown 渲染（独立功能）
6. 会话命名（独立功能）
7. System Prompt 助手（涉及前后端 + 数据库）
8. 联网搜索（独立功能）
9. Token 统计（涉及数据库变更）
10. 批量审核 + 数据统计增强（AdminPage 功能）
11. 深色模式（P2）
