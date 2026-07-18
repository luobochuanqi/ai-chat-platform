import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../services/api'

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

export default function AdminPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'users' | 'images' | 'stats'>('users')
  const [users, setUsers] = useState<User[]>([])
  const [images, setImages] = useState<GalleryImage[]>([])
  const [stats, setStats] = useState<any>(null)
  const [bulkInput, setBulkInput] = useState('')
  const [defaultPassword, setDefaultPassword] = useState('student123')

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/chat')
      return
    }
    loadData()
  }, [activeTab])

  const loadData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'users') {
        const response = await api.get('/users/list')
        setUsers(response.data.users)
      } else if (activeTab === 'images') {
        const response = await api.get('/images/admin/all')
        setImages(response.data)
      } else if (activeTab === 'stats') {
        const response = await api.get('/admin/stats')
        setStats(response.data)
      }
    } catch (error) {
      console.error('Failed to load admin data:', error)
    } finally {
      setLoading(false)
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

  return (
    <div className="flex h-screen bg-zinc-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-zinc-200 flex flex-col">
        <div className="p-4 border-b border-zinc-200">
          <h1 className="text-lg font-bold text-zinc-900">AI 探索平台</h1>
          <p className="text-sm text-zinc-500">{user?.nickname} (管理员)</p>
        </div>
        
        <div className="p-3 border-t border-zinc-200 space-y-1">
          <button onClick={() => navigate('/chat')} className="w-full text-left px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition">
            AI 对话
          </button>
          <button onClick={() => navigate('/image')} className="w-full text-left px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition">
            AI 生图
          </button>
          <button onClick={() => navigate('/gallery')} className="w-full text-left px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition">
            作品墙
          </button>
          <button onClick={() => navigate('/admin')} className="w-full text-left px-3 py-2 text-sm font-medium text-accent-700 bg-accent-50 rounded-lg">
            管理后台
          </button>
        </div>
        
        <div className="p-3 border-t border-zinc-200 mt-auto">
          <button onClick={logout} className="w-full text-left px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition">
            退出登录
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="bg-white border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'users' ? 'bg-accent-50 text-accent-700' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              用户管理
            </button>
            <button
              onClick={() => setActiveTab('images')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'images' ? 'bg-accent-50 text-accent-700' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              作品审核
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'stats' ? 'bg-accent-50 text-accent-700' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              数据统计
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'users' && (
            <div className="space-y-6">
              {/* Bulk Create */}
              <div className="bg-white rounded-xl border border-zinc-200 p-6">
                <h3 className="text-lg font-semibold text-zinc-900 mb-4">批量创建账号</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">默认密码</label>
                    <input
                      type="text"
                      value={defaultPassword}
                      onChange={(e) => setDefaultPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-accent-500 outline-none"
                    />
                  </div>
                </div>
                <textarea
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder="每行一个账号，格式：用户名,昵称&#10;例如：&#10;student01,张三&#10;student02,李四"
                  rows={5}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg resize-none focus:ring-2 focus:ring-accent-500 outline-none mb-4"
                />
                <button
                  onClick={handleBulkCreate}
                  className="px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 transition"
                >
                  批量创建
                </button>
              </div>
              
              {/* User List */}
              <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
                <div className="p-4 border-b border-zinc-200">
                  <h3 className="text-lg font-semibold text-zinc-900">用户列表</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-zinc-700">用户名</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-zinc-700">昵称</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-zinc-700">对话额度</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-zinc-700">生图额度</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-zinc-700">状态</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-zinc-700">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td className="px-4 py-3 text-sm text-zinc-900">{u.username}</td>
                          <td className="px-4 py-3 text-sm text-zinc-600">{u.nickname}</td>
                          <td className="px-4 py-3 text-sm text-zinc-600">
                            {u.chat_used} / {u.chat_quota}
                          </td>
                          <td className="px-4 py-3 text-sm text-zinc-600">
                            {u.image_used} / {u.image_quota}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {u.is_active ? '启用' : '禁用'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <button
                              onClick={() => handleToggleUser(u.id)}
                              className="text-accent-600 hover:text-accent-700 mr-3"
                            >
                              {u.is_active ? '禁用' : '启用'}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="text-red-600 hover:text-red-700"
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
            </div>
          )}
          
          {activeTab === 'images' && (
            <div className="bg-white rounded-xl border border-zinc-200 p-6">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">作品审核</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {images.map((image) => (
                  <div key={image.id} className="border border-zinc-200 rounded-lg overflow-hidden">
                    <div className="aspect-square bg-zinc-100">
                      <img
                        src={image.image_url}
                        alt={image.prompt}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-3">
                      <p className="text-sm text-zinc-700 line-clamp-2 mb-2">{image.prompt}</p>
                      <p className="text-xs text-zinc-500 mb-2">作者: {image.user_nickname}</p>
                      <div className="flex gap-2">
                        {!image.is_public ? (
                          <button
                            onClick={() => handlePublishImage(image.id)}
                            className="flex-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
                          >
                            公开
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUnpublishImage(image.id)}
                            className="flex-1 px-3 py-1.5 bg-zinc-600 text-white text-sm rounded-lg hover:bg-zinc-700 transition"
                          >
                            取消公开
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {activeTab === 'stats' && stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-zinc-200 p-6">
                <p className="text-sm text-zinc-500">总用户数</p>
                <p className="text-3xl font-bold text-zinc-900 mt-2">{stats.total_users}</p>
              </div>
              <div className="bg-white rounded-xl border border-zinc-200 p-6">
                <p className="text-sm text-zinc-500">总会话数</p>
                <p className="text-3xl font-bold text-zinc-900 mt-2">{stats.total_sessions}</p>
              </div>
              <div className="bg-white rounded-xl border border-zinc-200 p-6">
                <p className="text-sm text-zinc-500">总图片数</p>
                <p className="text-3xl font-bold text-zinc-900 mt-2">{stats.total_images}</p>
              </div>
              <div className="bg-white rounded-xl border border-zinc-200 p-6">
                <p className="text-sm text-zinc-500">公开作品数</p>
                <p className="text-3xl font-bold text-zinc-900 mt-2">{stats.public_images}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
