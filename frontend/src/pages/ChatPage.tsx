import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../services/api'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import 'highlight.js/styles/github-dark.css'
import 'katex/dist/katex.min.css'
import { Globe, Sparkles, Settings, X, Plus, Trash2 } from 'lucide-react'

interface Message {
  id: number
  role: string
  content: string
  tokens_used?: number
  created_at: string
}

interface Session {
  id: number
  title: string
  created_at: string
  updated_at: string
  message_count: number
}

interface SystemPromptItem {
  id: number
  name: string
  description?: string
  prompt: string
  is_builtin: boolean
  user_id?: number
  is_active: boolean
  created_at: string
}

const MarkdownComponents = {
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '')
    return !inline && match ? (
      <div className="relative">
        <div className="absolute top-0 right-0 px-2 py-1 text-xs text-zinc-400 bg-zinc-800 rounded-bl">
          {match[1]}
        </div>
        <code className={className} {...props}>
          {children}
        </code>
      </div>
    ) : (
      <code className="bg-zinc-100 px-1 py-0.5 rounded text-sm font-mono text-zinc-800" {...props}>
        {children}
      </code>
    )
  },
  p({ children }: any) {
    return <p className="mb-2 last:mb-0">{children}</p>
  },
  ul({ children }: any) {
    return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
  },
  ol({ children }: any) {
    return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
  },
  h1({ children }: any) { return <h1 className="text-xl font-bold mb-2">{children}</h1> },
  h2({ children }: any) { return <h2 className="text-lg font-bold mb-2">{children}</h2> },
  h3({ children }: any) { return <h3 className="text-base font-bold mb-2">{children}</h3> },
  blockquote({ children }: any) {
    return <blockquote className="border-l-4 border-accent-400 pl-4 italic my-2 text-zinc-600">{children}</blockquote>
  },
  table({ children }: any) {
    return <div className="overflow-x-auto mb-2"><table className="min-w-full border-collapse border border-zinc-300">{children}</table></div>
  },
  thead({ children }: any) { return <thead className="bg-zinc-100">{children}</thead> },
  th({ children }: any) { return <th className="border border-zinc-300 px-3 py-2 text-left text-sm font-semibold">{children}</th> },
  td({ children }: any) { return <td className="border border-zinc-300 px-3 py-2 text-sm">{children}</td> },
}

export default function ChatPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSession, setCurrentSession] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingSession, setEditingSession] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  
  // System prompt states
  const [showSystemPromptEditor, setShowSystemPromptEditor] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [systemPromptName, setSystemPromptName] = useState('')
  const [systemPromptDescription, setSystemPromptDescription] = useState('')
  const [presets, setPresets] = useState<SystemPromptItem[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadSessions() }, [])
  useEffect(() => { scrollToBottom() }, [messages])

  const loadSessions = async () => {
    try {
      const response = await api.get('/chat/sessions')
      setSessions(response.data)
    } catch (error) {
      console.error('Failed to load sessions:', error)
    }
  }

  const loadSessionMessages = async (sessionId: number) => {
    try {
      const response = await api.get(`/chat/sessions/${sessionId}`)
      setMessages(response.data.messages)
      setCurrentSession(sessionId)
    } catch (error) {
      console.error('Failed to load session:', error)
    }
  }

  const loadPresets = async () => {
    try {
      const response = await api.get('/chat/system-prompts')
      setPresets(response.data)
    } catch (error) {
      console.error('Failed to load presets:', error)
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
      }
    } catch (error) {
      console.error('Failed to generate title:', error)
    }
  }

  const handleNewSession = async () => {
    try {
      const response = await api.post('/chat/sessions', {
        title: '新会话',
        system_prompt: systemPrompt || undefined
      })
      const newSession = response.data
      setSessions([newSession, ...sessions])
      setCurrentSession(newSession.id)
      setMessages([])
      setShowSystemPromptEditor(false)
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  const handleUpdateTitle = async (sessionId: number) => {
    if (!editTitle.trim()) { setEditingSession(null); return }
    try {
      await api.put(`/chat/sessions/${sessionId}`, null, { params: { title: editTitle.trim() } })
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, title: editTitle.trim() } : s
      ))
      setEditingSession(null)
    } catch (error) {
      console.error('Failed to update title:', error)
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
      console.error('Failed to send message:', error)
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
        setMessages([])
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }

  const handleSaveCustomPreset = async () => {
    if (!systemPrompt.trim() || !systemPromptName.trim()) return
    try {
      const response = await api.post('/chat/system-prompts', {
        name: systemPromptName,
        description: systemPromptDescription,
        prompt: systemPrompt
      })
      setPresets(prev => [...prev, response.data])
      setSystemPromptName('')
      setSystemPromptDescription('')
    } catch (error) {
      console.error('Failed to save preset:', error)
    }
  }

  const handleDeletePreset = async (presetId: number) => {
    try {
      await api.delete(`/chat/system-prompts/${presetId}`)
      setPresets(prev => prev.filter(p => p.id !== presetId))
    } catch (error) {
      console.error('Failed to delete preset:', error)
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

  const defaultSystemPrompt = '你是一个有帮助的AI助手。请用简洁清晰的中文回答用户的问题。'

  return (
    <div className="flex h-screen bg-zinc-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-zinc-200 flex flex-col">
        <div className="p-4 border-b border-zinc-200">
          <h1 className="text-lg font-bold text-zinc-900">AI 探索平台</h1>
          <p className="text-sm text-zinc-500">{user?.nickname}</p>
        </div>

        <div className="p-3 space-y-2">
          <button
            onClick={() => {
              loadPresets()
              setShowSystemPromptEditor(true)
            }}
            className="w-full flex items-center justify-center gap-2 bg-accent-600 text-white py-2 rounded-lg hover:bg-accent-700 transition"
          >
            <span className="text-lg">+</span>
            新建会话
          </button>
          <div className="relative">
            <input
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="系统提示词（可选）"
              className="w-full px-3 py-1.5 text-xs border border-zinc-200 rounded-lg focus:ring-2 focus:ring-accent-500 outline-none bg-zinc-50"
            />
            {systemPrompt && (
              <button
                onClick={() => setSystemPrompt('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 px-1">会话列表</h3>
          {sessions.map(session => (
            <div
              key={session.id}
              onClick={() => loadSessionMessages(session.id)}
              className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer mb-1 transition ${
                currentSession === session.id ? 'bg-accent-50 text-accent-700' : 'hover:bg-zinc-100'
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
                    className="w-full text-sm px-1 py-0.5 border border-accent-300 rounded outline-none"
                  />
                ) : (
                  <p className="text-sm font-medium truncate">{session.title}</p>
                )}
                <p className="text-xs text-zinc-400">{session.message_count} 条消息</p>
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingSession(session.id)
                    setEditTitle(session.title)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-100 rounded transition text-blue-500 text-xs"
                >
                  编辑
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteSession(session.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition text-red-500 text-xs"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-zinc-200 space-y-1">
          <button onClick={() => navigate('/chat')} className="w-full text-left px-3 py-2 text-sm font-medium text-accent-700 bg-accent-50 rounded-lg">
            AI 对话
          </button>
          <button onClick={() => navigate('/image')} className="w-full text-left px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition">
            AI 生图
          </button>
          <button onClick={() => navigate('/gallery')} className="w-full text-left px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition">
            作品墙
          </button>
          {user?.is_admin && (
            <button onClick={() => navigate('/admin')} className="w-full text-left px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition">
              管理后台
            </button>
          )}
        </div>

        <div className="p-3 border-t border-zinc-200">
          <button onClick={logout} className="w-full text-left px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition">
            退出登录
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {currentSession ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-3xl px-4 py-3 rounded-2xl ${
                    message.role === 'user' ? 'bg-accent-600 text-white' : 'bg-white border border-zinc-200 text-zinc-900'
                  }`}>
                    {message.role === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeHighlight, rehypeKatex]}
                          components={MarkdownComponents}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-zinc-200 px-4 py-3 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t border-zinc-200">
              <div className="max-w-4xl mx-auto space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition ${
                      webSearchEnabled
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-zinc-100 text-zinc-600 border border-zinc-200 hover:bg-zinc-200'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    {webSearchEnabled ? '联网搜索已开启' : '联网搜索'}
                  </button>
                  <button
                    onClick={() => {
                      loadPresets()
                      setShowSystemPromptEditor(true)
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition ${
                      systemPrompt
                        ? 'bg-accent-100 text-accent-700 border border-accent-200'
                        : 'bg-zinc-100 text-zinc-600 border border-zinc-200 hover:bg-zinc-200'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    {systemPrompt ? '系统提示词已设置' : '编辑系统提示词'}
                  </button>
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入消息... (按 Enter 发送)"
                    rows={1}
                    className="flex-1 px-4 py-3 border border-zinc-300 rounded-xl resize-none focus:ring-2 focus:ring-accent-500 focus:border-transparent outline-none transition min-h-[44px]"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={loading || !input.trim()}
                    className="px-6 py-3 bg-accent-600 text-white rounded-xl font-medium hover:bg-accent-700 transition disabled:opacity-50"
                  >
                    发送
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Sparkles className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
              <p className="text-zinc-500 mb-2">选择一个会话或创建新会话开始对话</p>
              <div className="flex flex-col items-center gap-2">
                <div className="w-72">
                  <input
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="系统提示词（可选，例如：你是一个编程导师...）"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-accent-500 outline-none"
                  />
                </div>
                <button
                  onClick={() => {
                    loadPresets()
                    setShowSystemPromptEditor(true)
                  }}
                  className="text-sm text-accent-600 hover:text-accent-700"
                >
                  从预设中选择
                </button>
                <button
                  onClick={handleNewSession}
                  className="mt-2 px-6 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 transition"
                >
                  开始新对话
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* System Prompt Editor Modal */}
      {showSystemPromptEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col mx-4">
            <div className="flex items-center justify-between p-5 border-b border-zinc-200">
              <h3 className="text-lg font-bold text-zinc-900">编辑系统提示词</h3>
              <button
                onClick={() => setShowSystemPromptEditor(false)}
                className="p-1 hover:bg-zinc-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* System Prompt Input */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  系统提示词 (System Prompt)
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder={defaultSystemPrompt}
                  rows={5}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg resize-none focus:ring-2 focus:ring-accent-500 outline-none text-sm"
                />
                <p className="text-xs text-zinc-400 mt-1">
                  用于设定 AI 的行为模式。留空则使用默认提示词。
                </p>
              </div>

              {/* Save as Custom Preset */}
              <div className="bg-zinc-50 rounded-xl p-4 space-y-2">
                <h4 className="text-sm font-semibold text-zinc-700">保存为我的预设</h4>
                <input
                  value={systemPromptName}
                  onChange={(e) => setSystemPromptName(e.target.value)}
                  placeholder="预设名称（例如：我的编程助手）"
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:ring-2 focus:ring-accent-500 outline-none"
                />
                <input
                  value={systemPromptDescription}
                  onChange={(e) => setSystemPromptDescription(e.target.value)}
                  placeholder="简短描述（可选）"
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:ring-2 focus:ring-accent-500 outline-none"
                />
                <button
                  onClick={handleSaveCustomPreset}
                  disabled={!systemPrompt.trim() || !systemPromptName.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white text-sm rounded-lg hover:bg-accent-700 transition disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  保存预设
                </button>
              </div>

              {/* Preset List */}
              <div>
                <h4 className="text-sm font-semibold text-zinc-700 mb-2">
                  预设提示词
                  {presets.filter(p => p.is_builtin).length > 0 && (
                    <span className="text-xs font-normal text-zinc-400 ml-2">
                      ({presets.filter(p => p.is_builtin).length} 个内置)
                    </span>
                  )}
                </h4>
                {presets.length === 0 ? (
                  <p className="text-sm text-zinc-400">暂无预设提示词</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {presets.map((preset) => (
                      <div
                        key={preset.id}
                        className={`relative group border rounded-xl p-3 cursor-pointer hover:border-accent-400 hover:shadow-sm transition ${
                          systemPrompt === preset.prompt
                            ? 'border-accent-500 bg-accent-50 ring-1 ring-accent-500'
                            : 'border-zinc-200'
                        }`}
                      >
                        <div onClick={() => setSystemPrompt(preset.prompt)}>
                          <div className="flex items-center gap-1.5 mb-1">
                            {preset.is_builtin && (
                              <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                                预置
                              </span>
                            )}
                            <h5 className="text-sm font-semibold text-zinc-800">{preset.name}</h5>
                          </div>
                          {preset.description && (
                            <p className="text-xs text-zinc-500 line-clamp-2">{preset.description}</p>
                          )}
                        </div>
                        {!preset.is_builtin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeletePreset(preset.id)
                            }}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-zinc-400 mt-2">
                  管理员可在管理后台添加更多内置预设提示词
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-zinc-200">
              <button
                onClick={() => setShowSystemPromptEditor(false)}
                className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg transition"
              >
                取消
              </button>
              <button
                onClick={() => setShowSystemPromptEditor(false)}
                className="px-4 py-2 text-sm bg-accent-600 text-white rounded-lg hover:bg-accent-700 transition"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
