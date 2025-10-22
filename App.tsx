import React, { useEffect, useState } from 'react';
import { useAppRuntime } from './hooks/useAppRuntime';
import UIToolRunner from './components/UIToolRunner';
import type { LLMTool } from './types';
import { AI_MODELS } from './constants';

const App: React.FC = () => {
    const appRuntime = useAppRuntime();
    const { getTool, eventLog, apiCallCount, agentSwarm, isServerConnected, runtimeApi } = appRuntime;
    const [proxyBootstrapped, setProxyBootstrapped] = useState(false);

    const mainUiTool = getTool('Synergy Forge Main UI') as LLMTool | undefined;
    const debugLogTool = getTool('Debug Log View') as LLMTool | undefined;

    useEffect(() => {
        const bootstrapAndTestProxy = async () => {
            if (isServerConnected && !proxyBootstrapped) {
                setProxyBootstrapped(true);
                try {
                    await runtimeApi.tools.run('Test Web Proxy Service', {});
                } catch (error) {
                    console.error("Failed to auto-bootstrap and test web proxy on startup:", error);
                    runtimeApi.logEvent(`[SYSTEM] WARN: Automatic startup/test of web proxy service failed. Error: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        };

        bootstrapAndTestProxy();
    }, [isServerConnected, proxyBootstrapped, runtimeApi]);

    const handleReset = () => {
        if (window.confirm("Are you sure you want to factory reset? This will clear all created tools and data.")) {
            localStorage.clear();
            window.location.reload();
        }
    };
    
    return (
        <main className="h-screen w-screen bg-gray-800 font-sans text-gray-200">
            {mainUiTool ? (
                <UIToolRunner 
                    tool={mainUiTool} 
                    props={{ 
                        runtime: appRuntime.runtimeApi, 
                        isSwarmRunning: appRuntime.isSwarmRunning,
                        startSwarmTask: appRuntime.startSwarmTask,
                        lastSwarmRunHistory: appRuntime.lastSwarmRunHistory,
                        liveSwarmHistory: appRuntime.liveSwarmHistory,
                        liveFeed: appRuntime.liveFeed,
                        setLiveFeed: appRuntime.setLiveFeed,
                        eventLog: appRuntime.eventLog,
                        availableModels: AI_MODELS,
                        selectedModel: appRuntime.selectedModel,
                        setSelectedModel: appRuntime.setSelectedModel,
                        apiConfig: appRuntime.apiConfig,
                        setApiConfig: appRuntime.setApiConfig,
                        allSources: appRuntime.allSources,
                        setAllSources: appRuntime.setAllSources,
                        mapData: appRuntime.mapData,
                        setMapData: appRuntime.setMapData,
                        pcaModel: appRuntime.pcaModel,
                        setPcaModel: appRuntime.setPcaModel,
                        mapNormalization: appRuntime.mapNormalization,
                        setMapNormalization: appRuntime.setMapNormalization,
                        taskPrompt: appRuntime.taskPrompt,
                        setTaskPrompt: appRuntime.setTaskPrompt,
                        ollamaModels: appRuntime.ollamaModels,
                        ollamaState: appRuntime.ollamaState,
                        fetchOllamaModels: appRuntime.fetchOllamaModels,
                    }} 
                />
            ) : (
                <div className="flex items-center justify-center h-full">
                    <p>Loading Main UI...</p>
                </div>
            )}
            
            {debugLogTool && (
                 <UIToolRunner 
                    tool={debugLogTool}
                    props={{
                        logs: eventLog,
                        onReset: handleReset,
                        apiCallCounts: apiCallCount,
                        apiCallLimit: 999,
                        agentCount: agentSwarm.length,
                    }}
                />
            )}
            
            {appRuntime.isBudgetGuardTripped && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[999] animate-fade-in">
                    <div className="bg-slate-800 border-2 border-red-500 rounded-lg shadow-2xl w-full max-w-lg p-6 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h2 className="text-2xl font-bold text-red-300">Budgetary Guardian Tripped</h2>
                        <p className="text-slate-300 mt-2">
                            A dangerously high rate of API calls was detected, likely due to a runaway loop. The current task has been automatically terminated to protect your budget.
                        </p>
                        <button 
                            onClick={() => appRuntime.setIsBudgetGuardTripped(false)} 
                            className="mt-6 px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg"
                        >
                            Acknowledge & Reset
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
};

export default App;