# AI 探索平台 - 项目现状

## 已完成功能

### 用户系统
- [x] 用户名/密码登录（JWT 认证）
- [x] 获取当前用户信息 `/users/me`
- [x] 管理员批量创建账号 `/users/create-bulk`
- [x] 单个创建账号 `/users/create`
- [x] 用户列表查询 `/users/list`
- [x] 启用/禁用用户 `/users/{id}/toggle`
- [x] 删除用户 `/users/{id}`
- [ ] 修改用户额度（后端有 API `/users/{id}/quota`，前端已移除入口）
- [ ] 密码修改功能

### 额度系统
- [x] 对话额度：每人 200 次（总量，非按天）
- [x] 生图额度：每人 50 张（总量，非按天）
- [x] 每次对话/生图自动扣减额度
- [x] 额度用完后返回 403 错误

### AI 对话
- [x] DeepSeek Flash 模型接入
- [x] 多会话管理（新建/删除/切换）
- [x] 多轮对话（保留最近 10 轮上下文）
- [x] 会话列表按更新时间倒序

### AI 生图
- [x] Seedream 5.0 Lite 模型接入（文生单图，2K 分辨率）
- [x] 图片下载到本地 `data/images/` 目录持久化
- [x] 个人作品列表 `/images/my`
- [x] 额度扣减

### 作品墙（Gallery）
- [x] 公开 Gallery `/images/gallery`
- [x] 管理员审核（公开/取消公开）`/images/{id}/publish` `/images/{id}/unpublish`
- [x] 点赞功能 `/images/like`（每人每图限一次）
- [x] 展示昵称、提示词、生成时间、图片

### 管理后台
- [x] 数据统计仪表盘（用户数/会话数/图片数）
- [x] 批量创建学生账号
- [x] 用户列表查看
- [x] 启用/禁用用户
- [x] 删除用户
- [x] 作品审核（审批公开/取消公开）

### 部署
- [x] Docker Compose 一键部署
- [x] 前端 nginx + 后端 FastAPI 双容器
- [x] 数据持久化（SQLite + 图片文件通过 volume 挂载）
- [x] 图片文件前后端共享挂载（nginx 直接服务静态图片）
- [x] GitHub Actions 自动构建镜像推送 ghcr.io

---

## 已知问题 & 待改进

### 功能缺失
- **管理员创建脚本**：没有预置管理员账号，需要手动在容器中执行 Python 脚本创建
- **用户自己修改密码**：前端没做，后端有预留 API
- **管理员修改用户额度**：前端入口已移除，但后端 API 还在
- **会话搜索**：前端会话列表没有搜索功能
- **满额度提示**：配额用完后前端没有友好的提示，直接报 403

### 技术债务
- **图片 URL**：后端存储的是本地相对路径 `/data/images/xxx.jpeg`，通过 nginx 挂载同一目录来服务，依赖 `docker-compose.yml` 中的 volume 配置
- **密码哈希**：已从 `bcrypt` 切换到 `SHA-256 + salt`（解决 bcrypt 72 字节限制和版本兼容问题）
- **没有 HTTPS**：生产环境需要配置 TLS
- **无 CORS 限制**：`allow_origins=["*"]` 适合内部使用，生产应限制

### 代码问题
- `backend/app/models/schemas.py` 中的 `UserListResponse` 和 `ChatSessionDetail` 可能和实际返回数据不匹配（返回的是 dict 而非模型实例）
- AI 服务层 `ai_service.py` 中没有超时重试逻辑
- 前端部分页面没有 loading 状态（GalleryPage 有，其他页面不完整）
- `tsconfig.json` 中 `noUnusedLocals` 和 `noUnusedParameters` 严格模式可能导致构建失败

---

## 技术栈

| 层 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript |
| 样式 | Tailwind CSS 3 |
| 状态管理 | Zustand |
| HTTP 客户端 | Axios |
| 构建工具 | Vite 5 |
| 后端框架 | Python FastAPI |
| 数据库 | SQLite + SQLAlchemy |
| 认证 | JWT (python-jose) |
| AI 对话 API | DeepSeek Flash API |
| AI 生图 API | Seedream 5.0 Lite (火山引擎) |
| 容器化 | Docker + Docker Compose |
| CI/CD | GitHub Actions (ghcr.io) |

---

## 部署命令

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 API Key

# 2. 启动
docker-compose up -d

# 3. 创建管理员账号
docker exec -it ai-chat-backend bash
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
print('Admin created: admin / admin123')
"
```

## 项目文件结构（49 个文件）

```
ai-chat-platform/
├── .env.example
├── .gitignore
├── docker-compose.yml
├── README.md
├── .github/workflows/docker-build.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py
│       ├── main.py
│       ├── api/
│       │   ├── __init__.py
│       │   ├── users.py      # 用户登录/管理
│       │   ├── chat.py       # 多轮对话
│       │   ├── images.py     # 图片生成/Gallery
│       │   └── admin.py      # 管理后台统计
│       ├── core/
│       │   ├── __init__.py
│       │   ├── config.py     # 配置
│       │   ├── database.py   # 数据库连接
│       │   ├── deps.py       # 依赖注入(认证)
│       │   └── security.py   # 密码哈希/JWT
│       ├── models/
│       │   ├── __init__.py
│       │   ├── models.py     # ORM 模型
│       │   └── schemas.py    # Pydantic 模型
│       ├── services/
│       │   ├── __init__.py
│       │   ├── ai_service.py     # DeepSeek/Seedream API
│       │   └── user_service.py   # 用户 CRUD
│       └── utils/
│           └── __init__.py
└── frontend/
    ├── Dockerfile
    ├── index.html
    ├── nginx.conf
    ├── package.json
    ├── postcss.config.js
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── index.css
        ├── App.tsx
        ├── store/authStore.ts
        ├── services/
        │   ├── api.ts
        │   ├── adminService.ts
        │   ├── chatService.ts
        │   ├── imageService.ts
        │   └── userService.ts
        └── pages/
            ├── LoginPage.tsx
            ├── ChatPage.tsx
            ├── ImagePage.tsx
            ├── GalleryPage.tsx
            └── AdminPage.tsx
```
