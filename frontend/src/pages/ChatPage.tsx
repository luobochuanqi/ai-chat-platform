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
import { Globe, Sparkles } from 'lucide-react'

interface Message {
  id: number
  role: string
  content: string
  created_at: string
}

interface Session {
  id: number
  title: string
  created_at: string
  updated_at: string
  message_count: number
}

// Markdown components
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
  h1({ children }: any) {
    return <h1 className="text-xl font-bold mb-2">{children}</h1>
  },
  h2({ children }: any) {
    return <h2 className="text-lg font-bold mb-2">{children}</h2>
  },
  h3({ children }: any) {
    return <h3 className="text-base font-bold mb-2">{children}</h3>
  },
  blockquote({ children }: any) {
    return <blockquote className="border-l-4 border-accent-400 pl-4 italic my-2 text-zinc-600">{children}</blockquote>
  },
  table({ children }: any) {
    return <div className="overflow-x-auto mb-2"><table className="min-w-full border-collapse border border-zinc-300">{children}</table></div>
  },
  thead({ children }: any) {
    return <thead className="bg-zinc-100">{children}</thead>
  },
  th({ children }: any) {
    return <th className="border border-zinc-300 px-3 py-2 text-left text-sm font-semibold">{children}</th>
  },
  td({ children }: any) {
    return <td className="border border-zinc-300 px-3 py-2 text-sm">{children}</td>
  },
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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadSessions()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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
      const response = await api.post('/chat/sessions', null, { params: { title: '新会话' } })
      const newSession = response.data
      setSessions([newSession, ...sessions])
      setCurrentSession(newSession.id)
      setMessages([])
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  const handleUpdateTitle = async (sessionId: number) => {
    if (!editTitle.trim()) {
      setEditingSession(null)
      return
    }
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
    
    // Optimistically add user message
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
      
      // Generate title if this is the first message
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
    <div className="flex h-screen bg-zinc-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-zinc-200 flex flex-col">
        <div className="p-4 border-b border-zinc-200">
          <h1 className="text-lg font-bold text-zinc-900">AI 探索平台</h1>
          <p className="text-sm text-zinc-500">{user?.nickname}</p>
        </div>
        
        <div className="p-3">
          <button
            onClick={handleNewSession}
            className="w-full flex items-center justify-center gap-2 bg-accent-600 text-white py-2 rounded-lg hover:bg-accent-700 transition"
          >
            <span className="text-lg">+</span>
            新建会话
          </button>
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
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingSession(session.id)
                  setEditTitle(session.title)
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-100 rounded transition text-blue-500 text-xs mr-1"
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
                {/* Web Search Toggle */}
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
              <p className="text-zinc-500">选择一个会话或创建新会话开始对话</p>
              <button onClick={handleNewSession} className="mt-4 px-6 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 transition">
                开始新对话
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
