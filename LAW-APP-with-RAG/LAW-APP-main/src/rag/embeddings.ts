import { pipeline, env, type FeatureExtractionPipeline } from '@xenova/transformers';

// Always fetch the model from the HF CDN + cache it in the browser (IndexedDB
// via transformers.js's own cache) rather than expecting it bundled locally.
env.allowLocalModels = false;

// all-MiniLM-L6-v2: 384-dim, ~23MB quantized, runs in-browser via WASM.
// Picked over calling an embeddings API because this app is 100% client-side
// (Firebase only, no backend) — an embedding API would mean shipping the
// Groq/embedding key to the browser AND sending every user's legal question
// to a third party just to vectorize it. Running the model locally keeps
// that text on-device and costs nothing per query.
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = pipeline('feature-extraction', MODEL_ID) as Promise<FeatureExtractionPipeline>;
  }
  return pipelinePromise;
}

/** Warm the model up ahead of time (call on app mount / chat screen mount)
 *  so the first real query isn't the one paying the ~20-30MB download. */
export function preloadEmbedder(): void {
  void getPipeline();
}

export async function embedText(text: string): Promise<number[]> {
  const extractor = await getPipeline();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}

/**
 * Embed many chunks sequentially (transformers.js's WASM backend doesn't
 * benefit much from Promise.all batching in-browser, and sequential keeps
 * memory bounded on long acts with hundreds of chunks). Used at index time
 * (admin approves a law), not on the hot chat path.
 */
export async function embedBatch(
  texts: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<number[][]> {
  const extractor = await getPipeline();
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    const output = await extractor(texts[i], { pooling: 'mean', normalize: true });
    results.push(Array.from(output.data as Float32Array));
    onProgress?.(i + 1, texts.length);
  }
  return results;
}
