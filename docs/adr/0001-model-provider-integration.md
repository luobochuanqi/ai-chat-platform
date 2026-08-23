# 模型接入采用 LiteLLM SDK 嵌入,生图保留 OpenAI 兼容直连

平台需要支持管理员在线配置多个模型提供商(多 Key、模型池、按模型计价)。对比 LiteLLM Proxy、one-api、new-api 与自研薄层后,决定对话层嵌入 LiteLLM Python SDK:配置由自有 SQLite 驱动(Router 每请求传参),tools 透传与现有 skill_runner 循环同构,零新增容器与数据库。生图不走 LiteLLM(其 image_generation 不含 Seedream):统一抽象为 OpenAI 兼容 `images/generations` 端点,Seedream(火山方舟)作为种子 Provider 保留直连。

考虑过的备选:

- **new-api**(AGPL-3.0):自带中文管理后台,但自带用户/额度体系与自有 User 表重叠,多一个 Go 容器;留作未来演进方向
- **one-api**:渠道覆盖广,但近 18 个月无 release,维护停滞,不用于新接入
- **LiteLLM Proxy 网关**:管理功能(Admin UI/虚拟 Key/预算)强制依赖 Postgres,破坏 SQLite 单机形态
- **Portkey Gateway**:TS 网关,无自托管管理后台、无生图,排除
