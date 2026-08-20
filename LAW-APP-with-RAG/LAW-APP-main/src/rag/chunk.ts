import { encode, decode } from 'gpt-tokenizer';
import type { VerifiedLaw } from '../types';

export interface LawChunk {
  id: string;         // `${lawId}_${index}` — stable, used as Firestore doc id
  lawId: string;
  lawTitle: string;
  category: string;
  section: string;     // best-guess section label this chunk belongs to
  text: string;        // text that gets embedded AND shown to the LLM
  tokenCount: number;
}

// Target ~400 tokens/chunk: small enough for precise retrieval, large enough
// to keep a clause and its surrounding context together. 60-token overlap
// stops a provision from being severed exactly at a chunk boundary.
const CHUNK_SIZE = 400;
const CHUNK_OVERLAP = 60;

/**
 * Token-accurate sliding-window split (falls back to a no-op if the text
 * already fits in one chunk). Using a real tokenizer instead of a
 * char-count heuristic matters here because legal text is dense with
 * numerals, section symbols (§), and short clauses — char/4 estimates
 * drift enough to blow past the embedder's context window on long acts.
 */
function splitByTokens(text: string, maxTokens: number, overlap: number): string[] {
  const tokens = encode(text);
  if (tokens.length <= maxTokens) return [text.trim()];

  const chunks: string[] = [];
  let start = 0;
  while (start < tokens.length) {
    const end = Math.min(start + maxTokens, tokens.length);
    chunks.push(decode(tokens.slice(start, end)).trim());
    if (end === tokens.length) break;
    start = end - overlap;
  }
  return chunks;
}

/**
 * Find which of the law's admin-extracted section labels (e.g.
 * "Section 4: Consideration") this piece of text most likely belongs to,
 * so retrieved chunks can be cited by section, not just by act name.
 */
function guessSectionLabel(piece: string, sections: string[]): string | null {
  const lower = piece.toLowerCase();
  for (const s of sections) {
    const head = s.split(':')[0].trim().toLowerCase(); // "section 4"
    if (head && lower.includes(head)) return s;
  }
  return null;
}

/** Turn one approved law into embed-ready, citable chunks. */
export function chunkLaw(law: VerifiedLaw): LawChunk[] {
  const pieces = splitByTokens(law.content, CHUNK_SIZE, CHUNK_OVERLAP);

  return pieces.map((piece, idx) => {
    const section = guessSectionLabel(piece, law.sections) ?? `Part ${idx + 1}`;
    // Prefix the act name + section into the embedded text itself — this
    // materially improves retrieval, since a bare clause ("...shall be
    // punished with imprisonment...") is ambiguous without knowing which
    // act/section it's from, and the embedder has no other signal for that.
    const text = `${law.title} — ${section}\n${piece}`;
    return {
      id: `${law.id}_${idx}`,
      lawId: law.id,
      lawTitle: law.title,
      category: law.category,
      section,
      text,
      tokenCount: encode(text).length,
    };
  });
}
