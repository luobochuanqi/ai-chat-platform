import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../services/api'
import { AppLayout } from '../components/layout/AppLayout'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import { Zoom } from 'yet-another-react-lightbox/plugins'
import { CheckSquare, Square, Eye, Users, MessageSquare, ImageIcon, Heart, AlertCircle, FileText, Plus, Trash2, Edit3 } from 'lucide-react'

interface User {
  id: number
  username: string
  nickname: string
  is_admin: boolean
  is_active: boolean
  chat_quota: number
  image_quota: number
  chat_used: number
  image_used: number
  created_at: string
}

interface GalleryImage {
  id: number
  prompt: string
  image_url: string
  is_public: boolean
  likes: number
  created_at: string
  user_nickname: string
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

type SortOption = 'newest' | 'oldest' | 'most_liked'

export default function AdminPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'users' | 'images' | 'stats' | 'prompts'>('users')
  const [users, setUsers] = useState<User[]>([])
  const [images, setImages] = useState<GalleryImage[]>([])
  const [stats, setStats] = useState<any>(null)
  const [bulkInput, setBulkInput] = useState('')
  const [defaultPassword, setDefaultPassword] = useState('student123')
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set())
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  
  // System prompt management
  const [prompts, setPrompts] = useState<SystemPromptItem[]>([])
  const [showPromptForm, setShowPromptForm] = useState(false)
  const [editingPromptId, setEditingPromptId] = useState<number | null>(null)
  const [promptName, setPromptName] = useState('')
  const [promptDesc, setPromptDesc] = useState('')
  const [promptContent, setPromptContent] = useState('')

  // 用户额度管理 state
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set())
  const [batchChatQuota, setBatchChatQuota] = useState('')
  const [batchImageQuota, setBatchImageQuota] = useState('')
  const [batchResetUsed, setBatchResetUsed] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editChatQuota, setEditChatQuota] = useState('')
  const [editImageQuota, setEditImageQuota] = useState('')
  const [editResetUsed, setEditResetUsed] = useState(false)

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/chat')
      return
    }
    loadData()
  }, [activeTab])

  const loadData = async () => {
    try {
      if (activeTab === 'users') {
        const response = await api.get('/users/list')
        setUsers(response.data.users)
        setSelectedUsers(new Set())
      } else if (activeTab === 'images') {
        const response = await api.get('/images/admin/all')
        setImages(response.data)
        setSelectedImages(new Set())
      } else if (activeTab === 'stats') {
        const response = await api.get('/admin/stats')
        setStats(response.data)
      } else if (activeTab === 'prompts') {
        const response = await api.get('/chat/system-prompts/admin/all')
        setPrompts(response.data)
      }
    } catch (error) {
      console.error('Failed to load admin data:', error)
    }
  }

  const handleBulkCreate = async () => {
    try {
      const lines = bulkInput.split('\n').filter(line => line.trim())
      const newUsers = lines.map(line => {
        const parts = line.split(/[,，\t]+/)
        const username = parts[0].trim()
        const nickname = parts[1]?.trim() || username
        return {
          username,
          nickname,
          password: defaultPassword,
          is_admin: false
        }
      })
      
      if (newUsers.length === 0) return
      
      await api.post('/users/create-bulk', newUsers)
      setBulkInput('')
      loadData()
      alert(`成功创建 ${newUsers.length} 个账号`)
    } catch (error) {
      console.error('Failed to create users:', error)
      alert('创建账号失败')
    }
  }

  const handleToggleUser = async (userId: number) => {
    if (!window.confirm('确定要切换该用户状态吗？')) return
    try {
      await api.put(`/users/${userId}/toggle`)
      loadData()
    } catch (error) {
      console.error('Failed to toggle user:', error)
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm('确定要删除该用户吗？此操作不可恢复。')) return
    try {
      await api.delete(`/users/${userId}`)
      loadData()
    } catch (error) {
      console.error('Failed to delete user:', error)
    }
  }

  // 用户额度管理 handlers
  const toggleSelectUser = (userId: number) => {
    setSelectedUsers(prev => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const toggleSelectAllUsers = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)))
    }
  }

  const handleBatchQuota = async () => {
    if (selectedUsers.size === 0) return
    const payload: Record<string, number | number[]> = { user_ids: Array.from(selectedUsers) }
    if (batchChatQuota.trim()) payload.chat_quota = parseInt(batchChatQuota)
    if (batchImageQuota.trim()) payload.image_quota = parseInt(batchImageQuota)
    if (batchResetUsed) {
      payload.chat_used = 0
      payload.image_used = 0
    }
    // 没有任何有效操作则跳过
    if (payload.chat_quota === undefined && payload.image_quota === undefined && !batchResetUsed) {
      return
    }
    try {
      await api.post('/users/batch-quota', payload)
      setSelectedUsers(new Set())
      setBatchChatQuota('')
      setBatchImageQuota('')
      setBatchResetUsed(false)
      loadData()
    } catch (error) {
      console.error('[AdminPage] 批量更新额度失败:', error)
    }
  }

  const openEditUser = (u: User) => {
    setEditingUser(u)
    setEditChatQuota(String(u.chat_quota))
    setEditImageQuota(String(u.image_quota))
    setEditResetUsed(false)
  }

  const handleSaveUserQuota = async () => {
    if (!editingUser) return
    const payload: Record<string, number> = {}
    if (editChatQuota.trim()) payload.chat_quota = parseInt(editChatQuota)
    if (editImageQuota.trim()) payload.image_quota = parseInt(editImageQuota)
    if (editResetUsed) {
      payload.chat_used = 0
      payload.image_used = 0
    }
    try {
      await api.put(`/users/${editingUser.id}/quota`, payload)
      setEditingUser(null)
      loadData()
    } catch (error) {
      console.error('[AdminPage] 更新用户额度失败:', error)
    }
  }

  const handlePublishImage = async (imageId: number) => {
    try {
      await api.put(`/images/${imageId}/publish`)
      loadData()
    } catch (error) {
      console.error('Failed to publish image:', error)
    }
  }

  const handleUnpublishImage = async (imageId: number) => {
    try {
      await api.put(`/images/${imageId}/unpublish`)
      loadData()
    } catch (error) {
      console.error('Failed to unpublish image:', error)
    }
  }

  const toggleSelectImage = (imageId: number) => {
    setSelectedImages(prev => {
      const next = new Set(prev)
      if (next.has(imageId)) {
        next.delete(imageId)
      } else {
        next.add(imageId)
      }
      return next
    })
  }

  const selectAll = () => {
    if (selectedImages.size === sortedImages.length) {
      setSelectedImages(new Set())
    } else {
      setSelectedImages(new Set(sortedImages.map(img => img.id)))
    }
  }

  const handleBatchPublish = async () => {
    if (selectedImages.size === 0) return
    try {
      await api.post('/images/batch-publish', { image_ids: Array.from(selectedImages) })
      setSelectedImages(new Set())
      loadData()
    } catch (error) {
      console.error('Failed to batch publish:', error)
    }
  }

  const handleBatchUnpublish = async () => {
    if (selectedImages.size === 0) return
    try {
      await api.post('/images/batch-unpublish', { image_ids: Array.from(selectedImages) })
      setSelectedImages(new Set())
      loadData()
    } catch (error) {
      console.error('Failed to batch unpublish:', error)
    }
  }

  // Prompt management handlers
  const handleAddPrompt = async () => {
    if (!promptName.trim() || !promptContent.trim()) return
    try {
      await api.post('/chat/system-prompts/builtin', {
        name: promptName.trim(),
        description: promptDesc.trim(),
        prompt: promptContent.trim()
      })
      resetPromptForm()
      loadData()
    } catch (error) {
      console.error('Failed to add prompt:', error)
    }
  }

  const handleEditPrompt = (prompt: SystemPromptItem) => {
    setEditingPromptId(prompt.id)
    setPromptName(prompt.name)
    setPromptDesc(prompt.description || '')
    setPromptContent(prompt.prompt)
    setShowPromptForm(true)
  }

  const handleUpdatePrompt = async () => {
    if (!editingPromptId || !promptName.trim() || !promptContent.trim()) return
    try {
      await api.put(`/chat/system-prompts/admin/${editingPromptId}`, {
        name: promptName.trim(),
        description: promptDesc.trim(),
        prompt: promptContent.trim()
      })
      resetPromptForm()
      loadData()
    } catch (error) {
      console.error('Failed to update prompt:', error)
    }
  }

  const handleDeletePrompt = async (promptId: number) => {
    if (!window.confirm('确定要删除这个提示词吗？')) return
    try {
      await api.delete(`/chat/system-prompts/admin/${promptId}`)
      loadData()
    } catch (error) {
      console.error('Failed to delete prompt:', error)
    }
  }

  const resetPromptForm = () => {
    setShowPromptForm(false)
    setEditingPromptId(null)
    setPromptName('')
    setPromptDesc('')
    setPromptContent('')
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
    <AppLayout>
      <div className="flex-1 flex flex-col overflow-hidden h-full">
        {/* Tabs */}
        <div className="bg-base border-b border-surface2 px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'users' ? 'bg-mauve/10 text-mauve' : 'text-subtext1 hover:bg-surface0'
              }`}
            >
              <Users className="w-4 h-4" />
              用户管理
            </button>
            <button
              onClick={() => setActiveTab('images')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'images' ? 'bg-mauve/10 text-mauve' : 'text-subtext1 hover:bg-surface0'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              作品审核
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'stats' ? 'bg-mauve/10 text-mauve' : 'text-subtext1 hover:bg-surface0'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              数据统计
            </button>
            <button
              onClick={() => setActiveTab('prompts')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'prompts' ? 'bg-mauve/10 text-mauve' : 'text-subtext1 hover:bg-surface0'
              }`}
            >
              <FileText className="w-4 h-4" />
              提示词管理
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'users' && (
            <div className="space-y-6">
              {/* Bulk Create */}
              <div className="bg-base rounded border border-surface2 p-6">
                <h3 className="text-lg font-semibold text-ctext mb-4">批量创建账号</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-subtext1 mb-1">默认密码</label>
                    <input
                      type="text"
                      value={defaultPassword}
                      onChange={(e) => setDefaultPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-surface2 rounded-lg focus:border-mauve focus:ring-1 focus:ring-mauve outline-none"
                    />
                  </div>
                </div>
                <textarea
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder="每行一个账号，格式：用户名,昵称&#10;例如：&#10;student01,张三&#10;student02,李四"
                  rows={5}
                  className="w-full px-3 py-2 border border-surface2 rounded-lg resize-none focus:border-mauve focus:ring-1 focus:ring-mauve outline-none mb-4"
                />
                <button
                  onClick={handleBulkCreate}
                  className="px-4 py-2 bg-mauve text-base rounded-lg hover:bg-mauve/90 transition"
                >
                  批量创建
                </button>
              </div>
              
              {/* User List */}
              <div className="bg-base rounded border border-surface2 overflow-hidden">
                <div className="p-4 border-b border-surface2 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-ctext">用户列表</h3>
                  {selectedUsers.size > 0 && (
                    <span className="text-sm text-subtext1">已选 {selectedUsers.size} 人</span>
                  )}
                </div>

                {/* 批量操作栏（选中用户时显示） */}
                {selectedUsers.size > 0 && (
                  <div className="p-4 bg-mantle border-b border-surface2">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="text-sm font-medium text-ctext">批量操作:</span>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-subtext1">对话额度设为</label>
                        <input
                          type="number"
                          value={batchChatQuota}
                          onChange={(e) => setBatchChatQuota(e.target.value)}
                          placeholder="留空不改"
                          className="w-24 px-2 py-1 border border-surface2 rounded text-sm focus:border-mauve focus:ring-1 focus:ring-mauve outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-subtext1">生图额度设为</label>
                        <input
                          type="number"
                          value={batchImageQuota}
                          onChange={(e) => setBatchImageQuota(e.target.value)}
                          placeholder="留空不改"
                          className="w-24 px-2 py-1 border border-surface2 rounded text-sm focus:border-mauve focus:ring-1 focus:ring-mauve outline-none"
                        />
                      </div>
                      <label className="flex items-center gap-1.5 text-sm text-subtext1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={batchResetUsed}
                          onChange={(e) => setBatchResetUsed(e.target.checked)}
                          className="cursor-pointer"
                        />
                        重置已用量
                      </label>
                      <button
                        onClick={handleBatchQuota}
                        className="px-4 py-1.5 bg-mauve text-base rounded text-sm hover:bg-mauve/90 transition"
                      >
                        批量应用
                      </button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-mantle">
                      <tr>
                        <th className="px-4 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={selectedUsers.size > 0 && selectedUsers.size === users.length}
                            onChange={toggleSelectAllUsers}
                            className="cursor-pointer"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-subtext1">用户名</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-subtext1">昵称</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-subtext1">对话额度</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-subtext1">生图额度</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-subtext1">状态</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-subtext1">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface2">
                      {users.map((u) => (
                        <tr key={u.id} className={selectedUsers.has(u.id) ? 'bg-mauve/5' : ''}>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedUsers.has(u.id)}
                              onChange={() => toggleSelectUser(u.id)}
                              className="cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-ctext">{u.username}</td>
                          <td className="px-4 py-3 text-sm text-subtext1">{u.nickname}</td>
                          <td className="px-4 py-3 text-sm text-subtext1">
                            {u.chat_used} / {u.chat_quota}
                          </td>
                          <td className="px-4 py-3 text-sm text-subtext1">
                            {u.image_used} / {u.image_quota}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              u.is_active ? 'bg-green/15 text-green' : 'bg-red/15 text-red'
                            }`}>
                              {u.is_active ? '启用' : '禁用'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            <button
                              onClick={() => openEditUser(u)}
                              className="text-mauve hover:text-mauve mr-3"
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => handleToggleUser(u.id)}
                              className="text-subtext1 hover:text-ctext mr-3"
                            >
                              {u.is_active ? '禁用' : '启用'}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="text-red hover:text-red"
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 单用户额度编辑弹窗 */}
              {editingUser && (
                <div
                  className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                  onClick={() => setEditingUser(null)}
                >
                  <div
                    className="bg-base rounded-lg border border-surface2 p-6 w-96 max-w-[90vw]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className="text-lg font-semibold text-ctext mb-1">编辑额度</h3>
                    <p className="text-sm text-subtext0 mb-4">
                      {editingUser.nickname}（{editingUser.username}）
                    </p>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-subtext1 mb-1">对话额度上限</label>
                        <input
                          type="number"
                          value={editChatQuota}
                          onChange={(e) => setEditChatQuota(e.target.value)}
                          className="w-full px-3 py-2 border border-surface2 rounded-lg focus:border-mauve focus:ring-1 focus:ring-mauve outline-none"
                        />
                        <p className="text-xs text-overlay0 mt-1">当前已用: {editingUser.chat_used}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-subtext1 mb-1">生图额度上限</label>
                        <input
                          type="number"
                          value={editImageQuota}
                          onChange={(e) => setEditImageQuota(e.target.value)}
                          className="w-full px-3 py-2 border border-surface2 rounded-lg focus:border-mauve focus:ring-1 focus:ring-mauve outline-none"
                        />
                        <p className="text-xs text-overlay0 mt-1">当前已用: {editingUser.image_used}</p>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-subtext1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editResetUsed}
                          onChange={(e) => setEditResetUsed(e.target.checked)}
                          className="cursor-pointer"
                        />
                        重置已用量（把 used 清零）
                      </label>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                      <button
                        onClick={() => setEditingUser(null)}
                        className="px-4 py-2 text-subtext1 hover:bg-surface0 rounded-lg transition"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleSaveUserQuota}
                        className="px-4 py-2 bg-mauve text-base rounded-lg hover:bg-mauve/90 transition"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'images' && (
            <div className="space-y-4">
              {/* Batch Actions */}
              <div className="bg-base rounded border border-surface2 p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={selectAll}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-subtext1 hover:bg-surface0 rounded-lg transition"
                  >
                    {selectedImages.size === sortedImages.length ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    {selectedImages.size === sortedImages.length ? '取消全选' : '全选'}
                  </button>
                  <span className="text-sm text-subtext0">
                    已选择 {selectedImages.size} / {sortedImages.length} 个作品
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="px-3 py-2 border border-surface2 rounded-lg text-sm focus:border-mauve focus:ring-1 focus:ring-mauve outline-none"
                  >
                    <option value="newest">最新发布</option>
                    <option value="oldest">最早发布</option>
                    <option value="most_liked">最多点赞</option>
                  </select>
                  {selectedImages.size > 0 && (
                    <>
                      <button
                        onClick={handleBatchPublish}
                        className="px-4 py-2 bg-green text-base text-sm rounded-lg hover:bg-green/90 transition"
                      >
                        批量公开
                      </button>
                      <button
                        onClick={handleBatchUnpublish}
                        className="px-4 py-2 bg-surface1 text-ctext text-sm rounded-lg hover:bg-surface2 transition"
                      >
                        批量取消
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              {/* Image Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {sortedImages.map((image, index) => (
                  <div 
                    key={image.id} 
                    className={`bg-base rounded border overflow-hidden transition-all duration-300 cursor-pointer group ${
                      selectedImages.has(image.id) ? 'border-mauve ring-2 ring-mauve' : 'border-surface2'
                    }`}
                    onClick={() => openLightbox(index)}
                  >
                    <div className="relative">
                      <div className="aspect-square bg-surface0">
                        <img
                          src={image.image_url}
                          alt={image.prompt}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div 
                        className="absolute top-2 left-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSelectImage(image.id)
                        }}
                      >
                        {selectedImages.has(image.id) ? (
                          <CheckSquare className="w-5 h-5 text-mauve" />
                        ) : (
                          <Square className="w-5 h-5 text-white/70" />
                        )}
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-sm text-subtext1 line-clamp-2 mb-2">{image.prompt}</p>
                      <p className="text-xs text-subtext0 mb-2">作者: {image.user_nickname}</p>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          image.is_public ? 'bg-green/15 text-green' : 'bg-surface0 text-subtext1'
                        }`}>
                          {image.is_public ? '已公开' : '未公开'}
                        </span>
                        <div className="flex gap-1">
                          {!image.is_public ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handlePublishImage(image.id)
                              }}
                              className="px-3 py-1.5 bg-green text-base text-sm rounded-lg hover:bg-green/90 transition"
                            >
                              公开
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUnpublishImage(image.id)
                              }}
                              className="px-3 py-1.5 bg-surface1 text-ctext text-sm rounded-lg hover:bg-surface2 transition"
                            >
                              取消
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {activeTab === 'stats' && stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-base rounded border border-surface2 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue/15 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue" />
                  </div>
                  <div>
                    <p className="text-sm text-subtext0">总用户数</p>
                    <p className="text-2xl font-bold text-ctext">{stats.total_users}</p>
                  </div>
                </div>
              </div>
              <div className="bg-base rounded border border-surface2 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-mauve/15 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-mauve" />
                  </div>
                  <div>
                    <p className="text-sm text-subtext0">总会话数</p>
                    <p className="text-2xl font-bold text-ctext">{stats.total_sessions}</p>
                  </div>
                </div>
              </div>
              <div className="bg-base rounded border border-surface2 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-pink/15 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-pink" />
                  </div>
                  <div>
                    <p className="text-sm text-subtext0">总图片数</p>
                    <p className="text-2xl font-bold text-ctext">{stats.total_images}</p>
                  </div>
                </div>
              </div>
              <div className="bg-base rounded border border-surface2 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green/15 flex items-center justify-center">
                    <Eye className="w-5 h-5 text-green" />
                  </div>
                  <div>
                    <p className="text-sm text-subtext0">公开作品数</p>
                    <p className="text-2xl font-bold text-ctext">{stats.public_images}</p>
                  </div>
                </div>
              </div>
              <div className="bg-base rounded border border-surface2 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red/15 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-red" />
                  </div>
                  <div>
                    <p className="text-sm text-subtext0">总点赞数</p>
                    <p className="text-2xl font-bold text-ctext">{stats.total_likes || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-base rounded border border-surface2 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-yellow/15 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-yellow" />
                  </div>
                  <div>
                    <p className="text-sm text-subtext0">额度耗尽用户</p>
                    <p className="text-2xl font-bold text-ctext">{stats.quota_exhausted_users || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-base rounded border border-surface2 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-peach/15 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-peach" />
                  </div>
                  <div>
                    <p className="text-sm text-subtext0">待审核作品</p>
                      <p className="text-2xl font-bold text-ctext">{stats.pending_images || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'prompts' && (
            <div className="space-y-4">
              <div className="bg-base rounded border border-surface2 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-ctext">系统提示词管理</h3>
                    <p className="text-sm text-subtext0 mt-1">管理预置和用户创建的提示词</p>
                  </div>
                  <button
                    onClick={() => {
                      resetPromptForm()
                      setShowPromptForm(true)
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-mauve text-base rounded-lg hover:bg-mauve/90 transition"
                  >
                    <Plus className="w-4 h-4" />
                    添加提示词
                  </button>
                </div>

                {showPromptForm && (
                  <div className="mb-6 p-4 bg-mantle rounded space-y-3">
                    <h4 className="font-medium text-ctext">
                      {editingPromptId ? '编辑提示词' : '添加新提示词'}
                    </h4>
                    <input
                      value={promptName}
                      onChange={(e) => setPromptName(e.target.value)}
                      placeholder="名称"
                      className="w-full px-3 py-2 border border-surface2 rounded-lg focus:border-mauve focus:ring-1 focus:ring-mauve outline-none"
                    />
                    <input
                      value={promptDesc}
                      onChange={(e) => setPromptDesc(e.target.value)}
                      placeholder="描述（可选）"
                      className="w-full px-3 py-2 border border-surface2 rounded-lg focus:border-mauve focus:ring-1 focus:ring-mauve outline-none"
                    />
                    <textarea
                      value={promptContent}
                      onChange={(e) => setPromptContent(e.target.value)}
                      placeholder="提示词内容"
                      rows={4}
                      className="w-full px-3 py-2 border border-surface2 rounded-lg resize-none focus:border-mauve focus:ring-1 focus:ring-mauve outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={editingPromptId ? handleUpdatePrompt : handleAddPrompt}
                        disabled={!promptName.trim() || !promptContent.trim()}
                        className="px-4 py-2 bg-mauve text-base rounded-lg hover:bg-mauve/90 transition disabled:opacity-50"
                      >
                        {editingPromptId ? '保存修改' : '添加'}
                      </button>
                      <button onClick={resetPromptForm} className="px-4 py-2 text-subtext1 hover:bg-surface1 rounded-lg transition">
                        取消
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {prompts.length === 0 ? (
                    <p className="text-sm text-overlay0 text-center py-8">暂无提示词</p>
                  ) : (
                    prompts.map((p) => (
                      <div key={p.id} className="flex items-start justify-between p-4 bg-mantle rounded hover:bg-surface0 transition">
                        <div className="flex-1 min-w-0 mr-4">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-ctext">{p.name}</h4>
                            {p.is_builtin && <span className="text-xs px-1.5 py-0.5 bg-mauve/15 text-mauve rounded">预置</span>}
                            {p.user_id && !p.is_builtin && <span className="text-xs px-1.5 py-0.5 bg-blue/15 text-blue rounded">用户</span>}
                          </div>
                          {p.description && <p className="text-sm text-subtext0 mb-1">{p.description}</p>}
                          <p className="text-sm text-subtext1 line-clamp-2 font-mono bg-base p-2 rounded border border-surface2">{p.prompt}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => handleEditPrompt(p)} className="p-1.5 hover:bg-blue/15 rounded-lg transition">
                            <Edit3 className="w-4 h-4 text-blue" />
                          </button>
                          <button onClick={() => handleDeletePrompt(p.id)} className="p-1.5 hover:bg-red/15 rounded-lg transition">
                            <Trash2 className="w-4 h-4 text-red" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
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
    </AppLayout>
  )
}
