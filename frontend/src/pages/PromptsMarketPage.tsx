import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { AppLayout } from '../components/layout/AppLayout'
import { motion } from 'framer-motion'
import { Heart, Search, Plus, MessageCircle, X } from 'lucide-react'

interface MarketPrompt {
  id: number
  name: string
  description?: string | null
  prompt: string
  tags: string[]
  is_builtin: boolean
  is_public: boolean
  likes: number
  use_count: number
  created_at: string
  user_id?: number | null
  author_nickname: string
  is_liked: boolean
  is_owner: boolean
}

/** 预定义标签（筛选 chips）。可扩展。 */
const POPULAR_TAGS = ['写作', '学习', '编程', '创意', '翻译', '角色扮演']

export default function PromptsMarketPage() {
  const [prompts, setPrompts] = useState<MarketPrompt[]>([])
  const [tag, setTag] = useState('')
  const [sort, setSort] = useState('newest')
  const [q, setQ] = useState('')

  // 发布表单
  const [showPublish, setShowPublish] = useState(false)
  const [pName, setPName] = useState('')
  const [pDesc, setPDesc] = useState('')
  const [pContent, setPContent] = useState('')
  const [pTags, setPTags] = useState('')

  // 详情弹窗（点卡片看 prompt 全文）
  const [detailPrompt, setDetailPrompt] = useState<MarketPrompt | null>(null)

  const navigate = useNavigate()

  const load = async () => {
    try {
      const res = await api.get('/prompts', { params: { tag, sort, ...(q ? { q } : {}) } })
      setPrompts(res.data)
    } catch (error) {
      console.error('[Prompts] 加载失败:', error)
    }
  }

  useEffect(() => { load() }, [tag, sort])

  const handleLike = async (id: number) => {
    try {
      const res = await api.post(`/prompts/${id}/like`)
      setPrompts(prev => prev.map(p =>
        p.id === id ? { ...p, is_liked: res.data.liked, likes: res.data.likes } : p
      ))
      // 详情弹窗与列表同步
      setDetailPrompt(prev => prev && prev.id === id ? { ...prev, is_liked: res.data.liked, likes: res.data.likes } : prev)
    } catch (error) {
      console.error('[Prompts] 点赞失败:', error)
    }
  }

  const handleUse = async (id: number) => {
    try {
      const res = await api.post(`/prompts/${id}/use`)
      navigate('/chat', { state: { newSessionId: res.data.session_id } })
    } catch (error) {
      console.error('[Prompts] 开聊失败:', error)
    }
  }

  const handlePublish = async () => {
    if (!pName.trim() || !pContent.trim()) return
    try {
      await api.post('/prompts', {
        name: pName.trim(),
        description: pDesc.trim() || null,
        prompt: pContent.trim(),
        tags: pTags.split(/[，,\s]+/).filter(Boolean),
      })
      setShowPublish(false)
      setPName(''); setPDesc(''); setPContent(''); setPTags('')
      load()
    } catch (error) {
      console.error('[Prompts] 发布失败:', error)
    }
  }

  return (
    <AppLayout>
      <div className="h-full overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6">
          {/* 标题 + 发布 */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-serif text-2xl text-ctext">提示词市场</h2>
              <p className="text-subtext0 text-sm mt-1">看看别人怎么给 AI 设定人设，拿来就用</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setShowPublish(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-mauve text-base rounded hover:bg-mauve/90 transition text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> 发布我的
            </motion.button>
          </div>

          {/* 搜索 + 排序 */}
          <div className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-overlay0 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load()}
                placeholder="搜索提示词..."
                className="w-full pl-9 pr-3 py-2 bg-base border border-surface2 rounded focus:border-mauve outline-none text-sm"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="px-3 py-2 bg-base border border-surface2 rounded text-sm focus:border-mauve outline-none"
            >
              <option value="newest">最新</option>
              <option value="popular">最热</option>
              <option value="most_used">最多使用</option>
            </select>
          </div>

          {/* 标签 chips */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setTag('')}
              className={`px-3 py-1 rounded text-xs transition border ${tag === '' ? 'bg-mauve text-base border-mauve' : 'bg-base text-subtext1 border-surface2 hover:bg-surface0'}`}
            >全部</button>
            {POPULAR_TAGS.map(t => (
              <button
                key={t}
                onClick={() => setTag(t)}
                className={`px-3 py-1 rounded text-xs transition border ${tag === t ? 'bg-mauve text-base border-mauve' : 'bg-base text-subtext1 border-surface2 hover:bg-surface0'}`}
              >{t}</button>
            ))}
          </div>

          {/* 网格 */}
          {prompts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-subtext0">还没有提示词，快发布第一个吧</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {prompts.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => setDetailPrompt(p)}
                  className="bg-base border border-surface2 rounded p-4 flex flex-col hover:border-mauve transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-serif text-lg text-ctext flex-1 truncate">{p.name}</h3>
                    {p.is_builtin && <span className="text-xs px-1.5 py-0.5 bg-mauve/15 text-mauve rounded shrink-0">预置</span>}
                    {p.is_owner && <span className="text-xs px-1.5 py-0.5 bg-green/15 text-green rounded shrink-0">我的</span>}
                  </div>
                  {p.description && <p className="text-sm text-subtext1 mb-2 line-clamp-2">{p.description}</p>}
                  {p.tags && p.tags.length > 0 && (
                    <div className="flex gap-1 mb-2 flex-wrap">
                      {p.tags.map(t => <span key={t} className="text-xs px-1.5 py-0.5 bg-surface0 text-subtext1 rounded">{t}</span>)}
                    </div>
                  )}
                  <div className="text-xs text-overlay0 mb-3">作者：{p.author_nickname} · 用过 {p.use_count} 次</div>
                  <div className="mt-auto flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleLike(p.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition ${p.is_liked ? 'bg-red/15 text-red' : 'bg-surface0 text-subtext1 hover:bg-red/15 hover:text-red'}`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${p.is_liked ? 'fill-red' : ''}`} /> {p.likes}
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      onClick={() => handleUse(p.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-mauve text-base rounded hover:bg-mauve/90 transition text-xs font-medium"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> 用此开聊
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 详情弹窗（点卡片看 prompt 全文） */}
      {detailPrompt && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center px-4" onClick={() => setDetailPrompt(null)}>
          <motion.div
            initial={{ y: 16 }} animate={{ y: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-surface0 border-2 border-overlay0 rounded shadow-2xl flex flex-col max-h-[80vh]"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-surface2">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-serif text-lg text-ctext truncate">{detailPrompt.name}</h3>
                {detailPrompt.is_builtin && <span className="text-xs px-1.5 py-0.5 bg-mauve/15 text-mauve rounded shrink-0">预置</span>}
                {detailPrompt.is_owner && <span className="text-xs px-1.5 py-0.5 bg-green/15 text-green rounded shrink-0">我的</span>}
              </div>
              <button onClick={() => setDetailPrompt(null)} className="p-1 hover:bg-surface0 rounded transition shrink-0">
                <X className="w-4 h-4 text-subtext0" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {detailPrompt.description && <p className="text-sm text-subtext1 mb-3">{detailPrompt.description}</p>}
              {detailPrompt.tags && detailPrompt.tags.length > 0 && (
                <div className="flex gap-1 mb-3 flex-wrap">
                  {detailPrompt.tags.map(t => <span key={t} className="text-xs px-1.5 py-0.5 bg-surface0 text-subtext1 rounded">{t}</span>)}
                </div>
              )}
              <div className="text-xs text-overlay0 mb-1">提示词内容</div>
              <div className="text-sm text-ctext bg-mantle border border-surface2 rounded p-3 whitespace-pre-wrap leading-relaxed">{detailPrompt.prompt}</div>
              <div className="text-xs text-overlay0 mt-3">作者：{detailPrompt.author_nickname} · 用过 {detailPrompt.use_count} 次 · {detailPrompt.likes} 赞</div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-surface2">
              <button
                onClick={() => handleLike(detailPrompt.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded text-sm transition ${detailPrompt.is_liked ? 'bg-red/15 text-red' : 'bg-surface0 text-subtext1 hover:bg-red/15 hover:text-red'}`}
              >
                <Heart className={`w-4 h-4 ${detailPrompt.is_liked ? 'fill-red' : ''}`} /> {detailPrompt.likes}
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => { const id = detailPrompt.id; setDetailPrompt(null); handleUse(id) }}
                className="flex items-center gap-1.5 px-6 py-2 bg-mauve text-base rounded hover:bg-mauve/90 transition text-sm font-medium"
              >
                <MessageCircle className="w-4 h-4" /> 用此开聊
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 发布弹窗 */}
      {showPublish && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center px-4" onClick={() => setShowPublish(false)}>
          <motion.div
            initial={{ y: 16 }} animate={{ y: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-surface0 border-2 border-overlay0 rounded shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-surface2">
              <h3 className="font-serif text-lg text-ctext">发布提示词</h3>
              <button onClick={() => setShowPublish(false)} className="p-1 hover:bg-surface0 rounded transition">
                <X className="w-4 h-4 text-subtext0" />
              </button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-ctext mb-1">名称</label>
                <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="如：历史故事爷爷" className="w-full px-3 py-2 bg-mantle border border-surface2 rounded focus:border-mauve outline-none text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ctext mb-1">一句话描述</label>
                <input value={pDesc} onChange={(e) => setPDesc(e.target.value)} placeholder="如：像爷爷一样讲历史故事" className="w-full px-3 py-2 bg-mantle border border-surface2 rounded focus:border-mauve outline-none text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ctext mb-1">提示词内容（人设）</label>
                <textarea value={pContent} onChange={(e) => setPContent(e.target.value)} rows={6} placeholder="告诉 AI 怎么回答，如「你是一位历史老师，用故事讲解历史事件...」" className="w-full px-3 py-2 bg-mantle border border-surface2 rounded resize-y focus:border-mauve outline-none text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ctext mb-1">标签（空格或逗号分隔）</label>
                <input value={pTags} onChange={(e) => setPTags(e.target.value)} placeholder="如：学习 历史 角色扮演" className="w-full px-3 py-2 bg-mantle border border-surface2 rounded focus:border-mauve outline-none text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-surface2">
              <button onClick={() => setShowPublish(false)} className="px-4 py-2 border border-surface2 text-subtext1 rounded hover:bg-surface0 transition text-sm">取消</button>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handlePublish}
                disabled={!pName.trim() || !pContent.trim()}
                className="px-6 py-2 bg-mauve text-base rounded hover:bg-mauve/90 transition text-sm font-medium disabled:opacity-40"
              >发布</motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AppLayout>
  )
}
