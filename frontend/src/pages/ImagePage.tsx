import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import api from '../services/api'
import { AppLayout } from '../components/layout/AppLayout'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import { Zoom } from 'yet-another-react-lightbox/plugins'
import { Loader2, ImageIcon, Wand2, Eye, EyeOff } from 'lucide-react'

interface GeneratedImage {
  id: number
  prompt: string
  image_url: string
  is_public: boolean
  likes: number
  created_at: string
}

function truncatePrompt(prompt: string): string {
  // Count Chinese characters and English characters differently
  let count = 0
  let result = ''
  for (const char of prompt) {
    if (/[一-龥]/.test(char)) {
      if (count + 2 > 300) break
      count += 2
    } else {
      if (count + 1 > 500) break
      count += 1
    }
    result += char
  }
  return result
}

export default function ImagePage() {
  const { user } = useAuthStore()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [error, setError] = useState('')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [isTruncated, setIsTruncated] = useState(false)

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

  const handlePromptChange = (value: string) => {
    const truncated = truncatePrompt(value)
    setPrompt(truncated)
    setIsTruncated(truncated.length < value.length)
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError('')

    try {
      const response = await api.post('/images/generate', { prompt: prompt.trim() })
      setImages([response.data, ...images])
      setPrompt('')
      setIsTruncated(false)
    } catch (err: any) {
      const detail = err.response?.data?.detail
      if (typeof detail === 'string') {
        setError(detail)
      } else if (typeof detail === 'object') {
        setError(JSON.stringify(detail))
      } else {
        setError('生成图片失败')
      }
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

  const openLightbox = (index: number) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  const lightboxSlides = images.map(img => ({
    src: img.image_url,
    alt: img.prompt,
    title: img.prompt,
  }))

  const remainingQuota = (user?.image_quota ?? 0) - (user?.image_used ?? 0)

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col overflow-hidden h-full">
        <div className="bg-base border-b border-surface2 p-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div>
              <h2 className="text-xl font-bold text-ctext">AI 生图</h2>
              <p className="text-sm text-subtext0">
                剩余额度: {remainingQuota} / {user?.image_quota ?? 0} 张
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-base border-b border-surface2">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  value={prompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="描述你想要生成的图片... (例如：一只可爱的猫咪在草地上玩耍)"
                  rows={2}
                  className="w-full px-4 py-3 border border-surface2 rounded resize-none focus:border-mauve focus:ring-1 focus:ring-mauve outline-none transition"
                />
                {isTruncated && (
                  <p className="text-yellow text-xs mt-1">
                    提示词已自动截断至长度限制
                  </p>
                )}
              </div>
              <button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim() || remainingQuota <= 0}
                className="px-6 py-3 bg-mauve text-base rounded font-medium hover:bg-mauve/90 transition disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    生成
                  </>
                )}
              </button>
            </div>
            {error && (
              <div className="mt-2 p-3 bg-red/10 border border-red/30 rounded-lg">
                <p className="text-red text-sm">{error}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-lg font-semibold text-ctext mb-4">我的作品</h3>

            {images.length === 0 ? (
              <div className="text-center py-12">
                <ImageIcon className="w-12 h-12 text-overlay0 mx-auto mb-3" />
                <p className="text-subtext0">还没有生成过图片，快去创作吧！</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((image, index) => (
                  <div
                    key={image.id}
                    className="bg-base rounded border border-surface2 overflow-hidden hover:scale-[1.02] transition-all duration-300 cursor-pointer group"
                    onClick={() => openLightbox(index)}
                  >
                    <div className="aspect-square bg-surface0 flex items-center justify-center relative overflow-hidden">
                      <img
                        src={image.image_url}
                        alt={image.prompt}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23f5f5f5"/><text x="50" y="50" text-anchor="middle" fill="%23999" font-size="14">图片加载中</text></svg>'
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                        <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-sm text-subtext1 line-clamp-2">{image.prompt}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                          image.is_public
                            ? 'bg-green/15 text-green'
                            : 'bg-surface0 text-subtext1'
                        }`}>
                          {image.is_public ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          {image.is_public ? '已公开' : '待审核'}
                        </span>
                        <span className="text-xs text-overlay0">
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

      {/* Lightbox */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={lightboxSlides}
        index={lightboxIndex}
        plugins={[Zoom]}
        zoom={{ maxZoomPixelRatio: 3 }}
      />
    </AppLayout>
  )
}
