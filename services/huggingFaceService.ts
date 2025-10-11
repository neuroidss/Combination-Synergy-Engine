// VIBE_NOTE: Do not escape backticks or dollar signs in template literals in this file.
// Escaping is only for 'implementationCode' strings in tool definitions.
import { pipeline, type TextGenerationPipeline } from '@huggingface/transformers';
import type { APIConfig, LLMTool, AIResponse, AIToolCall } from '../types';

let generator: TextGenerationPipeline | null = null;
let currentModelId: string | null = null;
let currentDevice: string | null = null;

const handleProgress = (onProgress: (message: string) => void = () => {}) => {
    const reportedDownloads = new Set();
    return (progress: any) => {
        const { status, file } = progress;
        if (status === 'download' && !reportedDownloads.has(file)) {
            onProgress(`Downloading model file: ${file}...`);
            reportedDownloads.add(file);
        }
    };
};

const getPipeline = async (modelId: string, onProgress: (message: string) => void = () => {}): Promise<TextGenerationPipeline> => {
    // In this simplified version, device is hardcoded, but can be expanded via a config.
    const huggingFaceDevice = 'webgpu'; 

    if (generator && currentModelId === modelId && currentDevice === huggingFaceDevice) {
        return generator;
    }

    onProgress(`🚀 Initializing model: ${modelId}. This may take a few minutes...`);
    
    if (generator) {
        await generator.dispose();
        generator = null;
    }

    (window as any).env = (window as any).env || {};
    (window as any).env.allowLocalModels = false;
    (window as any).env.useFbgemm = false;
    
    // The options for the pipeline. Using 'auto' for dtype to allow for automatic quantization and better device compatibility.
    const pipelineOptions = {
        device: huggingFaceDevice,
        progress_callback: handleProgress(onProgress),
        dtype: 'auto'
    };
    
    // By casting the options argument to 'any' at the call site, we prevent TypeScript from creating
    // a massive union type from all the pipeline() overloads, which was causing a "type is too complex" error.
    // This is a necessary workaround for a known issue with the transformers.js library's complex types.
    // @ts-ignore
    generator = await pipeline('text-generation', modelId, pipelineOptions as any) as TextGenerationPipeline;

    currentModelId = modelId;
    currentDevice = huggingFaceDevice;
    
    onProgress(`✅ Model ${modelId} loaded successfully.`);
    return generator;
};

const executePipe = async (pipe: TextGenerationPipeline, system: string, user:string, temp: number): Promise<string> => {
    const prompt = `<|system|>\n${system}<|end|>\n<|user|>\n${user}<|end|>\n<|assistant|>`;

    const outputs = await pipe(prompt, {
        max_new_tokens: 2048,
        temperature: temp > 0 ? temp : 0.1,
        do_sample: temp > 0,
        top_k: temp > 0 ? 50 : 1,
    });
    
    const rawText = (outputs[0] as any).generated_text;
    const assistantResponse = rawText.split('<|assistant|>').pop()?.trim();

    if (!assistantResponse) {
        throw new Error("Could not extract assistant's response from model output.");
    }
    
    return assistantResponse;
};

const generateDetailedError = (error: unknown, modelId: string, rawResponse?: string): Error => {
    let finalMessage;
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        finalMessage = `Network error: failed to download model files for ${modelId}. Check your internet connection and ad blockers.`;
    } else {
        finalMessage = `HuggingFace model error (${modelId}): ${error instanceof Error ? error.message : "An unknown error occurred"}`;
    }
    const processingError = new Error(finalMessage) as any;
    processingError.rawAIResponse = rawResponse || "Could not get raw response.";
    return processingError;
};

const generate = async (system: string, user: string, modelId: string, temperature: number, onProgress: (message: string) => void = () => {}): Promise<string> => {
     try {
        const pipe = await getPipeline(modelId, onProgress);
        const responseText = await executePipe(pipe, system, user, temperature);
        return responseText;
    } catch (e) {
        throw generateDetailedError(e, modelId);
    }
};

const parseToolCallFromText = (text: string, toolNameMap: Map<string, string>): AIToolCall[] | null => {
    if (!text) return null;

    // Regex to find a JSON block, optionally inside ```json ... ```
    const jsonRegex = /```json\s*([\s\S]*?)\s*```|({[\s\S]*}|\[[\s\S]*\])/m;
    const match = text.match(jsonRegex);

    if (!match) return null;

    // Use the content from the capture group, preferring the one inside backticks
    const jsonString = match[1] || match[2];
    if (!jsonString) return null;

    try {
        let parsedJson = JSON.parse(jsonString);
        
        // The model might return a single object instead of an array
        if (!Array.isArray(parsedJson)) {
            parsedJson = [parsedJson];
        }

        const toolCalls: AIToolCall[] = [];
        for (const call of parsedJson) {
            if (typeof call !== 'object' || call === null) continue;

            // Be flexible: find keys for name and arguments
            const nameKey = Object.keys(call).find(k => k.toLowerCase().includes('name'));
            const argsKey = Object.keys(call).find(k => k.toLowerCase().includes('arguments'));

            if (nameKey && argsKey && typeof call[nameKey] === 'string' && typeof call[argsKey] === 'object') {
                const rawName = call[nameKey];
                // Try to map back from a potentially sanitized name, but also accept the original name.
                const originalName = toolNameMap.get(rawName.replace(/[^a-zA-Z0-9_]/g, '_')) || toolNameMap.get(rawName) || rawName;
                
                toolCalls.push({
                    name: originalName,
                    arguments: call[argsKey]
                });
            }
        }
        
        return toolCalls.length > 0 ? toolCalls : null;

    } catch (e) {
        console.warn(`[HuggingFace Service] Fallback tool call parsing failed for JSON string: "${jsonString}"`, e);
        return null;
    }
};

export const generateWithTools = async (
    userInput: string,
    systemInstruction: string,
    modelId: string,
    apiConfig: APIConfig,
    tools: LLMTool[],
    onProgress: (message: string) => void = () => {}
): Promise<AIResponse> => {
    const toolNameMap = new Map(tools.map(t => [t.name.replace(/[^a-zA-Z0-9_]/g, '_'), t.name]));
    tools.forEach(tool => {
        toolNameMap.set(tool.name, tool.name);
    });

    const toolDescriptions = tools.map(tool => {
        const params = tool.parameters.map(p => `  - ${p.name} (${p.type}): ${p.description}${p.required ? ' (required)' : ''}`).join('\n');
        return `Tool: "${tool.name}"\nDescription: ${tool.description}\nParameters:\n${params}`;
    }).join('\n\n');

    const fallbackInstruction = `\n\nWhen you need to use a tool, you MUST respond with ONLY a single JSON object (or an array of objects for multiple calls) in a \`\`\`json block. Do not add any other text or explanation. The available tools are:\n\n${toolDescriptions}\n\nYour response format for a tool call MUST be:\n\`\`\`json\n[\n  {\n    "name": "tool_name_to_call",\n    "arguments": { "arg1": "value1", "arg2": "value2" }\n  }\n]\n\`\`\``;

    const fullSystemInstruction = systemInstruction + fallbackInstruction;
    
    const responseText = await generate(fullSystemInstruction, userInput, modelId, 0.1, onProgress);
    const toolCalls = parseToolCallFromText(responseText, toolNameMap);
    
    return { toolCalls, text: responseText };
};


export const generateJsonOutput = async (
    userInput: string,
    systemInstruction: string,
    modelId: string,
    temperature: number,
    apiConfig: APIConfig,
    onProgress: (message: string) => void = () => {},
): Promise<string> => {
    const fullSystemInstruction = `${systemInstruction}\n\nYou MUST respond with a single, valid JSON object and nothing else. Do not wrap the JSON in triple backticks.`;
    const responseText = await generate(fullSystemInstruction, userInput, modelId, temperature, onProgress);
    return responseText || "{}";
};

export const generateText = async (
    userInput: string,
    systemInstruction: string,
    modelId: string,
    temperature: number,
    apiConfig: APIConfig,
    onProgress: (message: string) => void = () => {}
): Promise<string> => {
    return await generate(systemInstruction, userInput, modelId, temperature, onProgress);
};
