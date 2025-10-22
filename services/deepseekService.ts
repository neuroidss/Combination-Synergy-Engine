// services/deepseekService.ts
import type { APIConfig } from "../types";

const DEEPSEEK_TIMEOUT = 600000; // 10 minutes

// Helper function to strip <think> blocks from model output
const stripThinking = (text: string | null | undefined): string => {
    if (!text) return "";
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
};

const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e: any) {
        clearTimeout(id);
        if (e.name === 'AbortError') {
            throw new Error(`Request to DeepSeek timed out after ${timeout / 1000}s.`);
        }
        throw e;
    }
};

const handleAPIError = async (response: Response, baseUrl: string) => {
    let errorBody;
    try {
        errorBody = await response.json();
    } catch (e) {
        errorBody = await response.text();
    }
    console.error('Error from DeepSeek API:', response.status, errorBody);
    
    let message = `[DeepSeek Error ${response.status}]`;
    if (response.status === 401) {
        message += ` Authentication failed. Check your API Key.`;
    } else if (response.status === 404) {
        message += ` Model not found or invalid API endpoint. Check your Base URL: ${baseUrl}`;
    } else if (typeof errorBody === 'object' && errorBody?.error?.message) {
        message += ` ${errorBody.error.message}`;
    } else if (typeof errorBody === 'string') {
        message += ` ${errorBody}`;
    } else {
        message += ` ${response.statusText}`;
    }
    throw new Error(message);
};


export const generateText = async (
    userInput: string,
    systemInstruction: string,
    modelId: string,
    apiConfig: APIConfig,
    files: { type: string, data: string }[] = []
): Promise<string> => {
    // The user's provided code snippet suggests the API key is passed via the 'openAIAPIKey' field.
    const apiKey = apiConfig.openAIAPIKey;
    const baseUrl = 'https://api.studio.nebius.com/v1/';

    if (!apiKey) throw new Error("DeepSeek (Nebius) API Key is missing. Please enter it in the OpenAI-compatible API Key field.");
    
    const combinedUserPrompt = `${systemInstruction}\n\n---\n\n${userInput}`;

    // DeepSeek doesn't support multimodal input, so we'll ignore files and send a text-only request.
    const userMessageContent = combinedUserPrompt;

    const body = {
        model: modelId,
        messages: [
            { role: 'user', content: userMessageContent }
        ],
        temperature: 0.1,
        max_tokens: 8192,
        top_p: 0.95,
    };
    
    try {
        const response = await fetchWithTimeout(
            `${baseUrl.replace(/\/+$/, '')}/chat/completions`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify(body),
            },
            DEEPSEEK_TIMEOUT
        );

        if (!response.ok) {
            await handleAPIError(response, baseUrl);
            return ""; // Should not be reached
        }

        const data = await response.json();
        return stripThinking(data.choices?.[0]?.message?.content);
    } catch (e) {
        if (e instanceof Error && e.message.toLowerCase().includes('failed to fetch')) {
             throw new Error(`Network Error: Could not connect to DeepSeek API at ${baseUrl}. \n\nCommon causes:\n1. The server is not running.\n2. The Base URL is incorrect.\n3. A browser security feature (CORS) is blocking the request.`);
        }
        throw e;
    }
};