import { describe, it, expect } from 'vitest';
import { buildFileTree, type FileTreeNode } from '../fileTree';

/** Collect every file leaf's full path, depth-first, for terse assertions. */
function filePaths(nodes: FileTreeNode[]): string[] {
  const out: string[] = [];
  const walk = (ns: FileTreeNode[]) => {
    for (const n of ns) {
      if (n.type === 'file') out.push(n.path);
      else walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

describe('buildFileTree', () => {
  it('returns an empty array for no paths', () => {
    expect(buildFileTree([])).toEqual([]);
  });

  it('handles a single top-level file', () => {
    const tree = buildFileTree(['lib.rs']);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ name: 'lib.rs', path: 'lib.rs', type: 'file' });
    expect(tree[0].children).toEqual([]);
  });

  it('builds intermediate folders for a nested path', () => {
    const tree = buildFileTree(['src/instructions/mod.rs']);
    expect(tree).toHaveLength(1);
    const src = tree[0];
    expect(src).toMatchObject({ name: 'src', path: 'src', type: 'dir' });
    const instructions = src.children[0];
    expect(instructions).toMatchObject({
      name: 'instructions',
      path: 'src/instructions',
      type: 'dir',
    });
    const mod = instructions.children[0];
    expect(mod).toMatchObject({
      name: 'mod.rs',
      path: 'src/instructions/mod.rs',
      type: 'file',
    });
  });

  it('shares an intermediate folder across sibling files', () => {
    const tree = buildFileTree(['src/lib.rs', 'src/state.rs']);
    expect(tree).toHaveLength(1);
    const src = tree[0];
    expect(src.type).toBe('dir');
    expect(src.children.map((c) => c.name)).toEqual(['lib.rs', 'state.rs']);
    expect(src.children.every((c) => c.type === 'file')).toBe(true);
  });

  it('sorts folders before files, alphabetical within each group', () => {
    const tree = buildFileTree([
      'src/lib.rs',
      'src/state.rs',
      'src/instructions/mod.rs',
      'src/accounts/config.rs',
    ]);
    const src = tree[0];
    // dirs (accounts, instructions) come before files (lib.rs, state.rs).
    expect(src.children.map((c) => c.name)).toEqual([
      'accounts',
      'instructions',
      'lib.rs',
      'state.rs',
    ]);
    expect(src.children.map((c) => c.type)).toEqual(['dir', 'dir', 'file', 'file']);
  });

  it('preserves every input file as a leaf', () => {
    const paths = [
      'src/lib.rs',
      'src/instructions/mod.rs',
      'src/instructions/init.rs',
      'src/state.rs',
    ];
    expect(filePaths(buildFileTree(paths)).sort()).toEqual([...paths].sort());
  });

  it('normalizes "./" and leading-slash prefixes and de-dupes', () => {
    const tree = buildFileTree(['./src/lib.rs', '/src/lib.rs', 'src/lib.rs']);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('src');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].path).toBe('src/lib.rs');
  });

  it('skips empty / whitespace-only path segments', () => {
    const tree = buildFileTree(['', 'src//lib.rs']);
    expect(filePaths(tree)).toEqual(['src/lib.rs']);
  });

  it('sorts top-level dirs before top-level files', () => {
    const tree = buildFileTree(['Cargo.toml', 'src/lib.rs']);
    expect(tree.map((n) => n.name)).toEqual(['src', 'Cargo.toml']);
    expect(tree.map((n) => n.type)).toEqual(['dir', 'file']);
  });
});
