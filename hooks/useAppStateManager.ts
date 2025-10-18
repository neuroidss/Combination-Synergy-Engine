import { useState, useEffect, useCallback } from 'react';
import { loadStateFromStorage, saveStateToStorage, saveMapStateToStorage, loadMapStateToStorage } from '../versioning';
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
    // Live feed state
    const [liveFeed, setLiveFeed] = useState<any[]>([]);
    // Persistent map state
    const [allSources, setAllSources] = useState<any[]>([]);
    const [mapData, setMapData] = useState<any[]>([]);
    const [pcaModel, setPcaModel] = useState<any | null>(null);
    const [mapNormalization, setMapNormalization] = useState<any | null>(null);
    const [taskPrompt, setTaskPrompt] = useState('Discover a broad range of longevity interventions (e.g., drugs, supplements, lifestyle changes) and analyze them to find both known and novel synergistic combinations.');


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
        
        const log = (msg: string) => setEventLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

        // Load map state
        let mapState = loadMapStateToStorage(log);
        if (mapState) {
            const hasDuplicates = (arr: any[], idSelector: (item: any) => any) => {
                if (!Array.isArray(arr)) return false;
                const ids = new Set();
                for (const item of arr) {
                    if (!item) continue;
                    const id = idSelector(item);
                    if (!id) continue; // Ignore items without an ID
                    if (ids.has(id)) {
                        return true; // Found a duplicate
                    }
                    ids.add(id);
                }
                return false;
            };

            const liveFeed = mapState.liveFeed || [];
            const allSources = mapState.allSources || [];
            
            // Check for duplicates in the two main arrays that are rendered with keys
            if (hasDuplicates(liveFeed, item => item.id) || hasDuplicates(allSources, item => item.id)) {
                log("[SYSTEM] ERROR: Corrupted cache detected (duplicate items). Clearing cache to prevent application freeze.");
                localStorage.removeItem('synergy-forge-map-state');
                mapState = null; // Nullify state to force a fresh start
            }
        }

        if (mapState) {
            setAllSources(mapState.allSources);
            setMapData(mapState.mapData);
            setPcaModel(mapState.pcaModel);
            setMapNormalization(mapState.mapNormalization);
            setLiveFeed(mapState.liveFeed || []);
            if (mapState.taskPrompt) {
                setTaskPrompt(mapState.taskPrompt);
            }
        } else {
             // Ensure state is clean if mapState is nullified
            setAllSources([]);
            setMapData([]);
            setPcaModel(null);
            setMapNormalization(null);
            setLiveFeed([]);
        }
        
        // Initialize with a welcome message
        setEventLog(prev => [`[${new Date().toLocaleTimeString()}] [SYSTEM] Session started.`, ...prev]);
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

    // Effect to persist map state and live feed whenever it changes
    useEffect(() => {
        // This effect will run whenever any of the map-related states change,
        // ensuring the map is always saved.
        saveMapStateToStorage({
            allSources,
            mapData,
            pcaModel,
            mapNormalization,
            liveFeed,
            taskPrompt,
        }, logEvent);
    }, [allSources, mapData, pcaModel, mapNormalization, liveFeed, taskPrompt]);


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
        // Feed state and setters
        liveFeed,
        setLiveFeed,
        // Map state and setters
        allSources,
        setAllSources,
        mapData,
        setMapData,
        pcaModel,
        setPcaModel,
        mapNormalization,
        setMapNormalization,
        taskPrompt,
        setTaskPrompt,
    };
};