import { useState, useEffect, useCallback } from 'react';
import { loadStateFromStorage, saveStateToStorage, AppState } from '../versioning';
import type { AIModel, APIConfig } from '../types';
import { AI_MODELS } from '../constants';

export const useAppStateManager = () => {
    const [eventLog, setEventLog] = useState<string[]>([]);
    const [apiCallCount, setApiCallCount] = useState<Record<string, number>>({});
    const [selectedModel, setSelectedModel] = useState<AIModel>(AI_MODELS[0]);
    const [apiConfig, setApiConfig] = useState<APIConfig>({
        googleAIAPIKey: process.env.GEMINI_API_KEY || '',
        openAIAPIKey: '',
        openAIBaseUrl: '',
        ollamaHost: '',
    });

    // Load state from storage on initial mount
    useEffect(() => {
        const storedState = loadStateFromStorage();
        if (storedState) {
            // Note: We don't load tools here, that's handled by useToolManager
            // We could load other settings like selectedModel or apiConfig if they were saved.
            console.log("Loaded state from storage.", storedState);
        }
        // Initialize with a welcome message
        setEventLog([`[${new Date().toLocaleTimeString()}] [SYSTEM] Session started.`]);
    }, []);

    const logEvent = useCallback((message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setEventLog(prev => [...prev, `[${timestamp}] ${message}`]);
    }, []);

    // Effect to persist state whenever it changes
    // NOTE: In this simplified setup, we're only persisting tools via useToolManager's effect.
    // To persist state from this hook, you would add an effect like this:
    /*
    useEffect(() => {
        // Example: save parts of the state. Be careful what you save.
        const stateToSave = {
            // It's often not desirable to save the event log.
            // apiConfig might contain secrets, so be careful.
        };
        // saveStateToStorage(stateToSave); 
    }, [apiConfig, selectedModel]);
    */

    return {
        eventLog,
        setEventLog,
        logEvent,
        apiCallCount,
        setApiCallCount,
        selectedModel,
        setSelectedModel,
        apiConfig,
        setApiConfig,
    };
};
