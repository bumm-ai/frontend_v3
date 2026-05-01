/**
 * Human-readable descriptions for Rust/Anchor compiler error codes.
 * Shown in chat instead of raw "E0599" codes.
 */

interface ErrorInfo {
  short: string;   // one-liner shown inline in chat
  hint?: string;   // optional extra context (shown in tooltip / expanded view)
}

const ERROR_MAP: Record<string, ErrorInfo> = {
  // ── Most common Anchor/SPL issues ──────────────────────────────────────────
  E0599: {
    short: 'Method or field does not exist on this type',
    hint:  'Often caused by calling Anchor macro internals (e.g. Mint::create_type, Mint::DISCRIMINATOR) that are not public API — use Account<\'info, Mint> constraints instead.',
  },
  E0277: {
    short: 'Type does not implement a required trait',
    hint:  'anchor_spl::token_interface::Mint/TokenAccount do not implement Owner. For accounts with `init`, use Account<\'info, Mint> from anchor_spl::token::* instead of InterfaceAccount.',
  },
  E0308: {
    short: 'Type mismatch — expected one type, got another',
  },
  E0382: {
    short: 'Value used after it was moved (Rust ownership)',
    hint:  'Clone the value before moving, or borrow it instead.',
  },
  E0425: {
    short: 'Identifier not found — likely `crate::ID` instead of `crate::id()`',
    hint:  'declare_id!() generates a function id(), not a constant ID.',
  },
  E0432: {
    short: 'Unresolved import — crate or module does not exist',
  },
  E0433: {
    short: 'Unresolved crate — not available in builder dependencies',
    hint:  'mpl_token_metadata, mpl_core, mpl_bubblegum and similar Metaplex crates are not in the pinned workspace.',
  },
  E0463: {
    short: 'Missing crate — not found in Cargo registry',
  },
  E0499: {
    short: 'Cannot borrow as mutable — already borrowed',
  },
  E0502: {
    short: 'Borrow conflict — cannot borrow while another borrow is active',
  },
  E0505: {
    short: 'Cannot move — value still borrowed',
  },
  E0507: {
    short: 'Cannot move out of shared reference',
  },
  E0515: {
    short: 'Cannot return reference to local variable',
  },
  E0560: {
    short: 'Unknown field in struct initializer',
  },
  E0616: {
    short: 'Field is private — cannot access directly',
  },
  // ── Anchor-specific ────────────────────────────────────────────────────────
  E0658: {
    short: 'Feature not stable in this Rust edition',
  },
};

/**
 * Convert a list of error codes to a short human-readable summary.
 * Returns null when codes array is empty or unknown.
 *
 * @example
 * humanizeErrorCodes(['E0599', 'E0277'])
 * // → "Method/field does not exist • Type missing required trait"
 */
export function humanizeErrorCodes(codes: string[]): string | null {
  if (!codes || codes.length === 0) return null;
  const unique = [...new Set(codes)];
  const parts = unique
    .map(code => {
      const info = ERROR_MAP[code];
      return info ? info.short : `Compiler error ${code}`;
    })
    .slice(0, 3); // cap at 3 to keep chat readable
  return parts.join(' • ');
}

/**
 * Get detailed hint for a single error code (for tooltips or expanded views).
 */
export function getErrorHint(code: string): string | null {
  return ERROR_MAP[code]?.hint ?? null;
}
