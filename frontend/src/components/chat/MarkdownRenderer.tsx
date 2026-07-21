import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'

/** markdown 渲染组件，配色对齐 catppuccin Latte（编辑纸感） */
const components = {
  code({ inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '')
    return !inline && match ? (
      <div className="relative my-2">
        <div className="absolute top-0 right-0 px-2 py-0.5 text-xs text-subtext0 bg-surface1 rounded-bl border-b border-l border-surface2">
          {match[1]}
        </div>
        <code className={className} {...props}>{children}</code>
      </div>
    ) : (
      <code className="bg-mantle px-1 py-0.5 rounded text-[0.85em] font-mono text-mauve" {...props}>{children}</code>
    )
  },
  p({ children }: any) { return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p> },
  ul({ children }: any) { return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul> },
  ol({ children }: any) { return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol> },
  h1({ children }: any) { return <h1 className="font-serif text-xl font-bold mb-2 mt-3">{children}</h1> },
  h2({ children }: any) { return <h2 className="font-serif text-lg font-bold mb-2 mt-3">{children}</h2> },
  h3({ children }: any) { return <h3 className="font-serif text-base font-bold mb-1 mt-2">{children}</h3> },
  blockquote({ children }: any) {
    return <blockquote className="border-l-2 border-mauve pl-4 italic my-2 text-subtext1">{children}</blockquote>
  },
  table({ children }: any) {
    return <div className="overflow-x-auto my-2"><table className="min-w-full border-collapse border border-surface2">{children}</table></div>
  },
  thead({ children }: any) { return <thead className="bg-mantle">{children}</thead> },
  th({ children }: any) { return <th className="border border-surface2 px-3 py-2 text-left text-sm font-semibold">{children}</th> },
  td({ children }: any) { return <td className="border border-surface2 px-3 py-2 text-sm">{children}</td> },
  a({ children, href }: any) { return <a href={href} className="text-mauve underline underline-offset-2">{children}</a> },
}

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight, rehypeKatex]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  )
}
