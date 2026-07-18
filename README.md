# AI 探索平台

一个面向初中生的 AI 对话与图像生成体验平台，支持 DeepSeek Flash 语言模型和 Seedream 5.0 Lite 图像生成模型。

## 功能特性

- **AI 对话**：基于 DeepSeek Flash 模型的多轮对话，支持多会话管理
- **AI 生图**：基于 Seedream 5.0 Lite 模型的图像生成
- **作品墙**：学生生成的图片经管理员审核后可公开展示，支持点赞
- **用户管理**：管理员可批量创建账号、管理额度
- **额度系统**：对话和生图分别设置额度限制

## 技术栈

- **后端**：Python FastAPI + SQLAlchemy + SQLite
- **前端**：React + TypeScript + Tailwind CSS
- **部署**：Docker + Docker Compose + GitHub Actions

## 快速部署

### 1. 克隆仓库

```bash
git clone <your-repo-url>
cd ai-chat-platform
```

### 2. 配置环境变量

创建 `.env` 文件：

```env
SECRET_KEY=your-secret-key-here
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_API_BASE=https://api.deepseek.com/v1
SEEDREAM_API_KEY=your-seedream-api-key
SEEDREAM_API_BASE=your-seedream-api-base
```

### 3. 启动服务

```bash
docker-compose up -d
```

服务将在以下地址运行：
- 前端：http://localhost
- 后端 API：http://localhost:8000
- API 文档：http://localhost:8000/docs

### 4. 创建管理员账号

首次启动后，需要手动创建管理员账号：

```bash
# 进入后端容器
docker exec -it ai-chat-backend bash

# 运行创建管理员脚本
python -c "
from app.core.database import SessionLocal
from app.models.models import User
from app.core.security import get_password_hash

db = SessionLocal()
admin = User(
    username='admin',
    nickname='管理员',
    hashed_password=get_password_hash('admin123'),
    is_admin=True,
    chat_quota=999999,
    image_quota=999999
)
db.add(admin)
db.commit()
print('Admin created successfully')
"
```

## 使用指南

### 管理员操作

1. **登录**：使用管理员账号登录
2. **批量创建学生账号**：进入管理后台 -> 用户管理 -> 批量创建账号
3. **审核作品**：进入管理后台 -> 作品审核 -> 选择公开/取消公开
4. **监控额度**：在用户列表中查看和修改学生额度

### 学生操作

1. **登录**：使用管理员分配的账号密码登录
2. **AI 对话**：点击"AI 对话"开始与 DeepSeek 模型聊天
3. **AI 生图**：点击"AI 生图"输入描述生成图片
4. **查看作品墙**：点击"作品墙"欣赏同学们的公开作品

## 额度说明

- 默认对话额度：200 次/人
- 默认生图额度：50 张/人
- 额度用完后需联系管理员追加

## 开发

### 本地开发后端

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 本地开发前端

```bash
cd frontend
npm install
npm run dev
```

## GitHub Actions 自动构建

项目已配置 GitHub Actions，推送代码到 main 分支或打 tag 时会自动构建并推送镜像到 GitHub Container Registry。

## 目录结构

```
ai-chat-platform/
├── backend/              # FastAPI 后端
│   ├── app/
│   │   ├── api/          # API 路由
│   │   ├── models/       # 数据库模型
│   │   ├── services/     # 业务逻辑
│   │   ├── core/         # 配置、安全
│   │   └── main.py       # 入口
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/             # React 前端
│   ├── src/
│   │   ├── pages/        # 页面组件
│   │   ├── services/     # API 请求
│   │   └── store/        # 状态管理
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── .github/workflows/    # CI/CD 配置
```

## 许可证

MIT
