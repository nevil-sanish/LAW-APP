import type { VerifiedLaw } from '../types';
import { chunkLaw } from './chunk';
import { embedBatch, embedText } from './embeddings';
import {
  invalidateVectorStoreCache,
  saveChunksToFirestore,
  searchVectorStore,
  type ScoredChunk,
} from './vectorStore';

export type { ScoredChunk } from './vectorStore';
export { preloadEmbedder } from './embeddings';

/**
 * Chunk + embed + persist a newly approved law. Runs once, at admin-approval
 * time — not per chat query — so chat latency never includes embedding an
 * entire act. Call this right after `approveLaw()` succeeds.
 */
export async function indexLawForRag(
  law: VerifiedLaw,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const chunks = chunkLaw(law);
  const embeddings = await embedBatch(
    chunks.map((c) => c.text),
    onProgress,
  );
  const withEmbeddings = chunks.map((c, i) => ({ ...c, embedding: embeddings[i] }));
  await saveChunksToFirestore(withEmbeddings);
  invalidateVectorStoreCache();
}

/**
 * Embed a user's question and retrieve the most relevant approved-law
 * chunks. This is what `ChatView` calls before every `sendChatMessage`.
 */
export async function retrieveContext(query: string, topK = 5): Promise<ScoredChunk[]> {
  const queryEmbedding = await embedText(query);
  return searchVectorStore(queryEmbedding, topK);
}
