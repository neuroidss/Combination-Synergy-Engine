// VIBE_NOTE: Do not escape backticks or dollar signs in template literals in this file.
// Escaping is only for 'implementationCode' strings in tool definitions.
import type { APIConfig, AIToolCall, LLMTool, MainView, ScoredTool, AIModel, AIResponse } from '../types';
import { ModelProvider } from '../types';

import * as geminiService from './geminiService';
import * as openAIService from './openAIService';
import * as ollamaService from './ollamaService';
import * as huggingFaceService from './huggingFaceService';
import * as wllamaService from './wllamaService';
import * as deepseekService from './deepseekService';

export const processRequest = async (
    prompt: { text: string; files: { type: string, data: string }[] },
    systemInstruction: string,
    agentId: string,
    relevantTools: LLMTool[],
    model: AIModel,
    apiConfig: APIConfig
): Promise<AIResponse> => {
    const { text: userInput, files } = prompt;

    try {
        switch (model.provider) {
            case ModelProvider.GoogleAI:
                return await geminiService.generateWithTools(userInput, systemInstruction, model.id, apiConfig.googleAIAPIKey || '', relevantTools, files);
            case ModelProvider.OpenAI_API:
                 return await openAIService.generateWithTools(userInput, systemInstruction, model.id, apiConfig, relevantTools, files);
            case ModelProvider.DeepSeek:
                const deepSeekApiConfig: APIConfig = {
                    ...apiConfig,
                    openAIBaseUrl: 'https://api.studio.nebius.com/v1/', 
                };
                // The openAIService is already compatible with DeepSeek's requirements (no system role, etc.)
                return await openAIService.generateWithTools(userInput, systemInstruction, model.id, deepSeekApiConfig, relevantTools, files, true);
            case ModelProvider.Ollama:
                // Note: Ollama doesn't support multimodal input via this service yet.
                return await ollamaService.generateWithTools(userInput, systemInstruction, model.id, apiConfig, relevantTools);
            case ModelProvider.HuggingFace:
                // Note: HuggingFace implementation here doesn't support multimodal tool input.
                // It will use text-based tool emulation. Files are ignored.
                return await huggingFaceService.generateWithTools(userInput, systemInstruction, model.id, apiConfig, relevantTools);
            default:
                throw new Error(`Model provider '${model.provider}' does not support tool generation.`);
        }
    } catch (e: any) {
        console.error(`Error processing request with ${model.provider}:`, e);
        throw new Error(`[${model.provider} Error] ${e.message}`);
    }
};

export const generateTextFromModel = async (
    prompt: { text: string; files: { type: string, data: string }[] },
    systemInstruction: string,
    model: AIModel,
    apiConfig: APIConfig,
    onProgress: (message: string) => void = () => {},
): Promise<string> => {
     const { text: userInput, files } = prompt;
     try {
        switch (model.provider) {
            case ModelProvider.GoogleAI:
                return await geminiService.generateText(userInput, systemInstruction, model.id, apiConfig.googleAIAPIKey || '', files);
            case ModelProvider.OpenAI_API:
                return await openAIService.generateText(userInput, systemInstruction, model.id, apiConfig, files);
            case ModelProvider.DeepSeek:
                return await deepseekService.generateText(userInput, systemInstruction, model.id, apiConfig, files);
            case ModelProvider.Ollama:
                 return await ollamaService.generateText(userInput, systemInstruction, model.id, apiConfig, files);
            case ModelProvider.HuggingFace:
                return await huggingFaceService.generateText(userInput, systemInstruction, model.id, 0.1, apiConfig, onProgress);
            case ModelProvider.Wllama:
                 return await wllamaService.generateText(userInput, systemInstruction, model.id, 0.1, apiConfig, onProgress);
            default:
                throw new Error(`Model provider '${model.provider}' not supported for text generation.`);
        }
    } catch (e: any) {
        console.error(`Error generating text with ${model.provider}:`, e);
        throw new Error(`[${model.provider} Error] ${e.message}`);
    }
};


export const contextualizeWithSearch = async (
    prompt: { text: string; files: any[] },
    apiConfig: APIConfig,
    model: AIModel
): Promise<{ summary: string; sources: { title: string; uri: string }[] }> => {
    // Currently, only Gemini is configured for this specific search-grounded generation.
    if (model.provider !== ModelProvider.GoogleAI) {
        console.warn(`Web search is only available for GoogleAI models. The selected model is ${model.provider}. Skipping search.`);
        return { summary: '', sources: [] };
    }
    return geminiService.contextualizeWithSearch(prompt, apiConfig.googleAIAPIKey || '', model.id);
};


export const filterToolsWithLLM = async (
    userRequest: string,
    tools: LLMTool[],
    model: AIModel,
    apiConfig: APIConfig,
    logEvent: (msg: string) => void,
): Promise<LLMTool[]> => {
    logEvent(`[LLM Filter] Filtering ${tools.length} tools for request: "${userRequest}"`);
    const toolDescriptions = tools.map(t => `Tool: ${t.name}\nDescription: ${t.description}`).join('\n\n');
    const systemPrompt = "You are a tool selection expert. Analyze the user's request and the list of available tools. Respond with ONLY a comma-separated list of the names of the tools that are most relevant to fulfilling the request.";
    const prompt = {
        text: `User Request: "${userRequest}"\n\nAvailable Tools:\n${toolDescriptions}\n\nRelevant tool names:`,
        files: [],
    };
    
    try {
        const responseText = await generateTextFromModel(prompt, systemPrompt, model, apiConfig, logEvent);
        const relevantToolNames = new Set(responseText.split(',').map(name => name.trim()));
        const filteredTools = tools.filter(t => relevantToolNames.has(t.name));
        logEvent(`[LLM Filter] Selected ${filteredTools.length} tools: ${Array.from(relevantToolNames).join(', ')}`);
        return filteredTools;
    } catch (e) {
        logEvent(`[WARN] LLM tool filtering failed: ${e instanceof Error ? e.message : String(e)}. Falling back to using all tools.`);
        return tools;
    }
};