// VIBE_NOTE: Do not escape backticks or dollar signs in template literals in this file.
// Escaping is only for 'implementationCode' strings in tool definitions.
import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

class EmbeddingSingleton {
    private static instance: FeatureExtractionPipeline | null = null;
    private static initializationPromise: Promise<FeatureExtractionPipeline> | null = null;

    static getInstance(onProgress: (msg: string) => void): Promise<FeatureExtractionPipeline> {
        if (this.instance) {
            return Promise.resolve(this.instance);
        }

        if (this.initializationPromise) {
            onProgress('[Embeddings] Initialization already in progress, waiting...');
            return this.initializationPromise;
        }

        this.initializationPromise = new Promise(async (resolve, reject) => {
            try {
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
                let extractor: FeatureExtractionPipeline | null = null;

                if (!webgpuFailedPreviously) {
                    try {
                        onProgress(`🚀 Attempting to load embedding model via WebGPU...`);
                        reportedDownloads.clear();
                        // FIX: Cast options to 'any' to avoid "type is too complex" error from transformers.js pipeline function.
                        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
                            device: 'webgpu',
                            progress_callback: progressCallback,
                            dtype: 'auto'
                        } as any);
                        onProgress(`✅ Successfully loaded model on WebGPU.`);
                    } catch (e) {
                        const errorMessage = e instanceof Error ? e.message : String(e);
                        onProgress(`[WARN] ⚠️ WebGPU initialization failed: ${errorMessage}. Falling back to CPU (WASM)...`);
                        console.warn("WebGPU failed, falling back to WASM:", e);
                        sessionStorage.setItem('webgpu_failed', 'true');
                    }
                } else {
                    onProgress(`[INFO] Skipping WebGPU because it failed previously in this session.`);
                }
                
                if (!extractor) {
                    try {
                        onProgress(`🚀 Loading embedding model via CPU (WASM)... This may be slower.`);
                        reportedDownloads.clear();
                        // FIX: Cast options to 'any' to avoid "type is too complex" error from transformers.js pipeline function.
                        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
                            device: 'wasm',
                            progress_callback: progressCallback,
                        } as any);
                        onProgress(`✅ Successfully loaded model on CPU.`);
                    } catch (e) {
                        const errorMessage = e instanceof Error ? e.message : String(e);
                        const finalError = new Error(`[ERROR] ❌ Critical Error: Could not load embedding model on either WebGPU or CPU. ${errorMessage}`);
                        this.initializationPromise = null;
                        reject(finalError);
                        return;
                    }
                }
                
                this.instance = extractor;
                this.initializationPromise = null; 
                resolve(this.instance);

            } catch (error) {
                this.initializationPromise = null; 
                reject(error);
            }
        });

        return this.initializationPromise;
    }

    static async forceResetAndReinitialize(onProgress: (msg: string) => void): Promise<FeatureExtractionPipeline> {
        if (this.instance) {
            await this.instance.dispose();
            this.instance = null;
        }
        this.initializationPromise = null;
        return this.getInstance(onProgress);
    }
}


export const generateEmbeddings = async (texts: string[], onProgress: (msg: string) => void): Promise<number[][]> => {
    try {
        const extractor = await EmbeddingSingleton.getInstance(onProgress);
        const output = await extractor(texts.length === 1 ? texts[0] : texts, { pooling: 'mean', normalize: true });
        if (texts.length === 1) {
            return [output.tolist()[0]];
        }
        return output.tolist();
    } catch(e) {
        const isWebGPUFailure = e instanceof Error && (e.message.includes('GPUDevice') || e.message.includes('createBuffer failed'));
        const isFirstAttempt = sessionStorage.getItem('webgpu_failed') !== 'true';

        if (isWebGPUFailure && isFirstAttempt) {
            onProgress(`[WARN] ⚠️ WebGPU execution failed. Forcing fallback to CPU (WASM) and retrying...`);
            sessionStorage.setItem('webgpu_failed', 'true');
            await EmbeddingSingleton.forceResetAndReinitialize(onProgress);
            
            return generateEmbeddings(texts, onProgress);
        }

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