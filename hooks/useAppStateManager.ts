import { useState, useEffect, useCallback } from 'react';
import { loadStateFromStorage, saveStateToStorage } from '../versioning';
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
        if (storedState?.apiConfig) {
            // Merge stored config with env vars, giving env vars precedence.
            setApiConfig(prevConfig => ({
                ...prevConfig,
                openAIAPIKey: storedState.apiConfig?.openAIAPIKey || '',
                openAIBaseUrl: storedState.apiConfig?.openAIBaseUrl || '',
                ollamaHost: storedState.apiConfig?.ollamaHost || '',
            }));
            console.log("Loaded non-Google API config from storage.", storedState.apiConfig);
        }
        // Initialize with a welcome message
        setEventLog([`[${new Date().toLocaleTimeString()}] [SYSTEM] Session started.`]);
    }, []);

    const logEvent = useCallback((message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setEventLog(prev => [...prev, `[${timestamp}] ${message}`]);
    }, []);

    // Effect to persist apiConfig state whenever it changes
    useEffect(() => {
        // Create a version of the config that only includes user-set values,
        // not ones from process.env, to avoid writing them to localStorage.
        const configToSave: APIConfig = {
            googleAIAPIKey: undefined, // Never save Google AI key
            openAIAPIKey: apiConfig.openAIAPIKey,
            openAIBaseUrl: apiConfig.openAIBaseUrl,
            ollamaHost: apiConfig.ollamaHost,
        };
        saveStateToStorage({ apiConfig: configToSave });
    }, [apiConfig]);


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