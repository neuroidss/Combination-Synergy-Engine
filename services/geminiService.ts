// VIBE_NOTE: Do not escape backticks or dollar signs in template literals in this file.
// Escaping is only for 'implementationCode' strings in tool definitions.
import { GoogleGenAI, FunctionDeclaration, GenerateContentResponse, Type, Part } from "@google/genai";
import type { APIConfig, LLMTool, AIResponse, AIToolCall, ScoredTool } from "../types";

const geminiInstances: Map<string, GoogleGenAI> = new Map();

const getGeminiInstance = (apiKey: string): GoogleGenAI => {
    if (!geminiInstances.has(apiKey)) {
        geminiInstances.set(apiKey, new GoogleGenAI({ apiKey }));
    }
    return geminiInstances.get(apiKey)!;
};

const sanitizeToolName = (name: string): string => {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

const mapTypeToGemini = (type: LLMTool['parameters'][0]['type']): Type => {
    switch (type) {
        case 'string': return Type.STRING;
        case 'number': return Type.NUMBER;
        case 'boolean': return Type.BOOLEAN;
        case 'array': return Type.STRING;
        case 'object': return Type.STRING;
        default: return Type.STRING;
    }
}

const buildGeminiTools = (tools: LLMTool[]): FunctionDeclaration[] => {
    return tools.map(tool => ({
        name: sanitizeToolName(tool.name),
        description: tool.description,
        parameters: {
            type: Type.OBJECT,
            properties: tool.parameters.reduce((obj, param) => {
                const isComplexType = param.type === 'array' || param.type === 'object';
                obj[param.name] = {
                    type: mapTypeToGemini(param.type),
                    description: isComplexType 
                        ? `\${param.description} (This argument must be a valid, JSON-formatted string.)`
                        : param.description,
                };
                return obj;
            }, {} as Record<string, any>),
            required: tool.parameters.filter(p => p.required).map(p => p.name),
        },
    }));
};

const buildParts = (userInput: string, files: { type: string; data: string }[]): Part[] => {
    const parts: Part[] = [{ text: userInput }];
    for (const file of files) {
        parts.push({
            inlineData: {
                mimeType: file.type,
                data: file.data,
            },
        });
    }
    return parts;
};

export const generateWithTools = async (
    userInput: string,
    systemInstruction: string,
    modelId: string,
    apiConfig: APIConfig,
    tools: LLMTool[],
    files: { type: string, data: string }[] = []
): Promise<AIResponse> => {
    const apiKey = apiConfig.googleAIAPIKey;
    if (!apiKey) throw new Error("Google AI API Key is missing.");

    const ai = getGeminiInstance(apiKey);
    const geminiTools = buildGeminiTools(tools);
    
    const toolNameMap = new Map(tools.map(t => [sanitizeToolName(t.name), t.name]));

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: modelId,
        contents: { parts: buildParts(userInput, files), role: 'user' },
        config: {
            systemInstruction,
            tools: [{ functionDeclarations: geminiTools }],
        }
    });

    const toolCalls: AIToolCall[] | null = response.functionCalls?.map(fc => {
        const originalName = toolNameMap.get(fc.name) || fc.name;
        
        const toolDefinition = tools.find(t => t.name === originalName);
        const parsedArgs = { ...fc.args };
        if (toolDefinition) {
            for (const param of toolDefinition.parameters) {
                if ((param.type === 'array' || param.type === 'object') && typeof parsedArgs[param.name] === 'string') {
                    try {
                        parsedArgs[param.name] = JSON.parse(parsedArgs[param.name]);
                    } catch (e) {
                        console.warn(`[Gemini Service] Failed to parse JSON string for argument '\${param.name}' in tool '\${originalName}'. Leaving as string. Error: \${e}`);
                    }
                }
            }
        }
        
        return {
            name: originalName,
            arguments: parsedArgs,
        };
    }) || null;

    return { toolCalls, text: response.text };
};

export const generateText = async (
    userInput: string,
    systemInstruction: string,
    modelId: string,
    apiConfig: APIConfig,
    files: { type: string, data: string }[] = []
): Promise<string> => {
    const apiKey = apiConfig.googleAIAPIKey;
    if (!apiKey) throw new Error("Google AI API Key is missing.");

    const ai = getGeminiInstance(apiKey);
    
    const response = await ai.models.generateContent({
        model: modelId,
        contents: { parts: buildParts(userInput, files), role: 'user' },
        config: { systemInstruction }
    });

    return response.text;
};

export const contextualizeWithSearch = async (
    prompt: { text: string; files: any[] },
    apiConfig: APIConfig,
    modelId: string
): Promise<{ summary: string; sources: { title: string; uri: string }[] }> => {
    const apiKey = apiConfig.googleAIAPIKey;
    if (!apiKey) throw new Error("Google AI API Key is missing for search.");

    const ai = getGeminiInstance(apiKey);
    const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt.text,
        config: {
            tools: [{ googleSearch: {} }],
        },
    });

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    if (!groundingMetadata?.groundingChunks) {
        return { summary: response.text, sources: [] };
    }
    
    const sources = groundingMetadata.groundingChunks
        .map((chunk: any) => chunk.web)
        .filter(Boolean)
        .map((web: any) => ({ title: web.title || "Untitled", uri: web.uri }))
        .filter((source, index, self) => index === self.findIndex(s => s.uri === source.uri)); // Unique sources

    return { summary: response.text, sources };
};