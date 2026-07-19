import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../services/api'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import { Zoom } from 'yet-another-react-lightbox/plugins'
import { Heart, ImageOff } from 'lucide-react'

type SortOption = 'newest' | 'oldest' | 'most_liked'

interface GalleryImage {
  id: number
  prompt: string
  image_url: string
  likes: number
  created_at: string
  user_nickname: string
  is_liked?: boolean
}

export default function GalleryPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [images, setImages] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  useEffect(() => {
    loadGallery()
  }, [])

  const loadGallery = async () => {
    try {
      setLoading(true)
      const response = await api.get('/images/gallery')
      setImages(response.data)
    } catch (error) {
      console.error('Failed to load gallery:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLike = async (imageId: number) => {
    try {
      const response = await api.post('/images/like', { image_id: imageId })
      const { liked, likes } = response.data
      setImages(prev => prev.map(img => 
        img.id === imageId ? { ...img, likes, is_liked: liked } : img
      ))
    } catch (error) {
      console.error('Failed to like image:', error)
    }
  }

  const sortedImages = [...images].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'oldest':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case 'most_liked':
        return b.likes - a.likes
      default:
        return 0
    }
  })

  const openLightbox = (index: number) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  const lightboxSlides = sortedImages.map(img => ({
    src: img.image_url,
    alt: img.prompt,
    title: img.prompt,
  }))

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
          <button onClick={() => navigate('/image')} className="w-full text-left px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition">
            AI 生图
          </button>
          <button onClick={() => navigate('/gallery')} className="w-full text-left px-3 py-2 text-sm font-medium text-accent-700 bg-accent-50 rounded-lg">
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
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900">作品墙</h2>
              <p className="text-zinc-500 mt-1">欣赏同学们的 AI 创作作品</p>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-accent-500 focus:border-transparent outline-none"
            >
              <option value="newest">最新发布</option>
              <option value="oldest">最早发布</option>
              <option value="most_liked">最多点赞</option>
            </select>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-600" />
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-12">
              <ImageOff className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <p className="text-zinc-500">作品墙还没有作品，快去创作吧！</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {sortedImages.map((image, index) => (
                <div 
                  key={image.id} 
                  className="bg-white rounded-xl border border-zinc-200 overflow-hidden hover:shadow-lg hover:scale-[1.02] transition-all duration-300 cursor-pointer group"
                  onClick={() => openLightbox(index)}
                >
                  <div className="aspect-square bg-zinc-100 relative overflow-hidden">
                    <img
                      src={image.image_url}
                      alt={image.prompt}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23f5f5f5"/><text x="50" y="50" text-anchor="middle" fill="%23999" font-size="14">图片加载中</text></svg>'
                      }}
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-sm text-zinc-700 line-clamp-2 mb-2">{image.prompt}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-accent-100 flex items-center justify-center">
                          <span className="text-xs font-medium text-accent-700">
                            {image.user_nickname.charAt(0)}
                          </span>
                        </div>
                        <span className="text-sm text-zinc-600">{image.user_nickname}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleLike(image.id)
                        }}
                        className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm transition ${
                          image.is_liked
                            ? 'bg-red-50 text-red-500'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-red-50 hover:text-red-500'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${image.is_liked ? 'fill-red-500' : ''}`} />
                        {image.likes}
                      </button>
                    </div>
                    <p className="text-xs text-zinc-400 mt-2">
                      {new Date(image.created_at).toLocaleDateString()} {new Date(image.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={lightboxSlides}
        index={lightboxIndex}
        plugins={[Zoom]}
        zoom={{ maxZoomPixelRatio: 3 }}
      />
    </div>
  )
}
