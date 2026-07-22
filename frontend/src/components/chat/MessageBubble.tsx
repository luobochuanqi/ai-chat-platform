import { motion } from 'framer-motion'
import { MarkdownRenderer } from './MarkdownRenderer'
import { ToolCallBadge, ToolCall } from '../SkillIcons'

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

export interface ChatMessageData {
  id: number
  role: string
  content: string
  tool_calls?: ToolCall[]
  search_results?: SearchResult[]
}

/** 单条消息气泡：user（mauve）/ assistant（surface0 + markdown + tool_calls）。
 * framer-motion 入场动效（指数缓动，非 bounce）。 */
export function MessageBubble({ message }: { message: ChatMessageData }) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-3xl px-4 py-3 rounded ${
          isUser
            ? 'bg-mauve text-base shadow-sm'
            : 'bg-surface0 text-ctext border border-surface2 shadow-sm'
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        ) : (
          <div className="text-sm">
            {message.tool_calls && message.tool_calls.length > 0 && (
              <div className="mb-2 space-y-1">
                {message.tool_calls.map((tc, i) => (
                  <ToolCallBadge key={i} toolCall={tc} />
                ))}
              </div>
            )}
            {message.search_results && message.search_results.length > 0 && (
              <div className="mb-2 p-2 bg-mantle border border-surface2 rounded text-xs">
                <div className="text-subtext0 mb-1">参考来源</div>
                {message.search_results.map((r, i) => (
                  <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="block text-mauve hover:underline truncate">
                    [{i + 1}] {r.title || r.url}
                  </a>
                ))}
              </div>
            )}
            <MarkdownRenderer content={message.content} />
          </div>
        )}
      </div>
    </motion.div>
  )
}
