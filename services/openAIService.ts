// VIBE_NOTE: Do not escape backticks or dollar signs in template literals in this file.
// Escaping is only for 'implementationCode' strings in tool definitions.
import type { APIConfig, LLMTool, AIResponse, AIToolCall } from "../types";

const OPENAI_TIMEOUT = 600000; // 10 минут

// Helper function to strip <think> blocks from model output
const stripThinking = (text: string | null | undefined): string => {
    if (!text) return "";
    // This regex removes any <think>...</think> blocks and trims whitespace.
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
            throw new Error(`Request to OpenAI timed out after ${timeout / 1000}s.`);
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
    console.error('Error from OpenAI-compatible API:', response.status, errorBody);
    
    let message = `[OpenAI Error ${response.status}]`;
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

const buildOpenAITools = (tools: LLMTool[]) => {
    return tools.map(tool => ({
        type: 'function',
        function: {
            name: tool.name.replace(/[^a-zA-Z0-9_]/g, '_'),
            description: tool.description,
            parameters: {
                type: 'object',
                properties: tool.parameters.reduce((obj, param) => {
                     if (param.type === 'array' || param.type === 'object') {
                        // For complex types, tell the model to expect a string, which we will treat as JSON.
                        obj[param.name] = { type: 'string', description: `${param.description} (This argument must be a valid, JSON-formatted string.)` };
                    } else {
                        const typeMapping = { 'string': 'string', 'number': 'number', 'boolean': 'boolean' };
                        obj[param.name] = { type: typeMapping[param.type] || 'string', description: param.description };
                    }
                    return obj;
                }, {} as Record<string, any>),
                required: tool.parameters.filter(p => p.required).map(p => p.name),
            },
        },
    }));
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
        console.warn(`[OpenAI Service] Fallback tool call parsing failed for JSON string: "${jsonString}"`, e);
        return null;
    }
};

export const generateWithTools = async (
    userInput: string,
    systemInstruction: string,
    modelId: string,
    apiConfig: APIConfig,
    tools: LLMTool[],
    files: { type: string, data: string }[] = [],
    emulateToolCalling: boolean = false
): Promise<AIResponse> => {
    const { openAIAPIKey, openAIBaseUrl } = apiConfig;

    if (!openAIAPIKey) throw new Error("OpenAI API Key is missing.");
    if (!openAIBaseUrl) throw new Error("OpenAI Base URL is missing.");
    
    const openAITools = buildOpenAITools(tools);
    const toolNameMap = new Map(tools.map(t => [t.name.replace(/[^a-zA-Z0-9_]/g, '_'), t.name]));
    // Add original names as well for the fallback parser to find them
    tools.forEach(tool => {
        toolNameMap.set(tool.name, tool.name);
    });

    const fallbackInstruction = `\n\nWhen you need to use a tool, you can use the provided 'tools' array. If the tool functionality is unavailable or you are not configured for it, you MUST respond with ONLY a JSON object (or an array of objects) in the following format, inside a \`\`\`json block.
[
  {
    "name": "tool_name_to_call",
    "arguments": { "arg1": "value1", "arg2": "value2" }
  }
]`;

    // Combine system and user prompts for better compatibility with models that don't support a 'system' role.
    const combinedUserPrompt = `${systemInstruction}${fallbackInstruction}\n\n---\n\n${userInput}`;

    let userMessageContent: any;
    if (files && files.length > 0) {
        // Use array format for multimodal requests
        userMessageContent = [{ type: 'text', text: combinedUserPrompt }];
        files.forEach(file => {
            userMessageContent.push({
                type: 'image_url',
                image_url: {
                    url: `data:${file.type};base64,${file.data}`
                }
            });
        });
    } else {
        // Use string format for text-only requests
        userMessageContent = combinedUserPrompt;
    }

    const body = {
        model: modelId,
        messages: [
            { role: 'user', content: userMessageContent }
        ],
        temperature: 0.1,
        max_tokens: 4096,
        top_p: 0.95,
        tools: !emulateToolCalling && openAITools.length > 0 ? openAITools : undefined,
        tool_choice: !emulateToolCalling && openAITools.length > 0 ? "auto" : undefined,
    };
    
    try {
        const response = await fetchWithTimeout(
            `${openAIBaseUrl.replace(/\/+$/, '')}/chat/completions`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAIAPIKey}` },
                body: JSON.stringify(body)
            },
            OPENAI_TIMEOUT
        );

        if (!response.ok) {
            await handleAPIError(response, openAIBaseUrl);
            return { toolCalls: null }; // Should not be reached
        }

        const data = await response.json();
        const toolCallsData = data.choices?.[0]?.message?.tool_calls;
        const responseContent = stripThinking(data.choices?.[0]?.message?.content);
        
        if (toolCallsData && Array.isArray(toolCallsData) && toolCallsData.length > 0) {
            try {
                const toolCalls: AIToolCall[] = toolCallsData.map(tc => {
                    const toolCall = tc.function;
                    const originalName = toolNameMap.get(toolCall.name) || toolCall.name;
                    
                    // Robust argument parsing: handles both stringified JSON and objects.
                    const args = toolCall.arguments;
                    let parsedArgs = {};
                    if (typeof args === 'string') {
                        try {
                            parsedArgs = JSON.parse(args || '{}');
                        } catch (e) {
                             console.error(`[OpenAI Service] Failed to parse arguments string for tool ${originalName}:`, e);
                             // Return empty args if parsing fails
                        }
                    } else if (typeof args === 'object' && args !== null) {
                        parsedArgs = args;
                    }

                    return {
                        name: originalName,
                        arguments: parsedArgs
                    };
                });
                return { toolCalls, text: responseContent };
            } catch (e) {
                throw new Error(`Failed to process arguments from AI tool call: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
        
        // Fallback: Check text content for a tool call
        if (responseContent) {
            console.log("[OpenAI Service] No native tool call found. Attempting to parse from text content.");
            const parsedToolCalls = parseToolCallFromText(responseContent, toolNameMap);
            if (parsedToolCalls) {
                console.log("[OpenAI Service] Successfully parsed tool call from text.", parsedToolCalls);
                return { toolCalls: parsedToolCalls, text: responseContent };
            }
        }
        
        return { toolCalls: null, text: responseContent };

    } catch (e) {
        if (e instanceof Error && e.message.toLowerCase().includes('failed to fetch')) {
             throw new Error(`Network Error: Could not connect to OpenAI-compatible API at ${openAIBaseUrl}. \n\nCommon causes:\n1. The server is not running.\n2. The Base URL is incorrect.\n3. A browser security feature (CORS) is blocking the request. If you are running a local server (like Ollama), ensure it's configured to accept requests from this web app's origin.`);
        }
        throw e;
    }
};

export const generateText = async (
    userInput: string,
    systemInstruction: string,
    modelId: string,
    apiConfig: APIConfig,
    files: { type: string, data: string }[] = []
): Promise<string> => {
    const { openAIAPIKey, openAIBaseUrl } = apiConfig;

    if (!openAIAPIKey) throw new Error("OpenAI API Key is missing.");
    if (!openAIBaseUrl) throw new Error("OpenAI Base URL is missing.");
    
    // Combine system and user prompts for better compatibility with models that don't support a 'system' role.
    const combinedUserPrompt = `${systemInstruction}\n\n---\n\n${userInput}`;

    let userMessageContent: any;
    if (files && files.length > 0) {
        // Use array format for multimodal requests
        userMessageContent = [{ type: 'text', text: combinedUserPrompt }];
        files.forEach(file => {
            userMessageContent.push({
                type: 'image_url',
                image_url: {
                    url: `data:${file.type};base64,${file.data}`
                }
            });
        });
    } else {
        // Use string format for text-only requests
        userMessageContent = combinedUserPrompt;
    }

    const body = {
        model: modelId,
        messages: [
            { role: 'user', content: userMessageContent }
        ],
        temperature: 0.0,
        max_tokens: 4096,
    };
    
    try {
        const response = await fetchWithTimeout(
            `${openAIBaseUrl.replace(/\/+$/, '')}/chat/completions`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAIAPIKey}` },
                body: JSON.stringify(body),
            },
            OPENAI_TIMEOUT
        );

        if (!response.ok) {
            await handleAPIError(response, openAIBaseUrl);
            return ""; // Should not be reached
        }

        const data = await response.json();
        return stripThinking(data.choices?.[0]?.message?.content);
    } catch (e) {
        if (e instanceof Error && e.message.toLowerCase().includes('failed to fetch')) {
             throw new Error(`Network Error: Could not connect to OpenAI-compatible API at ${openAIBaseUrl}. \n\nCommon causes:\n1. The server is not running.\n2. The Base URL is incorrect.\n3. A browser security feature (CORS) is blocking the request. If you are running a local server (like Ollama), ensure it's configured to accept requests from this web app's origin.`);
        }
        throw e;
    }
};