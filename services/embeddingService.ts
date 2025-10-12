import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

class EmbeddingSingleton {
    static instance: FeatureExtractionPipeline | null = null;
    static async getInstance(onProgress: (msg: string) => void): Promise<FeatureExtractionPipeline> {
        if (this.instance !== null) {
            return this.instance;
        }

        (window as any).env = { ...(window as any).env, allowLocalModels: false, useFbgemm: false };

        const reportedDownloads = new Set();
        const progressCallback = (progress: any) => {
            const { status, file } = progress;
            if (status === 'download' && !reportedDownloads.has(file)) {
                onProgress(`Downloading model file: ${file}...`);
                reportedDownloads.add(file);
            }
        };

        const webgpuFailedPreviously = sessionStorage.getItem('webgpu_failed') === 'true';

        // --- Attempt #1: WebGPU (Fast) ---
        if (!webgpuFailedPreviously) {
            try {
                onProgress(`🚀 Attempting to load embedding model via WebGPU...`);
                reportedDownloads.clear();
                const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
                    device: 'webgpu',
                    progress_callback: progressCallback,
                    dtype: 'auto'
                });
                onProgress(`✅ Successfully loaded model on WebGPU.`);
                this.instance = extractor;
                return this.instance;
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                onProgress(`[WARN] ⚠️ WebGPU initialization failed: ${errorMessage}. Falling back to CPU (WASM)...`);
                console.warn("WebGPU failed, falling back to WASM:", e);
                // Set flag so we don't try again this session
                sessionStorage.setItem('webgpu_failed', 'true');
            }
        } else {
             onProgress(`[INFO] Skipping WebGPU because it failed previously in this session.`);
        }

        // --- Attempt #2: WASM/CPU (Slow but Reliable) ---
        try {
            onProgress(`🚀 Loading embedding model via CPU (WASM)... This may be slower.`);
            reportedDownloads.clear();
            const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
                device: 'wasm',
                progress_callback: progressCallback,
            });
            onProgress(`✅ Successfully loaded model on CPU.`);
            this.instance = extractor;
            return this.instance;
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            onProgress(`[ERROR] ❌ Critical Error: Could not load embedding model on either WebGPU or CPU. ${errorMessage}`);
            throw e;
        }
    }
}

export const generateEmbeddings = async (texts: string[], onProgress: (msg: string) => void): Promise<number[][]> => {
    try {
        const extractor = await EmbeddingSingleton.getInstance(onProgress);
        // The library expects a single string or an array of strings.
        const output = await extractor(texts.length === 1 ? texts[0] : texts, { pooling: 'mean', normalize: true });
        // The output format differs for single vs. multiple inputs. Standardize it.
        if (texts.length === 1) {
            return [output.tolist()[0]]; // It returns a 2D array for a single item, we need the inner array
        }
        return output.tolist();

    } catch(e) {
        console.error("Embedding generation failed:", e);
        throw e;
    }
};

export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
        return 0;
    }
    // Since vectors are normalized, dot product is equivalent to cosine similarity
    let dotProduct = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
    }
    return dotProduct;
};