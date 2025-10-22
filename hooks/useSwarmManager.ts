// VIBE_NOTE: Do not escape backticks or dollar signs in template literals in this file.
// Escaping is only for 'implementationCode' strings in tool definitions.
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SWARM_AGENT_SYSTEM_PROMPT, CORE_TOOLS } from '../constants';
import { contextualizeWithSearch, filterToolsWithLLM } from '../services/aiService';
import type { AgentWorker, EnrichedAIResponse, AgentStatus, AIToolCall, LLMTool, ExecuteActionFunction, ScoredTool, MainView, ToolRelevanceMode, AIModel, APIConfig, AIResponse } from '../types';

type UseSwarmManagerProps = {
    logEvent: (message: string) => void;
    setUserInput: (input: string) => void;
    setEventLog: (callback: (prev: string[]) => string[]) => void;
    setApiCallCount: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    findRelevantTools: (userRequestText: string, allTools: LLMTool[], topK: number, threshold: number, systemPromptForContext: string | null, mainView?: MainView | null) => Promise<ScoredTool[]>;
    mainView: MainView;
    processRequest: (prompt: { text: string; files: any[] }, systemInstruction: string, agentId: string, relevantTools: LLMTool[]) => Promise<AIResponse>;
    executeActionRef: React.MutableRefObject<ExecuteActionFunction | null>;
    allTools: LLMTool[];
    selectedModel: AIModel;
    apiConfig: APIConfig;
};

type PauseState = null;

export type StartSwarmTaskOptions = {
    task: any;
    systemPrompt: string | null;
    sequential?: boolean;
    resume?: boolean;
    historyEventToInject?: EnrichedAIResponse | null;
    allTools: LLMTool[];
};

type ScriptExecutionState = 'idle' | 'running' | 'paused' | 'finished' | 'error';
type StepStatus = { status: 'pending' | 'completed' | 'error'; result?: any; error?: string };

// Helper to stringify results for the agent's history prompt, avoiding excessively long text.
const resultToString = (result: any): string => {
    if (result === undefined || result === null) return 'No result.';

    try {
        // Custom replacer to aggressively truncate long text fields to keep history concise.
        const replacer = (key: string, value: any) => {
            if (key === 'implementationCode') return '[...code...]';
            if ((key === 'summary' || key === 'snippet') && typeof value === 'string' && value.length > 150) {
                return value.substring(0, 150) + '...';
            }
            return value;
        };
        
        // Pre-sanitize the result to shorten long text fields.
        const sanitizedResult = JSON.parse(JSON.stringify(result, replacer));
        let str = JSON.stringify(sanitizedResult);

        // If the string is still too long after sanitation, we must return a valid summary, not a broken string.
        if (str.length > 2500) {
            // Special summary for search results, which are a common cause of large outputs.
            if (sanitizedResult && Array.isArray(sanitizedResult.searchResults)) {
                return JSON.stringify({
                    success: sanitizedResult.success,
                    message: `Found ${sanitizedResult.searchResults.length} articles. The full list is available to be passed to the next tool, but was omitted from history for brevity.`,
                });
            }
            // Generic summary for other large tool outputs.
            return `Tool executed successfully, but its output is too large to display in this context.`;
        }
        
        return str;

    } catch (e) {
        return `[Error: Could not serialize the tool's result for display in history.]`;
    }
};


export const useSwarmManager = (props: UseSwarmManagerProps) => {
    const { 
        logEvent, setUserInput, setEventLog, setApiCallCount, findRelevantTools, mainView,
        processRequest, executeActionRef, allTools, selectedModel, apiConfig 
    } = props;

    const [agentSwarm, setAgentSwarm] = useState<AgentWorker[]>([]);
    const [isSwarmRunning, setIsSwarmRunning] = useState(false);
    const [currentUserTask, setCurrentUserTask] = useState<any>(null);
    const [currentSystemPrompt, setCurrentSystemPrompt] = useState<string>(SWARM_AGENT_SYSTEM_PROMPT);
    const [pauseState, setPauseState] = useState<PauseState>(null);
    const [lastSwarmRunHistory, setLastSwarmRunHistory] = useState<EnrichedAIResponse[] | null>(null);
    const [liveSwarmHistory, setLiveSwarmHistory] = useState<EnrichedAIResponse[]>([]);
    const [isSequential, setIsSequential] = useState(false);
    const [activeToolsForTask, setActiveToolsForTask] = useState<ScoredTool[]>([]);
    const [relevanceTopK, setRelevanceTopK] = useState<number>(25);
    const [relevanceThreshold, setRelevanceThreshold] = useState<number>(0.1);
    const [relevanceMode, setRelevanceMode] = useState<ToolRelevanceMode>('All');
    
    // --- Scripted Workflow State ---
    const [scriptExecutionState, setScriptExecutionState] = useState<ScriptExecutionState>('idle');
    const [stepStatuses, setStepStatuses] = useState<StepStatus[]>([]);
    const [currentScriptStepIndex, setCurrentScriptStepIndex] = useState(0);
    
    const swarmIterationCounter = useRef(0);
    const swarmHistoryRef = useRef<EnrichedAIResponse[]>([]);
    const isRunningRef = useRef(isSwarmRunning);
    const agentSwarmRef = useRef(agentSwarm);
    const isCycleInProgress = useRef(false);
    
    useEffect(() => { isRunningRef.current = isSwarmRunning; }, [isSwarmRunning]);
    useEffect(() => { agentSwarmRef.current = agentSwarm; }, [agentSwarm]);

    useEffect(() => {
        if (isSwarmRunning && !isCycleInProgress.current) {
            requestAnimationFrame(() => (window as any).__runSwarmCycle());
        }
    }, [isSwarmRunning]);


    const handleStopSwarm = useCallback((reason?: string, isPause: boolean = false) => {
        if (isRunningRef.current) {
            isRunningRef.current = false;
            setIsSwarmRunning(false);
            setScriptExecutionState(prev => (prev === 'running' || prev === 'paused') ? 'idle' : prev);
            setActiveToolsForTask([]);
            const reasonText = reason ? `: ${reason}` : ' by user.';
            logEvent(`[INFO] 🛑 Task ${isPause ? 'paused' : 'stopped'}${reasonText}`);
            if (!isPause && swarmHistoryRef.current.length > 0) {
                setLastSwarmRunHistory([...swarmHistoryRef.current]);
            }
        }
    }, [logEvent]);

    const clearPauseState = useCallback(() => setPauseState(null), []);
    const clearLastSwarmRunHistory = useCallback(() => setLastSwarmRunHistory(null), []);
    const appendToSwarmHistory = useCallback((item: EnrichedAIResponse) => { 
        swarmHistoryRef.current.push(item);
        setLiveSwarmHistory([...swarmHistoryRef.current]);
     }, []);

    const toggleScriptPause = useCallback(() => {
        setScriptExecutionState(prev => {
            const newState = prev === 'running' ? 'paused' : 'running';
            logEvent(newState === 'paused' ? '[SCRIPT] Paused.' : '[SCRIPT] Resumed.');
            return newState;
        });
    }, [logEvent]);

    const stepForward = useCallback(() => {
        if (scriptExecutionState === 'paused' && isRunningRef.current) {
            queueMicrotask(() => (window as any).__runSwarmCycle(true));
        }
    }, [scriptExecutionState]);
    
    const stepBackward = useCallback(() => {
         if (scriptExecutionState === 'paused' && currentScriptStepIndex > 0) {
            setCurrentScriptStepIndex(prev => prev - 1);
            logEvent(`[SCRIPT] Stepped back to step ${currentScriptStepIndex}.`);
        }
    }, [scriptExecutionState, currentScriptStepIndex, logEvent]);
    
    const runFromStep = useCallback((index: number) => {
        setCurrentScriptStepIndex(index);
        setStepStatuses(prev => prev.map((s, i) => i >= index ? { status: 'pending' } : s));
        setScriptExecutionState('running');
        logEvent(`[SCRIPT] Running from step ${index + 1}...`);
    }, [logEvent]);

    // New Supervisor function to handle errors
    const handleExecutionFailure = useCallback(async (
        errorContext: {
            failedAction: AIToolCall | string; // Tool call object or the raw prompt text
            errorMessage: string;
            failedTool?: LLMTool;
        }
    ) => {
        logEvent(`[SUPERVISOR] Anomaly detected. Initiating diagnostic protocol for error: ${errorContext.errorMessage}`);
        
        const diagnosticTool = allTools.find(t => t.name === 'Diagnose Tool Execution Error');
        if (!diagnosticTool || !executeActionRef.current) {
            logEvent('[SUPERVISOR] FATAL: Diagnostic tool not found. Cannot perform root cause analysis.');
            return;
        }

        try {
            const simplifiedHistory = swarmHistoryRef.current.map(h => 
                `Tool: ${h.toolCall?.name || 'N/A'}, Args: ${JSON.stringify(h.toolCall?.arguments)}, Result: ` + (h.executionError ? `ERROR: ${h.executionError}` : 'OK')
            ).join('\n');

            const availableToolsSummary = allTools.map(t => ({ name: t.name, description: t.description }));
            
            const diagnosticArgs = {
                researchObjective: typeof currentUserTask.userRequest === 'string' ? currentUserTask.userRequest : currentUserTask.userRequest?.text || 'N/A',
                executionHistory: simplifiedHistory,
                failedAction: typeof errorContext.failedAction === 'string' 
                    ? `AI Generation Step with prompt: "${errorContext.failedAction}"` 
                    : `Tool Call: "${errorContext.failedAction.name}" with args: ${JSON.stringify(errorContext.failedAction.arguments)}`,
                errorMessage: errorContext.errorMessage,
                availableTools: JSON.stringify(availableToolsSummary),
                failedToolSourceCode: errorContext.failedTool?.implementationCode || 'N/A',
                modelUsed: selectedModel.id,
            };

            // The supervisor directly invokes the diagnostic tool
            await executeActionRef.current({ name: 'Diagnose Tool Execution Error', arguments: diagnosticArgs }, 'supervisor');
            
        } catch (diagnosticError) {
            logEvent(`[SUPERVISOR] FATAL: The diagnostic agent itself failed. Error: ${diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError)}`);
        }
    }, [allTools, currentUserTask, executeActionRef, logEvent, selectedModel]);

    const runSwarmCycle = useCallback(async (isManualStep = false) => {
        if ((isCycleInProgress.current && !isManualStep) || !isRunningRef.current) return;
        isCycleInProgress.current = true;

        try {
            if (currentUserTask?.isScripted) {
                 if (scriptExecutionState !== 'running' && !isManualStep) return;

                const script = currentUserTask.script || [];
                if (currentScriptStepIndex >= script.length) {
                    logEvent('[INFO] ✅ Script finished.');
                    setScriptExecutionState('finished');
                    handleStopSwarm('Script completed successfully.');
                    return;
                }

                const agent = agentSwarmRef.current[0];
                const toolCallFromScript = script[currentScriptStepIndex];
                
                const toolCall = {
                    ...toolCallFromScript,
                    arguments: {
                        ...toolCallFromScript.arguments,
                        projectName: currentUserTask.projectName,
                    },
                };
                
                logEvent(`[SCRIPT] Step ${currentScriptStepIndex + 1}/${script.length}: Executing '${toolCall.name}'`);
                
                const result = await executeActionRef.current!(toolCall, agent.id, currentUserTask.context);
                swarmHistoryRef.current.push(result);
                setLiveSwarmHistory([...swarmHistoryRef.current]);


                if (result.executionError) {
                    setStepStatuses(prev => {
                        const newStatuses = [...prev];
                        newStatuses[currentScriptStepIndex] = { status: 'error', error: result.executionError };
                        return newStatuses;
                    });
                    logEvent(`[ERROR] 🛑 Halting script due to error in '${toolCall.name}'.`);
                    setScriptExecutionState('error');
                    await handleExecutionFailure({
                        failedAction: toolCall,
                        errorMessage: result.executionError,
                        failedTool: result.tool,
                    });
                    handleStopSwarm("Error during script execution.");
                    return;
                }

                setStepStatuses(prev => {
                    const newStatuses = [...prev];
                    newStatuses[currentScriptStepIndex] = { status: 'completed', result: result.executionResult };
                    return newStatuses;
                });
                
                setCurrentScriptStepIndex(prev => prev + 1);
                
                if (result.toolCall?.name === 'Task Complete') {
                    logEvent(`[SUCCESS] ✅ Script reached 'Task Complete'.`);
                    setScriptExecutionState('finished');
                    handleStopSwarm("Script completed successfully.");
                    return;
                }
            } else { // LLM-driven path...
                if (swarmIterationCounter.current >= 50) { handleStopSwarm("Max iterations reached"); return; }
                const agent = agentSwarmRef.current[0]; if (!agent) return;
                swarmIterationCounter.current++;
                setAgentSwarm(prev => prev.map(a => a.id === agent.id ? { ...a, status: 'working', lastAction: 'Thinking...', error: null } : a));
                
                let finalUserRequestText = currentUserTask.userRequest.text;
                if (currentUserTask.useSearch && swarmHistoryRef.current.length === 0) {
                     logEvent('🔎 Performing web search for additional context...');
                    try {
                        setApiCallCount(prev => ({ ...prev, [selectedModel.id]: (prev[selectedModel.id] || 0) + 1 }));
                        const searchResult = await contextualizeWithSearch({ text: `Find technical data for this request: "${currentUserTask.userRequest.text}"`, files: currentUserTask.userRequest.files }, apiConfig, selectedModel);
                        if (searchResult.summary) {
                            const sourceList = searchResult.sources.map(s => `- ${s.title}: ${s.uri}`).join('\n');
                            finalUserRequestText = `User request: "${currentUserTask.userRequest.text}"\n\nWeb Search Results:\n${searchResult.summary}\nSources:\n${sourceList}`;
                            logEvent(`✨ Search complete. Context appended. Sources:\n${sourceList}`);
                        }
                    } catch (e) { logEvent(`[WARN] ⚠️ Web search failed: ${e instanceof Error ? e.message : String(e)}.`); }
                }

                let contextualDataString = "";
                if (currentUserTask.contextualData) {
                    const { sources, synergies } = currentUserTask.contextualData;
                    if (sources && sources.length > 0) {
                        contextualDataString += `BACKGROUND: The following information has been previously gathered from validated scientific sources. You MUST use this as the basis for your analysis.\n${JSON.stringify(sources.map(s => ({ title: s.title, summary: s.summary, reliability: s.reliabilityScore })), null, 2)}\n\n`;
                    }
                    if (synergies && synergies.length > 0) {
                        contextualDataString += `BACKGROUND: The following synergies have already been identified based on the sources above. You MUST use this as the basis for your analysis.\n${JSON.stringify(synergies, null, 2)}\n\n`;
                    }
                }

                const historyString = swarmHistoryRef.current.length > 0
                    ? `Actions performed so far:\n${swarmHistoryRef.current.map(r =>
                        `Action: ${r.toolCall?.name || 'Unknown'} - Result: ${r.executionError
                            ? `FAILED (${r.executionError})`
                            : `SUCCEEDED. Output: ${resultToString(r.executionResult)}`}`
                    ).join('\n')}`
                    : "No actions have been performed yet.";

                const promptForAgent = `${contextualDataString}CURRENT GOAL: "${finalUserRequestText}"\n\n${historyString}\n\nBased on the provided BACKGROUND information, your CURRENT GOAL, and the actions performed so far, what is the next single action to perform to advance the research protocol? If the goal is complete, you must call "Task Complete".`;
                
                let toolsForAgent: LLMTool[] = [];
                if (relevanceMode === 'All') {
                    toolsForAgent = allTools;
                } else {
                    const relevantScoredTools = await findRelevantTools(finalUserRequestText, allTools, relevanceTopK, relevanceThreshold, currentSystemPrompt, mainView);
                    setActiveToolsForTask(relevantScoredTools);
                    toolsForAgent = relevantScoredTools.map(st => st.tool);
                }
                
                const promptPayload = { text: promptForAgent, files: currentUserTask.userRequest.files || [] };
                if (!executeActionRef.current) throw new Error("Execution context is not available.");
                const toolCallsResponse = await processRequest(promptPayload, currentSystemPrompt, agent.id, toolsForAgent);
                const toolCalls = toolCallsResponse.toolCalls;

                if (!isRunningRef.current) return;
                
                if (toolCalls && toolCalls.length > 0) {
                    let hasError = false;

                    const executionPromises = toolCalls.map(async (toolCall) => {
                        const result = await executeActionRef.current!(toolCall, agent.id, currentUserTask.context);
                        if (result.executionError) {
                            hasError = true;
                            await handleExecutionFailure({
                                failedAction: toolCall,
                                errorMessage: result.executionError,
                                failedTool: result.tool,
                            });
                        }
                        return result;
                    });

                    const results = await Promise.all(executionPromises);
                    swarmHistoryRef.current.push(...results);
                    setLiveSwarmHistory([...swarmHistoryRef.current]);


                    if (!isRunningRef.current) return;
                    
                    const taskComplete = results.find(r => r.toolCall?.name === 'Task Complete' && !r.executionError);
                    if (taskComplete) { handleStopSwarm("Task completed successfully"); return; }
                    
                    if (hasError) {
                        logEvent('[SUPERVISOR] One or more tool calls failed. Halting task after diagnosis.');
                        handleStopSwarm("Unrecoverable error during tool execution.");
                        return;
                    }

                } else {
                    const errorMessage = "The agent did not return a tool call. This may mean it is stuck or believes the task is complete without calling the 'Task Complete' tool.";
                    let detailedErrorMessage = errorMessage;
                    if (toolCallsResponse.text && toolCallsResponse.text.trim()) {
                        detailedErrorMessage += ` The agent's response was: "${toolCallsResponse.text.trim()}"`;
                    }
                    logEvent(`[SUPERVISOR] ${detailedErrorMessage}`);
                    await handleExecutionFailure({ failedAction: promptForAgent, errorMessage: detailedErrorMessage });
                    handleStopSwarm("Agent did not provide a next action.");
                    return;
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Unknown error.";
            logEvent(`[ERROR] 🛑 Agent task failed: ${errorMessage}`);
            setScriptExecutionState('error');
            await handleExecutionFailure({
                failedAction: "Main swarm cycle execution",
                errorMessage: errorMessage
            });
            handleStopSwarm("Critical agent error");
        } finally {
            if (isRunningRef.current) {
                if (currentUserTask?.isScripted && isManualStep) {
                    setScriptExecutionState('paused'); // Pause after a manual step
                } else {
                    requestAnimationFrame(() => (window as any).__runSwarmCycle());
                }
            }
            isCycleInProgress.current = false;
        }
    }, [
        currentUserTask, logEvent, scriptExecutionState, currentScriptStepIndex, handleStopSwarm, handleExecutionFailure,
        findRelevantTools, relevanceMode, relevanceTopK, relevanceThreshold, 
        mainView, currentSystemPrompt, isSequential, setApiCallCount, 
        setActiveToolsForTask, processRequest, executeActionRef, allTools,
        selectedModel, apiConfig, pauseState
    ]);
    
    useEffect(() => { (window as any).__runSwarmCycle = runSwarmCycle; }, [runSwarmCycle]);

    const startSwarmTask = useCallback(async (options: StartSwarmTaskOptions) => {
        const { task, systemPrompt, sequential = false, resume = false, historyEventToInject = null } = options;
        
        if (!resume) {
            setLastSwarmRunHistory(null);
            swarmHistoryRef.current = [];
            setLiveSwarmHistory([]);
            swarmIterationCounter.current = 0;
            setCurrentScriptStepIndex(0);
            setStepStatuses(task.script ? Array(task.script.length).fill({ status: 'pending' }) : []);
            setEventLog(() => [`[${new Date().toLocaleTimeString()}] [INFO] 🚀 Starting task...`]);
            setActiveToolsForTask([]);
        } else {
            logEvent(`[INFO] ▶️ Resuming task...`);
            if (historyEventToInject) {
                swarmHistoryRef.current.push(historyEventToInject);
                setLiveSwarmHistory([...swarmHistoryRef.current]);
            }
        }

        let finalTask = typeof task === 'string' ? { userRequest: { text: task, files: [] } } : task;
        // Attach the current view as context for the task
        finalTask.context = mainView;
        
        if (finalTask.isScripted) { setScriptExecutionState('running'); } else { setScriptExecutionState('idle'); }

        setCurrentUserTask(finalTask);
        setCurrentSystemPrompt(systemPrompt || SWARM_AGENT_SYSTEM_PROMPT);
        setIsSequential(sequential);
        setAgentSwarm([{ id: 'agent-1', status: 'idle', lastAction: 'Awaiting instructions', error: null, result: null }]);
        if(!resume) setUserInput('');
        setIsSwarmRunning(true);
    }, [setUserInput, setEventLog, logEvent, mainView]);

    const state = {
        agentSwarm, isSwarmRunning, currentUserTask, currentSystemPrompt, pauseState,
        lastSwarmRunHistory, liveSwarmHistory, activeToolsForTask, relevanceTopK, relevanceThreshold,
        relevanceMode, scriptExecutionState, currentScriptStepIndex, stepStatuses,
    };

    const handlers = {
        startSwarmTask, handleStopSwarm, clearPauseState, clearLastSwarmRunHistory,
        runSwarmCycle, setRelevanceTopK, setRelevanceThreshold, setRelevanceMode,
        appendToSwarmHistory, toggleScriptPause,
        stepForward, stepBackward, runFromStep,
    };

    return {
        ...state,
        ...handlers,
    };
};