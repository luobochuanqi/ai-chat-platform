import { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

/** 导航项（管理后台仅管理员可见） */
const NAV_ITEMS = [
  { path: '/chat', label: 'AI 对话' },
  { path: '/image', label: 'AI 生图' },
  { path: '/gallery', label: '作品墙' },
  { path: '/prompts', label: '提示词市场' },
  { path: '/admin', label: '管理后台', adminOnly: true },
] as const

/**
 * 应用外壳：统一 sidebar（标题/导航/退出）+ main。
 * sidebarExtra 给 ChatPage 放「新建会话 + 会话列表」，其他页面不传。
 * 配色遵循 catppuccin Latte + 编辑纸感（surface 分层 + 细边框，无通用阴影）。
 */
export function AppLayout({
  children,
  sidebarExtra,
}: {
  children: ReactNode
  sidebarExtra?: ReactNode
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()

  const visibleNav = NAV_ITEMS.filter((item) => !('adminOnly' in item && item.adminOnly) || user?.is_admin)

  return (
    <div className="flex h-screen text-ctext relative z-10">
      <aside className="w-64 bg-surface0 border-r-2 border-overlay0 flex flex-col">
        {/* 标题：编辑纸感（衬线 + 小刊号） */}
        <div className="px-4 py-3 border-b border-surface2">
          <h1 className="font-serif text-xl font-bold tracking-tight leading-none">AI <span className="italic text-mauve">探索</span></h1>
          <p className="text-xs text-subtext0 italic mt-1">{user?.nickname}</p>
        </div>

        {/* ChatPage 的会话列表 slot（flex-1 撑开） */}
        {sidebarExtra && <div className="flex-1 overflow-hidden flex flex-col">{sidebarExtra}</div>}

        {/* 导航（当前页 surface0 高亮） */}
        <nav className={['p-3', sidebarExtra ? '' : 'flex-1', 'border-t border-surface2'].join(' ')}>
          <div className="space-y-0.5">
            {visibleNav.map((item) => {
              const active = location.pathname === item.path
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full text-left px-3 py-2 text-sm rounded transition border-l-2 ${
                    active
                      ? 'bg-mantle text-ctext font-medium border-mauve'
                      : 'text-subtext1 hover:bg-mantle/60 hover:text-ctext border-transparent'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </nav>

        {/* 退出 */}
        <div className="p-3 border-t border-surface2">
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 text-sm text-red hover:bg-red/10 rounded transition"
          >
            退出登录
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
