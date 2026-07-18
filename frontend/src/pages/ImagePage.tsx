import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../services/api'

interface GeneratedImage {
  id: number
  prompt: string
  image_url: string
  is_public: boolean
  likes: number
  created_at: string
}

export default function ImagePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    loadMyImages()
  }, [])

  const loadMyImages = async () => {
    try {
      const response = await api.get('/images/my')
      setImages(response.data)
    } catch (error) {
      console.error('Failed to load images:', error)
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError('')
    
    try {
      const response = await api.post('/images/generate', { prompt: prompt.trim() })
      setImages([response.data, ...images])
      setPrompt('')
    } catch (err: any) {
      setError(err.response?.data?.detail || '生成图片失败')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleGenerate()
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
        
        <div className="p-3 border-t border-zinc-200 space-y-1">
          <button onClick={() => navigate('/chat')} className="w-full text-left px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition">
            AI 对话
          </button>
          <button onClick={() => navigate('/image')} className="w-full text-left px-3 py-2 text-sm font-medium text-accent-700 bg-accent-50 rounded-lg">
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
        
        <div className="p-3 border-t border-zinc-200 mt-auto">
          <button onClick={logout} className="w-full text-left px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition">
            退出登录
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-zinc-200 p-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div>
              <h2 className="text-xl font-bold text-zinc-900">AI 生图</h2>
              <p className="text-sm text-zinc-500">
                剩余额度: {(user?.image_quota ?? 0) - (user?.image_used ?? 0)} / {user?.image_quota ?? 0} 张
              </p>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-white border-b border-zinc-200">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="描述你想要生成的图片... (例如：一只可爱的猫咪在草地上玩耍)"
                rows={2}
                className="flex-1 px-4 py-3 border border-zinc-300 rounded-xl resize-none focus:ring-2 focus:ring-accent-500 focus:border-transparent outline-none transition"
              />
              <button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                className="px-6 py-3 bg-accent-600 text-white rounded-xl font-medium hover:bg-accent-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? '生成中...' : '生成'}
              </button>
            </div>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-lg font-semibold text-zinc-900 mb-4">我的作品</h3>
            
            {images.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-zinc-500">还没有生成过图片，快去创作吧！</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {images.map((image) => (
                  <div key={image.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden hover:shadow-md transition">
                    <div className="aspect-square bg-zinc-100 flex items-center justify-center">
                      <img
                        src={image.image_url}
                        alt={image.prompt}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23f5f5f5"/><text x="50" y="50" text-anchor="middle" fill="%23999" font-size="14">图片加载中</text></svg>'
                        }}
                      />
                    </div>
                    <div className="p-3">
                      <p className="text-sm text-zinc-700 line-clamp-2">{image.prompt}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          image.is_public ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-600'
                        }`}>
                          {image.is_public ? '已公开' : '待审核'}
                        </span>
                        <span className="text-xs text-zinc-400">
                          {new Date(image.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
