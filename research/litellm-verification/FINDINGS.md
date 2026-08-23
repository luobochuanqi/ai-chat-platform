# LiteLLM 集成事实验证(issue #8 验证票 #11)

- 验证日期:2026-08-23
- litellm 版本:**1.98.0**(pip 最新版,官方 PyPI 源安装)
- Python:3.13,虚拟环境 `backend/.venv`(gitignored)
- 可复现脚本:`mock_server.py`(本地 OpenAI 兼容 mock,127.0.0.1:8399)+ `run_checks.py`
  - 启动:`backend/.venv/Scripts/python.exe research/litellm-verification/mock_server.py`
  - 运行:`backend/.venv/Scripts/python.exe research/litellm-verification/run_checks.py`
- 现有代码参照:`backend/app/services/skill_runner.py`(工具循环)、`backend/app/services/ai_service.py`(httpx 直连 DeepSeek)

---

## 1. tools 透传与响应结构 —— 结论:**同构,可直接替换**

**验证方式:mock 实测**(run_checks.py check1)。

事实:

| 项目 | 实测结果 |
|---|---|
| 返回类型 | `litellm.ModelResponse`(openai SDK 的 pydantic 模型子类) |
| `resp.choices[0].message.tool_calls[0].function.name` | ✅ `"get_weather"` |
| `.function.arguments` | ✅ JSON 字符串(`{"city": "北京"}`),与 OpenAI 协议一致 |
| `tool_call.id` / `.type` | ✅ 原样透传 mock 返回值 |
| 字典式访问 `resp["choices"][0]["message"]...` | ✅ **可用**(ModelResponse 支持 `__getitem__`) |
| `resp.get("usage")` | ✅ **可用** |
| `resp.model_dump()` | ✅ 可用,可转成纯 dict |

对 skill_runner.py 现有解析逻辑的逐字段核对结论:

- `response["choices"][0]["message"].get("tool_calls")` → litellm 对象上**同样成立**,但注意:无 tool_calls 时属性是 `None`,`.get("tool_calls")` 在 dict 式访问下也返回 None,现有判断 `if not tool_calls` 兼容。
- role="tool" 回喂:实测第二轮把 assistant 消息用 `msg.model_dump()` 转回 dict、追加 `{"role":"tool","tool_call_id":...,"content":...}` 后,mock 正常收到并返回最终文本。**注意**:assistant 消息必须先 `model_dump()`(或保持 litellm 返回的对象,litellm 序列化时也能处理;稳妥做法是统一转 dict)。
- `usage.total_tokens`:✅ 同构可用,且支持 `.get()` 链式访问(skill_runner 第 42/53 行写法无需改动即可工作)。

**对 #12 对话层改造的影响**:`ai_service.chat_with_deepseek` 可以改为内部调用 `litellm.acompletion(model="deepseek/deepseek-chat", api_key=..., ...)`,返回对象直接兼容现有 dict 访问代码;最干净的方案是在边界处 `model_dump()` 一次,保持 skill_runner 零改动。tools/tool_choice 参数原样透传。

## 2. Router 多 Key 轮换/重试 —— 结论:**自动换部署重试,行为已证实**

**验证方式:mock 实测**(第一个 key 固定返回 429,第二个 key 返回 200;通过 mock 的 `/_log` 观察实际收到的 key 序列)。

实测参数与行为:

```python
router = Router(
    model_list=[
        {"model_name": "gpt-mock", "litellm_params": {"model": "openai/gpt-mock", "api_base": ..., "api_key": "sk-bad-key"}},
        {"model_name": "gpt-mock", "litellm_params": {"model": "openai/gpt-mock", "api_base": ..., "api_key": "sk-good-2"}},
    ],
    num_retries=2,      # 单次请求内最大重试次数
    retry_after=1,      # 重试间隔秒数
    cooldown_time=5,    # 失败部署冷却时间(秒)
)
await router.acompletion(model="gpt-mock", messages=...)
```

- 连续 4 次调用,key 到达序列均为 `['ey'(bad), '-2'(good)]` — **同一 model_name 下多个部署,首个失败后自动切换到下一个部署重试,最终成功返回**。
- 首次调用耗时 ~2.85s(含指数退避等待),后续调用 ~0.01–0.02s(429 带 retry-after 头时退避很快让位)。
- 关键参数名:`num_retries`、`retry_after`、`cooldown_time`、`fallbacks=[{"模型名": ["备选模型名"]}]`;Router 还支持 `routing_strategy`(默认 simple-shuffle,随机选部署——本票第一次实测就出现过直接命中好 key 的情况,**说明默认策略不保证顺序,故障切换是"失败后才换"而非轮询**)。
- 重试发生在单次请求内(async 串行退避,非并发轰炸);`acompletion` 即自带重试。
- 另观察到无害告警:model 不在 litellm 内置成本表时会打 WARNING(cost 默认 0),生产日志需过滤或配置 model_info。

**对设计票的影响**:多 key 池可直接用 Router 实现,不必自研;但要注意 Router 的重试会**放大请求数**(一次用户消息可能产生多次上游计费请求),扣减引擎(#13)应按"最终成功响应的 usage"计费,而不是按尝试次数。

## 3. usage 可靠性 —— 结论:**缺失时返回全 0 Usage 对象,不抛错、不为 None**

**验证方式:mock 实测**(mock 以 `MOCK_FAIL_USAGE=1` 启动,完全省略 usage 字段后实测)。

- mock 完全省略 usage 时,litellm **不抛错、usage 不为 None**,而是返回一个**全 0 的 `Usage` 对象**:
  `Usage(completion_tokens=0, prompt_tokens=0, total_tokens=0, ...)`。
  (litellm 不做本地估算兜底;早前观察到的"估算值"实为 mock 自己计算的 usage,已排除。)
- `skill_runner` 式 `response.get("usage", {}).get("total_tokens", 0)` 在该对象上照常工作,得 0 —— 与现有 httpx 直连时 usage 缺失的行为完全一致。

**对 #13 扣减引擎的影响**:usage 缺失时 litellm 静默给 0,与现有 httpx 直连行为一致(不抛错);但"全 0"意味着**扣减引擎必须处理 0 值**(视为异常/告警而非正常计费),不能默认 usage 一定可信。DeepSeek 正常返回 usage,litellm 会原样透传,主路径风险低。

## 4. 依赖体积 —— 结论:**~111 MB + 冷启动 ~18s,偏重但无 torch/transformers**

**验证方式:实测**(pip 安装后 du / 计时)。

- site-packages 总体积:230 MB,其中 **litellm 自身 111 MB**(内嵌大量 provider spec JSON)。
- import litellm 冷启动:**17.8–20.2 s**(Windows,i7-14650HX);进程内首次调用另有模型注册开销。**这是最大的集成代价**。
- 重量级依赖清单(明确列出):**无 torch、无 transformers**。拖入的有:botocore(25 MB,AWS Bedrock 支持)、openai SDK(19 MB)、tokenizers+hf_xet+huggingface_hub(~24 MB,Rust wheel)、tiktoken、aiohttp、pydantic v2。全部为纯 Python/Rust wheel,无 GPU 编译依赖。
- FastAPI 后端已有 httpx/pydantic,新增冲突面小;但 openai SDK 版本(litellm 锁定范围)需与项目其他直接依赖核对。

**对设计票的影响**:import 18s 若发生在请求路径不可接受——必须在应用启动时导入(lifespan),不能懒加载到首条消息。

## 5. DeepSeek 支持 —— 结论:**一等 provider,function calling 支持已声明**

**验证方式:源码 + 已装包内数据实测**(无真实 key,**待真 key 实测**端到端)。

- litellm 内置 `deepseek_models` 集合包含:`deepseek-chat`、`deepseek-reasoner`、`deepseek-v4-flash`、`deepseek-v4-pro` 等(共 12 个条目,含 `deepseek/` 前缀变体);provider 分发键 `"deepseek"` 注册于 `litellm/__init__.py`(model cost map 按 `litellm_provider == "deepseek"` 归类)。
- 调用形态(官方文档口径):`acompletion(model="deepseek/deepseek-chat", api_key=<DEEPSEEK_API_KEY>, ...)`;也可经 `api_base` 指向 DeepSeek 兼容端点。**端到端真机行为待真 key 实测**。
- `litellm.supports_function_calling()` 实测:
  - `"deepseek/deepseek-chat"` → **True**
  - `"deepseek/deepseek-reasoner"` → **False**(内置成本表未给 reasoner 标注 function calling——与 DeepSeek 官方"reasoner 暂不支持 function calling"口径一致;若项目要在 reasoner 上跑 skills,此路不通)
- 注意:项目当前 `DEEPSEEK_MODEL` 配置值若是裸名(如 `deepseek-chat`),接 litellm 时必须加 `deepseek/` 前缀,否则会被当作未知 provider。

## 6. 版本锁定建议

**建议锁 `==`(精确版本,如 `litellm==1.98.x`)**,理由:

1. litellm 迭代极快(几乎周更 minor),provider 行为、异常类型、Router 参数均有变动史;`>=` 会把上游破坏性变更直接放进生产。
2. 本次验证的全部结论绑定 1.98.0;升级时应重跑 `run_checks.py` 作为回归门槛。
3. 它同时锁定了传递依赖(openai SDK、pydantic)的兼容矩阵,精确锁版本可复现本报告的环境。

---

## 汇总表

| # | 验证点 | 结论 | 验证方式 | 可复现 |
|---|---|---|---|---|
| 1 | tools 透传/响应结构 | 同构,skill_runner 解析逻辑零改动可用 | mock 实测 | ✅ run_checks.py |
| 2 | Router 多 key 重试 | 自动换部署重试;num_retries/retry_after/cooldown_time;默认随机策略 | mock 实测 | ✅ run_checks.py |
| 3 | usage 缺失 | 返回全 0 Usage 对象,非 None 不抛错;与现有 httpx 行为一致 | mock 实测 | ✅ MOCK_FAIL_USAGE=1 |
| 4 | 依赖体积 | 111 MB,import ~18s,无 torch/transformers;botocore/openai/tokenizers 为大头 | 实测 | ✅ du/计时 |
| 5 | DeepSeek 支持 | 一等 provider;chat=True / reasoner=False;裸名需加前缀 | 源码+包内数据 | 部分(端到端待真 key) |
