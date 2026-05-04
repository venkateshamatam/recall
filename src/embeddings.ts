import { env, pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";
import { modelsDir } from "./paths.js";

const MODEL = "Xenova/all-MiniLM-L6-v2";

let extractor: Promise<FeatureExtractionPipeline> | null = null;

// first call may download the model. keep downloads scoped to ~/.recall instead of the global hf cache.
function load() {
  if (extractor) return extractor;
  env.cacheDir = modelsDir();
  extractor = pipeline("feature-extraction", MODEL, { quantized: true }) as Promise<FeatureExtractionPipeline>;
  return extractor;
}

// normalized minilm vectors make sqlite-vec's l2 distance equivalent to cosine.
export async function embed(text: string): Promise<Float32Array> {
  const ext = await load();
  const out = await ext(text, { pooling: "mean", normalize: true });
  return new Float32Array(out.data as Float32Array);
}

// warm the model so the first save/search doesn't pay the download.
export const warmup = () => load().then(() => undefined);
