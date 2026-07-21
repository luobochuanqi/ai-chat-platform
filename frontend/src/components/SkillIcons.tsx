import { ReactNode } from 'react'

/** 一次 skill 调用的记录（对应后端 ChatMessage.tool_calls 数组元素） */
export interface ToolCall {
  name: string
  args: Record<string, unknown>
  result: string
  ok: boolean
}

/** 计算器图标：外框 + 屏幕 + 两排按键 */
export function CalculatorIcon({ className }: { className?: string }): ReactNode {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <rect x="7" y="5" width="10" height="3" rx="0.5" />
      <circle cx="8.5" cy="12" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="12" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="16" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="16" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="16" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** 时钟图标：表盘 + 指针 */
export function ClockIcon({ className }: { className?: string }): ReactNode {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  )
}

/** 骰子图标：五点 */
export function DiceIcon({ className }: { className?: string }): ReactNode {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="8" cy="16" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** skill 元数据：名称、中文标签、说明、图标 */
export interface SkillDef {
  name: string
  label: string
  desc: string
  icon: (props: { className?: string }) => ReactNode
  colorClass: string
}

/** 前端已知的 skill 列表，须与后端 SKILL_REGISTRY 保持一致 */
export const SKILLS: SkillDef[] = [
  {
    name: 'calculator',
    label: '计算器',
    desc: '精确计算，AI 容易算错的大数也能秒算',
    icon: CalculatorIcon,
    colorClass: 'text-mauve',
  },
  {
    name: 'get_current_time',
    label: '当前时间',
    desc: '知道今天是星期几、现在几点几分',
    icon: ClockIcon,
    colorClass: 'text-peach',
  },
  {
    name: 'random_generator',
    label: '随机数',
    desc: '掷骰子、抽签，真正的随机',
    icon: DiceIcon,
    colorClass: 'text-green',
  },
]

/** 在 assistant 消息上方展示「调用了哪个 skill 及结果」的小标签 */
export function ToolCallBadge({ toolCall }: { toolCall: ToolCall }) {
  const skill = SKILLS.find((s) => s.name === toolCall.name)
  const Icon = skill?.icon
  const label = skill?.label ?? toolCall.name
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-mantle border border-surface2 rounded text-xs text-subtext1">
      {Icon && <Icon className={`w-3.5 h-3.5 ${skill?.colorClass ?? 'text-mauve'} shrink-0`} />}
      <span className="font-medium text-ctext shrink-0">调用 {label}</span>
      <span className="text-overlay0 shrink-0">→</span>
      <span className="font-mono text-subtext0 truncate">{toolCall.result}</span>
    </div>
  )
}
