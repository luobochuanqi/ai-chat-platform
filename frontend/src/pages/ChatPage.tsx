import { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import { AppLayout } from '../components/layout/AppLayout'
import { MessageBubble } from '../components/chat/MessageBubble'
import { SKILLS, ToolCall } from '../components/SkillIcons'
import { motion } from 'framer-motion'
import { Globe, Plus, Settings, X } from 'lucide-react'
import 'highlight.js/styles/github-dark.css'
import 'katex/dist/katex.min.css'

interface Message {
  id: number
  role: string
  content: string
  tokens_used?: number
  tool_calls?: ToolCall[]
  search_results?: { title: string; url: string; snippet: string }[]
  created_at: string
}

interface Session {
  id: number
  title: string
  created_at: string
  updated_at: string
  message_count: number
}

interface SessionDetail {
  id: number
  title: string
  system_prompt?: string | null
  enabled_skills?: string[]
  messages: Message[]
}

const QUICK_STARTS = [
  '写一首关于秋天的小诗',
  '用大白话解释什么是勾股定理',
  '讲一个冷笑话',
  '帮我算 1234 × 5678 等于多少',
]

export default function ChatPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSession, setCurrentSession] = useState<number | null>(null)
  const [currentSessionData, setCurrentSessionData] = useState<SessionDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingSession, setEditingSession] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)

  // 编辑面板（slide-over）
  const [showSettings, setShowSettings] = useState(false)
  const [editorTitle, setEditorTitle] = useState('')
  const [editorSystemPrompt, setEditorSystemPrompt] = useState('')
  const [editorSkills, setEditorSkills] = useState<string[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadSessions() }, [])
  useEffect(() => { scrollToBottom() }, [messages])

  const loadSessions = async () => {
    try {
      const response = await api.get('/chat/sessions')
      setSessions(response.data)
    } catch (error) {
      console.error('[Chat] 加载会话列表失败:', error)
    }
  }

  const loadSessionMessages = async (sessionId: number) => {
    try {
      const response = await api.get(`/chat/sessions/${sessionId}`)
      setCurrentSessionData(response.data)
      setMessages(response.data.messages)
      setCurrentSession(sessionId)
    } catch (error) {
      console.error('[Chat] 加载会话消息失败:', error)
    }
  }

  const generateSessionTitle = async (sessionId: number, firstMessage: string) => {
    try {
      const response = await api.post('/chat/sessions/generate-title', {
        session_id: sessionId,
        first_message: firstMessage
      })
      if (response.data.title) {
        setSessions(prev => prev.map(s =>
          s.id === sessionId ? { ...s, title: response.data.title } : s
        ))
        setCurrentSessionData(prev => prev && prev.id === sessionId ? { ...prev, title: response.data.title } : prev)
      }
    } catch (error) {
      console.error('[Chat] 生成标题失败:', error)
    }
  }

  // P2: 新建一键创建（无弹窗，默认 skills 全启）
  const handleCreateSession = async () => {
    try {
      const response = await api.post('/chat/sessions', {
        title: '新会话',
        enabled_skills: SKILLS.map(s => s.name),
      })
      const newSession = response.data
      setSessions([newSession, ...sessions])
      setCurrentSession(newSession.id)
      setCurrentSessionData({ ...newSession, messages: [] })
      setMessages([])
    } catch (error) {
      console.error('[Chat] 创建会话失败:', error)
    }
  }

  const handleQuickStart = async (question: string) => {
    try {
      const response = await api.post('/chat/sessions', { title: '新会话', enabled_skills: SKILLS.map(s => s.name) })
      const newSession = response.data
      setSessions([newSession, ...sessions])
      setCurrentSession(newSession.id)
      setCurrentSessionData({ ...newSession, messages: [] })
      setMessages([])
      setInput(question)
    } catch (error) {
      console.error('[Chat] 快速开始失败:', error)
    }
  }

  // P2: update 改 body（支持 title/system_prompt/enabled_skills）
  const handleUpdateTitle = async (sessionId: number) => {
    if (!editTitle.trim()) { setEditingSession(null); return }
    try {
      await api.put(`/chat/sessions/${sessionId}`, { title: editTitle.trim() })
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, title: editTitle.trim() } : s
      ))
      setEditingSession(null)
    } catch (error) {
      console.error('[Chat] 更新标题失败:', error)
    }
  }

  const handleSendMessage = async () => {
    if (!input.trim() || !currentSession) return

    const userMessage = input.trim()
    setInput('')
    setLoading(true)

    const tempUserMsg: Message = {
      id: Date.now(),
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempUserMsg])

    try {
      const response = await api.post(`/chat/sessions/${currentSession}/messages`, {
        content: userMessage,
        web_search: webSearchEnabled
      })
      setMessages(prev => [...prev, response.data])
      loadSessions()

      const currentSessionData = sessions.find(s => s.id === currentSession)
      if (currentSessionData && currentSessionData.title === '新会话' && messages.length === 0) {
        generateSessionTitle(currentSession, userMessage)
      }
    } catch (error: any) {
      console.error('[Chat] 发送消息失败:', error)
      const errorMsg: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '抱歉，发送消息时出错：' + (error.response?.data?.detail || '未知错误'),
        created_at: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSession = async (sessionId: number) => {
    if (!window.confirm('确定要删除这个会话吗？')) return
    try {
      await api.delete(`/chat/sessions/${sessionId}`)
      setSessions(sessions.filter(s => s.id !== sessionId))
      if (currentSession === sessionId) {
        setCurrentSession(null)
        setCurrentSessionData(null)
        setMessages([])
      }
    } catch (error) {
      console.error('[Chat] 删除会话失败:', error)
    }
  }

  // P2: 打开会话设置（slide-over）
  const openSettings = () => {
    if (!currentSessionData) return
    setEditorTitle(currentSessionData.title || '')
    setEditorSystemPrompt(currentSessionData.system_prompt || '')
    setEditorSkills(currentSessionData.enabled_skills || [])
    setShowSettings(true)
  }

  const toggleEditorSkill = (name: string) => {
    setEditorSkills(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
  }

  const saveSettings = async () => {
    if (!currentSession) return
    try {
      await api.put(`/chat/sessions/${currentSession}`, {
        title: editorTitle.trim() || '新会话',
        system_prompt: editorSystemPrompt.trim() || null,
        enabled_skills: editorSkills,
      })
      setCurrentSessionData(prev => prev ? {
        ...prev,
        title: editorTitle.trim() || '新会话',
        system_prompt: editorSystemPrompt.trim() || null,
        enabled_skills: editorSkills,
      } : prev)
      setSessions(prev => prev.map(s => s.id === currentSession ? { ...s, title: editorTitle.trim() || '新会话' } : s))
      setShowSettings(false)
    } catch (error) {
      console.error('[Chat] 保存设置失败:', error)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <AppLayout
      sidebarExtra={
        <>
          <div className="p-3 border-b border-surface2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCreateSession}
              className="w-full flex items-center justify-center gap-2 bg-mauve text-base py-2 rounded hover:bg-mauve/90 transition text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> 新建会话
            </motion.button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2">
            <h3 className="text-[10px] font-medium text-subtext0 uppercase tracking-wider mb-2 px-1">会话列表</h3>
            {sessions.map(session => (
              <div
                key={session.id}
                onClick={() => loadSessionMessages(session.id)}
                className={`group flex items-center justify-between p-2 rounded cursor-pointer mb-0.5 transition hover:translate-x-0.5 border-l-2 ${
                  currentSession === session.id ? 'bg-mantle text-ctext font-medium border-mauve' : 'hover:bg-mantle/60 text-subtext1 border-transparent'
                }`}
              >
                <div className="flex-1 min-w-0">
                  {editingSession === session.id ? (
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => handleUpdateTitle(session.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateTitle(session.id)
                        if (e.key === 'Escape') setEditingSession(null)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full text-sm px-1 py-0.5 border border-mauve rounded outline-none bg-base"
                    />
                  ) : (
                    <p className={`text-sm truncate ${currentSession === session.id ? 'font-medium' : ''}`}>{session.title}</p>
                  )}
                  <p className="text-xs text-subtext0">{session.message_count} 条</p>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingSession(session.id); setEditTitle(session.title) }}
                    className="p-1 hover:bg-mauve/15 rounded text-mauve text-xs"
                  >编辑</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id) }}
                    className="p-1 hover:bg-red/15 rounded text-red text-xs"
                  >删除</button>
                </div>
              </div>
            ))}
          </div>
        </>
      }
    >
      <div className="flex-1 flex flex-col h-full">
        {currentSession ? (
          <>
            {/* P2: 会话头（标题 + 设置按钮） */}
            <div className="px-6 py-3 border-b border-surface2 flex items-center justify-between bg-base">
              <h2 className="font-serif text-lg text-ctext truncate">{currentSessionData?.title || '新会话'}</h2>
              <button
                onClick={openSettings}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-subtext1 hover:text-ctext hover:bg-surface0 rounded transition"
              >
                <Settings className="w-4 h-4" /> 设置
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-surface0 border border-surface2 px-4 py-3 rounded flex items-center gap-2">
                    <span className="text-sm text-subtext1">AI 正在思考</span>
                    {[0, 150, 300].map(delay => (
                      <motion.div
                        key={delay}
                        className="w-3 h-px bg-mauve"
                        animate={{ opacity: [0.3, 1, 0.3], scaleX: [0.6, 1, 0.6] }}
                        transition={{ duration: 1, repeat: Infinity, delay: delay / 1000, ease: 'easeInOut' }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-mantle border-t border-surface2">
              <div className="max-w-4xl mx-auto space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition border ${
                      webSearchEnabled ? 'bg-blue/15 text-blue border-blue/40' : 'bg-base text-subtext1 border-surface2 hover:bg-surface0'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    {webSearchEnabled ? '联网搜索已开启' : '联网搜索'}
                  </button>
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
                    rows={1}
                    className="flex-1 px-4 py-3 bg-base border border-surface2 rounded resize-none focus:border-mauve focus:ring-1 focus:ring-mauve outline-none transition min-h-[44px] text-sm"
                  />
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={handleSendMessage}
                    disabled={loading || !input.trim()}
                    className="px-6 py-3 bg-mauve text-base rounded font-medium hover:bg-mauve/90 transition disabled:opacity-40 text-sm"
                  >
                    发送
                  </motion.button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto flex items-center">
            <div className="max-w-2xl mx-auto px-6 py-12 w-full">
              <div className="flex justify-center items-center gap-5 mb-8">
                {[
                  { d: 'M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8 5.8 21.3l2.4-7.4L2 9.4h7.6z', size: 38, op: 1 },
                  { d: 'M4 12 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0', size: 28, op: 0.5 },
                  { d: 'M4 12 L12 4 L20 12 L12 20 Z', size: 24, op: 0.28 },
                ].map((s, i) => (
                  <motion.svg key={i} width={s.size} height={s.size} viewBox="0 0 24 24" fill="none" stroke="#5C5F77" strokeOpacity={s.op} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 2 + i * 0.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
                  ><path d={s.d} /></motion.svg>
                ))}
              </div>
              <motion.h2
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="font-serif text-5xl text-center text-ctext tracking-tight mb-3"
              >和 AI <span className="italic text-mauve">聊点</span>什么？</motion.h2>
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                className="text-center text-subtext1 mb-10"
              >选一个问题开始，或自己出题</motion.p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {QUICK_STARTS.map((q, i) => (
                  <motion.button
                    key={q}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ scale: 1.02, y: -3 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleQuickStart(q)}
                    className="text-left p-4 bg-base border border-surface2 rounded-lg hover:border-mauve hover:shadow-md transition flex items-start gap-3"
                  >
                    <span className="font-serif text-lg text-mauve leading-none mt-0.5">{i + 1}</span>
                    <span className="text-sm text-ctext">{q}</span>
                  </motion.button>
                ))}
              </div>
              <div className="text-center mt-8">
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleCreateSession}
                  className="px-6 py-2.5 border border-mauve text-mauve rounded hover:bg-mauve/10 transition text-sm font-medium"
                >空白新建会话</motion.button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* P2: 会话设置 slide-over 面板（A 形态） */}
      {showSettings && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowSettings(false)} />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed right-0 top-0 bottom-0 w-[30rem] bg-base border-l-2 border-overlay0 z-50 flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface2">
              <h3 className="font-serif text-lg text-ctext">会话设置</h3>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-surface0 rounded transition">
                <X className="w-4 h-4 text-subtext0" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              <div>
                <label className="block text-sm font-medium text-ctext mb-1">标题</label>
                <input
                  value={editorTitle}
                  onChange={(e) => setEditorTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-mantle border border-surface2 rounded focus:border-mauve outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ctext mb-1">系统提示词（人设）</label>
                <textarea
                  value={editorSystemPrompt}
                  onChange={(e) => setEditorSystemPrompt(e.target.value)}
                  rows={12}
                  placeholder="告诉 AI 它应该怎么回答，比如「像历史老师一样给我讲故事」"
                  className="w-full px-3 py-2 bg-mantle border border-surface2 rounded resize-y focus:border-mauve outline-none text-sm"
                />
                <p className="text-xs text-subtext0 mt-1">留空 = 默认助手。随时可改。</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-ctext mb-1">技能（Skills）</label>
                <div className="space-y-1.5">
                  {SKILLS.map(skill => {
                    const checked = editorSkills.includes(skill.name)
                    const Icon = skill.icon
                    return (
                      <label
                        key={skill.name}
                        className={`flex items-center gap-2 p-2 border rounded cursor-pointer transition ${
                          checked ? 'border-mauve bg-mauve/8' : 'border-surface2 hover:bg-surface0/50'
                        }`}
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggleEditorSkill(skill.name)} />
                        <Icon className={`w-4 h-4 ${skill.colorClass}`} />
                        <span className="text-sm text-ctext">{skill.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-surface2 flex gap-2">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 px-4 py-2 border border-surface2 text-subtext1 rounded hover:bg-surface0 transition text-sm"
              >取消</button>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={saveSettings}
                className="flex-1 px-4 py-2 bg-mauve text-base rounded hover:bg-mauve/90 transition text-sm font-medium"
              >保存</motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AppLayout>
  )
}
