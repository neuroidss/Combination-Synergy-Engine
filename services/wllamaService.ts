// VIBE_NOTE: Do not escape backticks or dollar signs in template literals in this file.
// Escaping is only for 'implementationCode' strings in tool definitions.
import { Wllama, ModelManager } from '@wllama/wllama';
import type { APIConfig } from '../types';

let wllama: Wllama | null = null;
const modelManager = new ModelManager();
let currentModelUrl: string | null = null;
let isLoading = false; // A global lock to prevent concurrent model operations

/**
 * Gets or initializes the Wllama instance.
 * Note: A new instance is required after `exit()` is called.
 */
const getWllama = (onProgress: (message: string) => void): Wllama => {
    if (wllama) {
        return wllama;
    }
    try {
        onProgress('🚀 Initializing Wllama WebAssembly...');
        
        const config = {
            // Use single-thread to avoid issues requiring cross-origin isolation headers.
            multiThread: false,
            // Provide explicit CDN paths for WASM files for robust loading.
            wasmPaths: {
                'single-thread/wllama.wasm': 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.6/esm/single-thread/wllama.wasm',
                'multi-thread/wllama.wasm': 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.6/esm/multi-thread/wllama.wasm'
            }
        };

        wllama = new Wllama(config);
        
        onProgress('✅ Wllama initialized successfully.');
        return wllama;
    } catch (e) {
        const error = e as Error;
        const errorMessage = `Your browser may not support the necessary features (WebAssembly) for Wllama. Error: ${error.message}`;
        onProgress(`[ERROR] ❌ Wllama initialization failed: ${errorMessage}`);
        throw new Error(errorMessage);
    }
};


/**
 * Manages downloading (if necessary) and loading a model into Wllama.
 * This function is now the single point of entry for preparing a model for inference.
 */
const loadModel = async (modelUrl: string, onProgress: (message: string) => void) => {
    // If the correct model is already loaded, we're done.
    if (currentModelUrl === modelUrl) {
        onProgress(`✅ Model ${new URL(modelUrl).pathname.split('/').pop()} is already loaded.`);
        return;
    }

    // If another operation is in progress, wait for it to complete.
    if (isLoading) {
        onProgress('Another model operation is in progress, please wait...');
        while (isLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        // Check again if the correct model was loaded by the other process.
        if (currentModelUrl === modelUrl) return;
    }

    isLoading = true;

    try {
        let llm = getWllama(onProgress);
        const modelName = new URL(modelUrl).pathname.split('/').pop() || modelUrl;

        // Unload any previously loaded model, as Wllama only supports one at a time.
        if (currentModelUrl) {
            onProgress(`Unloading previous model: ${new URL(currentModelUrl).pathname.split('/').pop()}`);
            await llm.exit();
            wllama = null; // Discard the old instance.
            llm = getWllama(onProgress); // Create a fresh instance.
            currentModelUrl = null;
        }

        // Check if the model is cached in IndexedDB by getting all models and finding the one we need.
        let allCachedModels = await modelManager.getModels();
        let cachedModel = allCachedModels.find(m => m.url === modelUrl);

        // If not cached, download it.
        if (!cachedModel) {
            onProgress(`🚀 Downloading model: ${modelName}. This may take a while...`);
            await modelManager.downloadModel(modelUrl, {
                progressCallback: (progress) => {
                    const percentage = (progress.loaded / progress.total * 100).toFixed(1);
                    onProgress(`Downloading ${modelName}: ${percentage}%`);
                }
            });
            // After download, refresh the list and find the model again.
            allCachedModels = await modelManager.getModels();
            cachedModel = allCachedModels.find(m => m.url === modelUrl);
            if (!cachedModel) {
                throw new Error("Model was downloaded but could not be found in the cache.");
            }
        } else {
             onProgress(`✅ Model ${modelName} found in local cache.`);
        }

        // Load the model from cache into Wllama's memory.
        onProgress(`🧠 Loading ${modelName} into memory...`);
        await llm.loadModel(cachedModel);
        
        currentModelUrl = modelUrl;
        onProgress(`✅ Model ${modelName} loaded and ready for inference.`);
    } catch (e) {
         const error = e as Error;
         currentModelUrl = null;
         // Attempt to clean up the Wllama instance on failure.
         if (wllama) {
            await wllama.exit().catch(() => {});
            wllama = null;
         }
         throw new Error(`Failed to load model from ${modelUrl}. Error: ${error.message}`);
    } finally {
        isLoading = false; // Release the lock.
    }
};

/**
 * The core generation function. It ensures the model is loaded before running completion.
 */
const generate = async (
    userInput: string,
    systemInstruction: string,
    modelUrl: string,
    temperature: number,
    onProgress: (message: string) => void,
): Promise<string> => {
    try {
        // This now handles both downloading and loading into memory.
        await loadModel(modelUrl, onProgress);
        const llm = getWllama(onProgress);

        onProgress('🤖 Generating response with Wllama...');

        const response = await llm.createChatCompletion([
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userInput },
        ], {
            temp: temperature > 0 ? temperature : 0.1,
            n_predict: 2048,
        });

        onProgress('✅ Response generated.');
        return response.choices[0].message.content || "";

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        onProgress(`[ERROR] ❌ Wllama generation failed: ${errorMessage}`);
        console.error("Wllama service error:", e);
        throw e;
    }
};

export const generateJsonOutput = async (
    userInput: string,
    systemInstruction: string,
    modelUrl: string,
    temperature: number,
    apiConfig: APIConfig,
    onProgress: (message: string) => void,
): Promise<string> => {
    const fullSystemInstruction = `${systemInstruction}\n\nYou MUST respond with a single, valid JSON object and nothing else. Do not wrap the JSON in triple backticks.`;
    const responseText = await generate(userInput, fullSystemInstruction, modelUrl, temperature, onProgress);
    return responseText || "{}";
};

export const generateText = async (
    userInput: string,
    systemInstruction: string,
    modelUrl: string,
    temperature: number,
    apiConfig: APIConfig,
    onProgress: (message: string) => void
): Promise<string> => {
    return await generate(userInput, systemInstruction, modelUrl, temperature, onProgress);
};