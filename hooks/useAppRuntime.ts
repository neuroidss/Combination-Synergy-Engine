

// VIBE_NOTE: Do not escape backticks or dollar signs in template literals in this file.
// Escaping is only for 'implementationCode' strings in tool definitions.
import React, { useCallback, useRef, useMemo } from 'react';
import { useAppStateManager } from './useAppStateManager';
import { useToolManager } from './useToolManager';
import { useToolRelevance } from './useToolRelevance';
import { useSwarmManager } from './useSwarmManager';
import * as aiService from '../services/aiService';
import * as searchService from '../services/searchService';
import * as embeddingService from '../services/embeddingService';
import type { AIToolCall, EnrichedAIResponse, LLMTool, MainView, ToolCreatorPayload, ExecuteActionFunction, SearchResult, AIModel } from '../types';

export const useAppRuntime = () => {
    const stateManager = useAppStateManager();
    const toolManager = useToolManager({ logEvent: stateManager.logEvent });
    const { findRelevantTools } = useToolRelevance({ allTools: toolManager.allTools, logEvent: stateManager.logEvent });

    const executeActionRef = useRef<ExecuteActionFunction | null>(null);

    const swarmManager = useSwarmManager({
        logEvent: stateManager.logEvent,
        setUserInput: () => {}, // Assuming direct task creation, not from a user input field
        setEventLog: stateManager.setEventLog,
        setApiCallCount: stateManager.setApiCallCount,
        findRelevantTools,
        mainView: 'SYNERGY_FORGE',
        processRequest: (prompt, systemInstruction, agentId, relevantTools) => {
             stateManager.setApiCallCount(prev => ({ ...prev, [stateManager.selectedModel.id]: (prev[stateManager.selectedModel.id] || 0) + 1 }));
            return aiService.processRequest(prompt, systemInstruction, agentId, relevantTools, stateManager.selectedModel, stateManager.apiConfig);
        },
        executeActionRef: executeActionRef,
        allTools: toolManager.allTools,
        selectedModel: stateManager.selectedModel,
        apiConfig: stateManager.apiConfig,
    });

    const getTool = useCallback((name: string): LLMTool | undefined => {
        return toolManager.allTools.find(t => t.name === name);
    }, [toolManager.allTools]);

    const runtimeApi = useMemo(() => ({
        logEvent: stateManager.logEvent,
        isServerConnected: () => toolManager.isServerConnected,
        forceRefreshServerTools: toolManager.forceRefreshServerTools,
        // This is a new addition to expose read-only state to tools that need it.
        // It's a function to prevent stale closures.
        getState: () => ({
            selectedModel: stateManager.selectedModel,
            apiConfig: stateManager.apiConfig,
        }),
        tools: {
            run: async (toolName: string, args: Record<string, any>): Promise<any> => {
                if (!executeActionRef.current) {
                    throw new Error("Execution context not initialized.");
                }
                const toolCall: AIToolCall = { name: toolName, arguments: args };
                const result = await executeActionRef.current(toolCall, 'user-manual');
                
                // Add the result of this manual run to the main swarm history.
                // This ensures that tools called by other tools (e.g., in a workflow) are recorded.
                swarmManager.appendToSwarmHistory(result);

                if (result.executionError) {
                    throw new Error(result.executionError);
                }
                return result.executionResult;
            },
            add: (payload: ToolCreatorPayload): LLMTool => {
                const newTool = {
                    ...payload,
                    id: toolManager.generateMachineReadableId(payload.name, toolManager.tools),
                    version: 1,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                toolManager.setTools(prev => [...prev, newTool]);
                stateManager.logEvent(`[SYSTEM] Created new tool: '${newTool.name}'`);
                return newTool;
            },
            list: () => toolManager.allTools,
        },
        search: {
            pubmed: (query: string, limit: number, sinceYear?: number, proxyUrl?: string) => searchService.searchPubMed(query, stateManager.logEvent, limit, sinceYear, proxyUrl),
            biorxiv: (query: string, limit: number, sinceYear?: number, proxyUrl?: string) => searchService.searchBioRxivPmcArchive(query, stateManager.logEvent, limit, sinceYear, proxyUrl),
            patents: (query: string, limit: number, proxyUrl?: string) => searchService.searchGooglePatents(query, stateManager.logEvent, limit, proxyUrl),
            web: (query: string, limit: number, proxyUrl?: string) => searchService.searchWeb(query, stateManager.logEvent, limit, proxyUrl),
            enrichSource: (source: SearchResult, proxyUrl?: string) => searchService.enrichSource(source, stateManager.logEvent, proxyUrl),
        },
        ai: {
            generateText: (text: string, systemInstruction: string, files: { type: string, data: string }[] = []) => {
                stateManager.setApiCallCount(prev => ({ ...prev, [stateManager.selectedModel.id]: (prev[stateManager.selectedModel.id] || 0) + 1 }));
                return aiService.generateTextFromModel({ text, files }, systemInstruction, stateManager.selectedModel, stateManager.apiConfig, stateManager.logEvent);
            },
            processRequest: (text: string, systemInstruction: string, tools: LLMTool[], files: { type: string, data: string }[] = [], modelOverride?: AIModel) => {
                const modelToUse = modelOverride || stateManager.selectedModel;
                stateManager.setApiCallCount(prev => ({ ...prev, [modelToUse.id]: (prev[modelToUse.id] || 0) + 1 }));
                return aiService.processRequest({ text, files }, systemInstruction, 'tool-runtime', tools, modelToUse, stateManager.apiConfig);
            },
            search: (text: string) => {
                 stateManager.setApiCallCount(prev => ({ ...prev, [stateManager.selectedModel.id]: (prev[stateManager.selectedModel.id] || 0) + 1 }));
                 return aiService.contextualizeWithSearch({text, files: []}, stateManager.apiConfig, stateManager.selectedModel);
            },
            generateEmbeddings: (texts: string[]) => embeddingService.generateEmbeddings(texts, stateManager.logEvent),
        },
        getObservationHistory: () => [], // Placeholder for a more advanced feature
        clearObservationHistory: () => {}, // Placeholder
    }), [stateManager, toolManager, swarmManager]);

    const executeAction = useMemo<ExecuteActionFunction>(() => {
        const fn = async (
            toolCall: AIToolCall,
            agentId: string,
            context?: MainView
        ): Promise<EnrichedAIResponse> => {
            const tool = getTool(toolCall.name);
            const log = (msg: string) => stateManager.logEvent(`[${agentId}] ${msg}`);
            log(`Executing tool: ${toolCall.name}`);

            if (!tool) {
                const error = `Tool "${toolCall.name}" not found.`;
                log(`[ERROR] ${error}`);
                return { toolCall, executionError: error };
            }

            if (tool.executionEnvironment === 'Server') {
                if (!toolManager.isServerConnected) {
                    const error = `Server tool '${tool.name}' cannot be executed: Server is not connected.`;
                    log(`[ERROR] ${error}`);
                    return { toolCall, tool, executionError: error };
                }
                try {
                    const response = await fetch('http://localhost:3001/api/execute', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(toolCall),
                    });
                    const result = await response.json();
                    if (!response.ok) {
                        throw new Error(result.error || `Server responded with status ${response.status}`);
                    }
                    log(`Tool '${tool.name}' executed successfully on the server.`);
                    return { toolCall, tool, executionResult: result };
                } catch (e: any) {
                    const error = `Error executing server tool '${tool.name}': ${e.message}`;
                    log(`[ERROR] ${error}`);
                    return { toolCall, tool, executionError: e.message };
                }
            }

            try {
                const code = tool.implementationCode;
                const func = new Function('args', 'runtime', `return (async () => { ${code} })()`);
                const result = await func(toolCall.arguments, runtimeApi);
                log(`Tool '${tool.name}' executed successfully.`);
                return { toolCall, tool, executionResult: result };
            } catch (e: any) {
                const error = `Error in tool '${tool.name}': ${e.message}`;
                log(`[ERROR] ${error}`);
                return { toolCall, tool, executionError: e.message };
            }
        };

        fn.getRuntimeApiForAgent = (agentId: string) => runtimeApi;

        return fn;
    }, [getTool, stateManager.logEvent, runtimeApi, toolManager.isServerConnected]);

    executeActionRef.current = executeAction;

    return {
        ...stateManager,
        ...toolManager,
        ...swarmManager,
        runtimeApi,
        getTool,
    };
};