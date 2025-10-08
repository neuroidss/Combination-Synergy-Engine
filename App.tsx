import React from 'react';
import { useAppRuntime } from './hooks/useAppRuntime';
import UIToolRunner from './components/UIToolRunner';
import type { LLMTool } from './types';

const App: React.FC = () => {
    const appRuntime = useAppRuntime();
    const { getTool, logEvent, eventLog, setEventLog, apiCallCount, agentSwarm } = appRuntime;

    const mainUiTool = getTool('Synergy Forge Main UI') as LLMTool | undefined;
    const debugLogTool = getTool('Debug Log View') as LLMTool | undefined;

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
                        eventLog: appRuntime.eventLog,
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