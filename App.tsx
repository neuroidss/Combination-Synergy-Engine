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
            // Only run if the server is connected and we haven't tried to bootstrap yet.
            if (isServerConnected && !proxyBootstrapped) {
                setProxyBootstrapped(true); // Set true immediately to prevent re-runs
                try {
                    // This tool now both bootstraps and verifies the proxy, providing clear feedback in the log.
                    await runtimeApi.tools.run('Test Web Proxy Service', {});
                } catch (error) {
                    // Log any unexpected errors during the bootstrap/test process.
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
                        eventLog: appRuntime.eventLog,
                        availableModels: AI_MODELS,
                        selectedModel: appRuntime.selectedModel,
                        setSelectedModel: appRuntime.setSelectedModel,
                        apiConfig: appRuntime.apiConfig,
                        setApiConfig: appRuntime.setApiConfig,
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
        </main>
    );
};

export default App;