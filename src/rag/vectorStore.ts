import { collectionGroup, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import type { LawChunk } from './chunk';

export interface EmbeddedChunk extends LawChunk {
  embedding: number[];
}

export interface ScoredChunk extends EmbeddedChunk {
  score: number;
}

// In-memory index for the browser session. Firestore has no client-side
// vector index here (that needs a server-side gcloud-provisioned index), and
// this corpus is a few hundred to low thousands of chunks across all approved
// laws — small enough that a flat in-memory cosine scan is fast (single-digit
// ms) and avoids standing up a separate vector DB service for what is
// otherwise a fully client-side app.
let cache: EmbeddedChunk[] | null = null;
let loadPromise: Promise<void> | null = null;

/** Persist one law's chunks + embeddings, computed once at admin-approval time. */
export async function saveChunksToFirestore(chunks: EmbeddedChunk[]): Promise<void> {
  if (chunks.length === 0) return;
  const batch = writeBatch(db);
  for (const c of chunks) {
    const ref = doc(db, 'laws', c.lawId, 'chunks', c.id);
    batch.set(ref, {
      lawTitle: c.lawTitle,
      category: c.category,
      section: c.section,
      text: c.text,
      tokenCount: c.tokenCount,
      embedding: c.embedding,
    });
  }
  await batch.commit();
}

async function fetchAllChunks(): Promise<EmbeddedChunk[]> {
  // collectionGroup reads every laws/{lawId}/chunks subcollection in one query.
  const snap = await getDocs(collectionGroup(db, 'chunks'));
  return snap.docs.map((d) => {
    const data = d.data() as Omit<EmbeddedChunk, 'id' | 'lawId'>;
    return {
      id: d.id,
      lawId: d.ref.parent.parent!.id,
      ...data,
    };
  });
}

/** Load (or reuse the cached) full chunk set into memory. */
export async function loadVectorStore(force = false): Promise<void> {
  if (cache && !force) return;
  if (!loadPromise || force) {
    loadPromise = fetchAllChunks().then((chunks) => {
      cache = chunks;
    });
  }
  await loadPromise;
}

/** Call after approving/re-indexing a law so the next search sees it. */
export function invalidateVectorStoreCache(): void {
  cache = null;
  loadPromise = null;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

/**
 * Top-k nearest chunks to a query embedding. minScore filters out
 * near-random matches so a query with no relevant law in the corpus
 * (e.g. small talk) correctly returns nothing instead of forcing in
 * whatever happened to be least-dissimilar.
 */
export async function searchVectorStore(
  queryEmbedding: number[],
  topK = 5,
  minScore = 0.3,
): Promise<ScoredChunk[]> {
  await loadVectorStore();
  if (!cache || cache.length === 0) return [];

  return cache
    .map((c) => ({ ...c, score: cosineSimilarity(queryEmbedding, c.embedding) }))
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
