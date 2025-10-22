// VIBE_NOTE: Do not escape backticks or dollar signs in template literals in this file.
// Escaping is only for 'implementationCode' strings in tool definitions.
import type { APIConfig, LLMTool, AIResponse, AIToolCall } from "../types";

const OLLAMA_TIMEOUT = 600000; // 10 minutes

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
            throw new Error(`Request to Ollama timed out after ${timeout / 1000} seconds. The model might be too large for your system, or the Ollama server is not responding.`);
        }
        throw e;
    }
};

const handleAPIError = async (response: Response) => {
    try {
        const errorBody = await response.text();
        console.error('Error from Ollama API:', response.status, errorBody);
        throw new Error(`[Ollama Error ${response.status}]: ${errorBody || response.statusText}`);
    } catch (e: any) {
         throw new Error(`[Ollama Error ${response.status}]: Could not parse error response.`);
    }
};

const generateDetailedError = (error: unknown, host: string): Error => {
    let finalMessage: string;
    if (error instanceof Error) {
        const lowerCaseMessage = error.message.toLowerCase();
        if (lowerCaseMessage.includes('failed to fetch') || lowerCaseMessage.includes('networkerror') || lowerCaseMessage.includes('could not connect')) {
            finalMessage = `Network Error: Failed to connect to Ollama server at ${host}. Please ensure the server is running, the host URL is correct, and there are no network issues (e.g., firewalls or CORS policies) blocking the connection.`;
        } else {
             finalMessage = `[Ollama Service Error] ${error.message}`;
        }
    } else {
        finalMessage = "An unknown error occurred while communicating with Ollama.";
    }
    const processingError = new Error(finalMessage) as any;
    processingError.rawAIResponse = "Could not get raw response due to an error.";
    return processingError;
};

const buildOllamaTools = (tools: LLMTool[]) => {
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
        console.warn(`[Ollama Service] Fallback tool call parsing failed for JSON string: "${jsonString}"`, e);
        return null;
    }
};

export const generateWithTools = async (
    userInput: string,
    systemInstruction: string,
    modelId: string,
    apiConfig: APIConfig,
    tools: LLMTool[]
): Promise<AIResponse> => {
    const { ollamaHost } = apiConfig;
    if (!ollamaHost) {
        throw new Error("Ollama Host URL is not configured. Please set it in the API Configuration.");
    }
    
    const ollamaTools = buildOllamaTools(tools);
    const toolNameMap = new Map(tools.map(t => [t.name.replace(/[^a-zA-Z0-9_]/g, '_'), t.name]));
    // Add original names as well for the fallback parser to find them
    tools.forEach(tool => {
        toolNameMap.set(tool.name, tool.name);
    });

    const fallbackInstruction = `\n\nWhen you need to use a tool, you can use the provided 'tools' array. If the tool functionality is unavailable or you are not configured for it, you MUST respond with ONLY a JSON object (or an array of objects) in the following format, inside a \`\`\`json block:
[
  {
    "name": "tool_name_to_call",
    "arguments": { "arg1": "value1", "arg2": "value2" }
  }
]`;

    const body = {
        model: modelId,
        messages: [
            { role: 'system', content: systemInstruction + fallbackInstruction },
            { role: 'user', content: userInput }
        ],
        stream: false,
        tools: ollamaTools.length > 0 ? ollamaTools : undefined,
        options: {
            temperature: 0.1,
            num_predict: 4096,
        },
    };

    try {
        const response = await fetchWithTimeout(
            `${ollamaHost.replace(/\/+$/, '')}/api/chat`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            },
            OLLAMA_TIMEOUT
        );

        if (!response.ok) {
            await handleAPIError(response);
            return { toolCalls: null }; // Should not be reached
        }

        const data = await response.json();
        const toolCallsData = data.message?.tool_calls;
        const responseContent = stripThinking(data.message?.content);
        
        if (toolCallsData && Array.isArray(toolCallsData) && toolCallsData.length > 0) {
            const toolCalls: AIToolCall[] = toolCallsData.map(tc => {
                const toolCall = tc.function;
                const originalName = toolNameMap.get(toolCall.name) || toolCall.name;
                
                // Robust argument parsing
                const args = toolCall.arguments;
                let parsedArgs = {};
                 if (typeof args === 'object' && args !== null) {
                    parsedArgs = args;
                } else if (typeof args === 'string') {
                    try {
                        parsedArgs = JSON.parse(args || '{}');
                    } catch (e) {
                        console.error(`[Ollama Service] Failed to parse arguments string for tool ${originalName}:`, e);
                        // Return empty args if parsing fails
                    }
                }

                return {
                    name: originalName,
                    arguments: parsedArgs
                };
            }).filter(Boolean); // Filter out any potential nulls from parsing errors
            return { toolCalls, text: responseContent };
        }
        
        // Fallback: Check text content for a tool call
        if (responseContent) {
            console.log("[Ollama Service] No native tool call found. Attempting to parse from text content.");
            const parsedToolCalls = parseToolCallFromText(responseContent, toolNameMap);
            if (parsedToolCalls) {
                console.log("[Ollama Service] Successfully parsed tool call from text.", parsedToolCalls);
                return { toolCalls: parsedToolCalls, text: responseContent };
            }
        }
        
        return { toolCalls: null, text: responseContent };

    } catch (e) {
        throw generateDetailedError(e, ollamaHost);
    }
};

export const generateText = async (
    userInput: string,
    systemInstruction: string,
    modelId: string,
    apiConfig: APIConfig,
    files: { type: string, data: string }[] = []
): Promise<string> => {
    const { ollamaHost } = apiConfig;
    if (!ollamaHost) {
        throw new Error("Ollama Host URL is not configured. Please set it in the API Configuration.");
    }

    const userMessage: any = { role: 'user', content: userInput };
    if (files.length > 0) {
        userMessage.images = files.map(f => f.data);
    }

    const body = {
        model: modelId,
        messages: [
            { role: 'system', content: systemInstruction },
            userMessage
        ],
        stream: false,
        options: {
            temperature: 0.0,
            num_predict: 4096,
        },
    };

    try {
        const response = await fetchWithTimeout(
            `${ollamaHost.replace(/\/+$/, '')}/api/chat`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            },
            OLLAMA_TIMEOUT
        );

        if (!response.ok) {
            await handleAPIError(response);
            return ""; // Should not be reached
        }

        const data = await response.json();
        return stripThinking(data.message?.content);
    } catch (e) {
        throw generateDetailedError(e, ollamaHost);
    }
};