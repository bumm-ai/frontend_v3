'use client';

import { useMemo, useState } from 'react';
import { FileCode2, Folder, FolderOpen } from 'lucide-react';
import { buildFileTree, type FileTreeNode } from '@/lib/fileTree';

interface ProFileTreeProps {
  /** Pro Mode multi-file project map (path → source). */
  files: Record<string, string>;
  className?: string;
}

/** Default file shown on first render — the program crate root. */
const DEFAULT_FILE = 'src/lib.rs';

/**
 * Pro Mode (P5) read-only file-tree viewer for a multi-file contract project.
 *
 * Left panel: a folder/file tree derived from the flat ``files`` map.
 * Right panel: the selected file's source.
 *
 * XSS: every file's content is rendered as a React text node (children of
 * <pre>/<code>), NOT via dangerouslySetInnerHTML. React escapes text children,
 * so untrusted code can never inject markup. No syntax highlighting (which would
 * require an HTML sink) — a plain escaped <pre> is sufficient and safe.
 *
 * Inert until Pro Mode ships: the parent only mounts this when
 * ``contractStatus.files`` is present + non-empty, so single-file contracts
 * (files=null) never reach it.
 */
export function ProFileTree({ files, className }: ProFileTreeProps) {
  const paths = useMemo(() => Object.keys(files), [files]);
  const tree = useMemo(() => buildFileTree(paths), [paths]);

  // Default selection: src/lib.rs when present, else the first available path.
  const [selected, setSelected] = useState<string>(() =>
    files[DEFAULT_FILE] !== undefined ? DEFAULT_FILE : (paths[0] ?? '')
  );

  const content = files[selected] ?? '';

  return (
    <div
      className={`flex gap-2 h-full bg-[#0a0a0a] border border-[#333] rounded-lg overflow-hidden ${
        className ?? ''
      }`}
    >
      {/* Left: file tree */}
      <div className="w-44 flex-shrink-0 border-r border-[#333] bg-[#121212] overflow-y-auto">
        <div className="text-gray-400 text-[10px] uppercase tracking-wide px-3 py-2 border-b border-[#333]">
          Project files
        </div>
        <div className="py-1">
          {tree.map((node) => (
            <TreeRow
              key={node.path}
              node={node}
              depth={0}
              selected={selected}
              onSelect={setSelected}
            />
          ))}
        </div>
      </div>

      {/* Right: selected file content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="text-gray-400 text-xs p-3 pb-2 border-b border-[#333] flex-shrink-0 truncate">
          {`// ${selected || 'no file selected'}`}
        </div>
        <div className="flex-1 overflow-auto p-3 bg-[#0a0a0a]">
          {/* React escapes text children — safe against XSS, no HTML sink. */}
          <pre className="font-mono text-[9px] text-gray-300 leading-relaxed whitespace-pre-wrap break-words m-0">
            <code>{content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}

interface TreeRowProps {
  node: FileTreeNode;
  depth: number;
  selected: string;
  onSelect: (path: string) => void;
}

/** Recursive tree row — folders are expandable, files are selectable. */
function TreeRow({ node, depth, selected, onSelect }: TreeRowProps) {
  const [open, setOpen] = useState(true);
  const pad = { paddingLeft: `${8 + depth * 12}px` };

  if (node.type === 'dir') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={pad}
          className="w-full flex items-center gap-1.5 py-1 pr-2 text-left text-[11px] text-gray-300 hover:bg-[#1d1d1d] transition-colors"
        >
          {open ? (
            <FolderOpen className="w-3 h-3 text-orange-400/80 flex-shrink-0" />
          ) : (
            <Folder className="w-3 h-3 text-orange-400/80 flex-shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {open &&
          node.children.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
      </div>
    );
  }

  const isActive = node.path === selected;
  return (
    <button
      type="button"
      onClick={() => onSelect(node.path)}
      style={pad}
      className={`w-full flex items-center gap-1.5 py-1 pr-2 text-left text-[11px] transition-colors ${
        isActive
          ? 'bg-[#222] text-orange-300'
          : 'text-gray-400 hover:bg-[#1d1d1d] hover:text-gray-200'
      }`}
    >
      <FileCode2 className="w-3 h-3 flex-shrink-0 text-blue-400/70" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}
