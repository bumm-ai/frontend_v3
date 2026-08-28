// fileTree — pure helper that turns a flat Pro Mode file map (path → content)
// into a nested tree of folders + files for the ProFileTree UI.
//
// Single source of truth for the tree shape so the component stays dumb and the
// branching logic is unit-tested in isolation (no React, no DOM). Mirrors the
// backend ``state.files`` map: keys are POSIX-style relative paths such as
// "src/lib.rs" or "src/instructions/mod.rs".

/** A node in the rendered file tree — either a folder (has children) or a file. */
export interface FileTreeNode {
  /** Last path segment, e.g. "lib.rs" or "instructions". */
  name: string;
  /** Full path from the root, e.g. "src/instructions/mod.rs". For folders this
   *  is the folder path, e.g. "src/instructions". */
  path: string;
  /** "file" leaves carry content; "dir" nodes carry children. */
  type: 'file' | 'dir';
  /** Sorted children — dirs first, then files, each alphabetical. Empty for files. */
  children: FileTreeNode[];
}

/**
 * Normalize a single path: strip leading "./" and "/", collapse repeated
 * slashes, and drop empty segments. Returns the cleaned segments (may be empty).
 */
function splitPath(path: string): string[] {
  return path
    .replace(/^\.?\/+/, '')
    .split('/')
    .filter((seg) => seg.length > 0);
}

/**
 * Build a nested file-tree from a flat list of paths.
 *
 * - Nested paths create intermediate folder nodes ("src/instructions/mod.rs"
 *   yields src → instructions → mod.rs).
 * - Output is deterministically sorted: folders before files, then alphabetical
 *   (case-insensitive) within each group, recursively.
 * - Duplicate / empty / "./"-prefixed paths are de-duped and normalized.
 * - An empty input yields an empty array.
 *
 * @param paths Flat list of relative file paths (e.g. Object.keys(files)).
 * @returns Root-level nodes of the tree.
 */
export function buildFileTree(paths: string[]): FileTreeNode[] {
  const root: FileTreeNode = { name: '', path: '', type: 'dir', children: [] };

  for (const raw of paths) {
    const segments = splitPath(raw);
    if (segments.length === 0) continue;

    let cursor = root;
    let acc = '';
    segments.forEach((segment, idx) => {
      acc = acc ? `${acc}/${segment}` : segment;
      const isLeaf = idx === segments.length - 1;
      let child = cursor.children.find((c) => c.name === segment);
      if (!child) {
        child = {
          name: segment,
          path: acc,
          type: isLeaf ? 'file' : 'dir',
          children: [],
        };
        cursor.children.push(child);
      } else if (isLeaf) {
        // A path that is both a folder and a file is ambiguous — keep it as a
        // folder (the existing children win) rather than clobbering them.
        child.type = child.children.length > 0 ? 'dir' : 'file';
      }
      cursor = child;
    });
  }

  sortTree(root);
  return root.children;
}

/** Recursively sort children: dirs first, then files, alphabetical within each. */
function sortTree(node: FileTreeNode): void {
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  for (const child of node.children) sortTree(child);
}
