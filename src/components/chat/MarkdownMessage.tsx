'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

const EMOJI_REGEX = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/gu;

const stripEmojis = (text: string): string =>
  text.replace(EMOJI_REGEX, '').replace(/[ \t]{2,}/g, ' ').trim();

const components: Components = {
  p: ({ children }) => <p className="mb-1.5 last:mb-0 whitespace-pre-wrap">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <pre className="my-1.5 bg-black/60 rounded p-1.5 overflow-x-auto text-[11px] leading-snug">
          <code className={`font-mono text-green-400 ${className ?? ''}`} {...props}>
            {children}
          </code>
        </pre>
      );
    }
    return (
      <code className="font-mono text-[11px] px-1 py-0.5 rounded bg-black/50 text-green-300">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <>{children}</>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-snug">{children}</li>,
  h1: ({ children }) => <h3 className="font-semibold text-sm mt-1.5 mb-1">{children}</h3>,
  h2: ({ children }) => <h3 className="font-semibold text-sm mt-1.5 mb-1">{children}</h3>,
  h3: ({ children }) => <h3 className="font-semibold text-sm mt-1.5 mb-1">{children}</h3>,
  h4: ({ children }) => <h4 className="font-semibold text-xs mt-1 mb-0.5">{children}</h4>,
  h5: ({ children }) => <h4 className="font-semibold text-xs mt-1 mb-0.5">{children}</h4>,
  h6: ({ children }) => <h4 className="font-semibold text-xs mt-1 mb-0.5">{children}</h4>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-orange-400 hover:underline"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-orange-500/60 pl-2 italic text-[#ccc] my-1.5">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-1.5">
      <table className="text-[11px] border-collapse w-full">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-black/40">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-[#333] px-1.5 py-0.5 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-[#333] px-1.5 py-0.5">{children}</td>
  ),
  hr: () => <hr className="my-2 border-[#333]" />,
  input: ({ type, checked, disabled }) =>
    type === 'checkbox' ? (
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        readOnly
        className="mr-1.5 align-middle accent-orange-500"
      />
    ) : null,
};

export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  const clean = stripEmojis(content);
  return (
    <div className={className ?? 'text-white text-xs leading-relaxed break-words'}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {clean}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownMessage;
