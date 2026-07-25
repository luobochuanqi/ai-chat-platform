import { useState, useEffect } from 'react'
import api from '../services/api'
import { AppLayout } from '../components/layout/AppLayout'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import { Zoom } from 'yet-another-react-lightbox/plugins'
import Captions from 'yet-another-react-lightbox/plugins/captions'
import 'yet-another-react-lightbox/plugins/captions.css'
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
  const [images, setImages] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [expandedPrompts, setExpandedPrompts] = useState<Set<number>>(new Set())

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

  const togglePromptExpand = (id: number) => {
    setExpandedPrompts(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const lightboxSlides = sortedImages.map(img => ({
    src: img.image_url,
    alt: img.prompt,
    title: img.user_nickname,
    description: img.prompt,
  }))

  return (
    <AppLayout>
      <div className="h-full overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-ctext">作品墙</h2>
              <p className="text-subtext0 mt-1">欣赏同学们的 AI 创作作品</p>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 border border-surface2 rounded-lg text-sm focus:border-mauve focus:ring-1 focus:ring-mauve outline-none"
            >
              <option value="newest">最新发布</option>
              <option value="oldest">最早发布</option>
              <option value="most_liked">最多点赞</option>
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mauve" />
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-12">
              <ImageOff className="w-12 h-12 text-overlay0 mx-auto mb-3" />
              <p className="text-subtext0">作品墙还没有作品，快去创作吧！</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {sortedImages.map((image, index) => (
                <div
                  key={image.id}
                  className="bg-base rounded border border-surface2 overflow-hidden hover:scale-[1.02] transition-all duration-300 cursor-pointer group"
                  onClick={() => openLightbox(index)}
                >
                  <div className="aspect-square bg-surface0 relative overflow-hidden">
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
                    <p
                      className={`text-sm text-subtext1 mb-2 cursor-pointer hover:text-ctext transition ${expandedPrompts.has(image.id) ? '' : 'line-clamp-2'}`}
                      onClick={(e) => { e.stopPropagation(); togglePromptExpand(image.id) }}
                      title="点击展开/收起完整提示词"
                    >
                      {image.prompt}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-mauve/15 flex items-center justify-center">
                          <span className="text-xs font-medium text-mauve">
                            {image.user_nickname.charAt(0)}
                          </span>
                        </div>
                        <span className="text-sm text-subtext1">{image.user_nickname}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleLike(image.id)
                        }}
                        className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm transition ${
                          image.is_liked
                            ? 'bg-red/10 text-red'
                            : 'bg-surface0 text-subtext1 hover:bg-red/10 hover:text-red'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${image.is_liked ? 'fill-red' : ''}`} />
                        {image.likes}
                      </button>
                    </div>
                    <p className="text-xs text-overlay0 mt-2">
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
        plugins={[Zoom, Captions]}
        zoom={{ maxZoomPixelRatio: 3 }}
      />
    </AppLayout>
  )
}
