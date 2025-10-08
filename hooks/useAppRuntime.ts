// VIBE_NOTE: Do not escape backticks or dollar signs in template literals in this file.
// Escaping is only for 'implementationCode' strings in tool definitions.
import React, { useCallback, useRef, useMemo } from 'react';
import { useAppStateManager } from './useAppStateManager';
import { useToolManager } from './useToolManager';
import { useToolRelevance } from './useToolRelevance';
import { useSwarmManager } from './useSwarmManager';
import * as aiService from '../services/aiService';
// FIX: Import ExecuteActionFunction to correctly type the ref and its assignment.
import type { AIToolCall, EnrichedAIResponse, LLMTool, MainView, ToolCreatorPayload, ExecuteActionFunction } from '../types';

export const useAppRuntime = () => {
    const stateManager = useAppStateManager();
    const toolManager = useToolManager({ logEvent: stateManager.logEvent });
    const { findRelevantTools } = useToolRelevance({ allTools: toolManager.allTools, logEvent: stateManager.logEvent });

    // FIX: The ref type is updated to ExecuteActionFunction to match the type expected by useSwarmManager.
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
        tools: {
            run: (toolName: string, args: Record<string, any>): Promise<any> => {
                if (!executeActionRef.current) {
                    return Promise.reject(new Error("Execution context not initialized."));
                }
                const toolCall: AIToolCall = { name: toolName, arguments: args };
                return executeActionRef.current(toolCall, 'user-manual').then(result => {
                    if (result.executionError) throw new Error(result.executionError);
                    return result.executionResult;
                });
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
        ai: {
            generateText: (text: string, systemInstruction: string, files: {name: string, type: string, data: string}[] = []) => {
                stateManager.setApiCallCount(prev => ({ ...prev, [stateManager.selectedModel.id]: (prev[stateManager.selectedModel.id] || 0) + 1 }));
                return aiService.generateTextFromModel({ text, files }, systemInstruction, stateManager.selectedModel, stateManager.apiConfig, stateManager.logEvent);
            },
            search: (text: string) => {
                 stateManager.setApiCallCount(prev => ({ ...prev, [stateManager.selectedModel.id]: (prev[stateManager.selectedModel.id] || 0) + 1 }));
                 // FIX: Added the missing `stateManager.selectedModel` argument to the `contextualizeWithSearch` call.
                 return aiService.contextualizeWithSearch({text, files: []}, stateManager.apiConfig, stateManager.selectedModel);
            }
        },
        getObservationHistory: () => [], // Placeholder for a more advanced feature
        clearObservationHistory: () => {}, // Placeholder
    }), [stateManager, toolManager]);

    // FIX: The executeAction function is now created with useMemo to construct a callable object
    // that includes the `getRuntimeApiForAgent` property, satisfying the `ExecuteActionFunction` type.
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

            try {
                const code = tool.implementationCode;
                const func = new Function('args', 'runtime', `return (async () => { ${code} })()`);
                const result = await func(toolCall.arguments, runtimeApi);
                log(`Tool '${toolCall.name}' executed successfully.`);
                return { toolCall, tool, executionResult: result };
            } catch (e: any) {
                const error = `Error in tool '${toolCall.name}': ${e.message}`;
                log(`[ERROR] ${error}`);
                return { toolCall, tool, executionError: e.message };
            }
        };

        fn.getRuntimeApiForAgent = (agentId: string) => runtimeApi;

        return fn;
    }, [getTool, stateManager.logEvent, runtimeApi]);

    executeActionRef.current = executeAction;

    return {
        ...stateManager,
        ...toolManager,
        // FIX: The swarmManager hook now returns a flat object. Spreading it directly provides all its state and handlers to the runtime.
        // This resolves a complex type inference issue where TypeScript incorrectly inferred the hook's return type as void.
        ...swarmManager,
        runtimeApi,
        getTool,
    };
};
