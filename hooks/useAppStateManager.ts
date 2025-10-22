import { useState, useEffect, useCallback } from 'react';
import { loadStateFromStorage, saveStateToStorage, saveMapStateToStorage, loadMapStateToStorage } from '../versioning';
import type { AIModel, APIConfig } from '../types';
// FIX: ModelProvider is now imported from its source in `types.ts` instead of from `constants.ts`.
import { ModelProvider } from '../types';
import { AI_MODELS } from '../constants';

// FIX: Changed from const arrow function to a function declaration
// to potentially resolve type inference issues in consuming hooks.
export function useAppStateManager() {
    const [eventLog, setEventLog] = useState<string[]>([]);
    const [apiCallCount, setApiCallCount] = useState<Record<string, number>>({});
    const [selectedModel, setSelectedModel] = useState<AIModel>(AI_MODELS[0]);
    const [apiConfig, setApiConfig] = useState<APIConfig>({
        googleAIAPIKey: '',
        openAIAPIKey: '',
        openAIBaseUrl: 'http://localhost:11434/v1',
        ollamaHost: 'http://localhost:11434',
    });
    // Live feed state
    const [liveFeed, setLiveFeed] = useState<any[]>([]);
    // Persistent map state
    const [allSources, setAllSources] = useState<any[]>([]);
    const [mapData, setMapData] = useState<any[]>([]);
    const [pcaModel, setPcaModel] = useState<any | null>(null);
    const [mapNormalization, setMapNormalization] = useState<any | null>(null);
    const [taskPrompt, setTaskPrompt] = useState('Discover a broad range of longevity interventions (e.g., drugs, supplements, lifestyle changes) and analyze them to find both known and novel synergistic combinations.');

    // State for dynamic Ollama model fetching
    const [ollamaModels, setOllamaModels] = useState<AIModel[]>([]);
    const [ollamaState, setOllamaState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });

    // --- NEW: Budgetary Guardian State ---
    const [apiCallTimestamps, setApiCallTimestamps] = useState<number[]>([]);
    const [isBudgetGuardTripped, setIsBudgetGuardTripped] = useState(false);


    const fetchOllamaModels = useCallback(async () => {
        setOllamaState({ loading: true, error: null });
        try {
            // Environment-aware URL selection to bypass CORS in remote deployments
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const ollamaApiUrl = isLocal
                ? `${apiConfig.ollamaHost}/api/tags`
                : `http://localhost:3001/api/ollama-proxy/tags`;

            logEvent(`[Ollama] Fetching models via: ${ollamaApiUrl}`);

            const response = await fetch(ollamaApiUrl);
            if (!response.ok) {
                const errorText = await response.text();
                const errorJson = JSON.parse(errorText);
                const errorOrigin = isLocal ? `Ollama server at ${apiConfig.ollamaHost}` : 'the local MCP proxy server (localhost:3001)';
                throw new Error(`Failed to fetch models from ${errorOrigin}. Status ${response.status}: ${errorJson.error || errorText}`);
            }
            const data = await response.json();
            const models: AIModel[] = data.models.map((model: any) => ({
                id: model.name,
                name: model.name,
                provider: ModelProvider.Ollama,
            }));
            setOllamaModels(models);
            if (models.length === 0) {
                 setOllamaState({ loading: false, error: "No models found on Ollama server." });
            } else {
                 setOllamaState({ loading: false, error: null });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to fetch Ollama models.";
            setOllamaState({ loading: false, error: message });
            setOllamaModels([]);
        }
    }, [apiConfig.ollamaHost]);


    // Load state from storage on initial mount
    useEffect(() => {
        const storedState = loadStateFromStorage();
        
        // Load API config, prioritizing user-saved keys, then environment variables
        setApiConfig(prevConfig => ({
            ...prevConfig,
            googleAIAPIKey: storedState?.apiConfig?.googleAIAPIKey || process.env.GEMINI_API_KEY || '',
            openAIAPIKey: storedState?.apiConfig?.openAIAPIKey || '',
            openAIBaseUrl: storedState?.apiConfig?.openAIBaseUrl || 'http://localhost:11434/v1',
            ollamaHost: storedState?.apiConfig?.ollamaHost || 'http://localhost:11434',
        }));

        if (storedState?.apiConfig?.googleAIAPIKey) {
            console.log("Loaded API config from storage.", storedState.apiConfig);
        } else if (process.env.GEMINI_API_KEY) {
            logEvent("[SYSTEM] Loaded Gemini API key from environment variable.");
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
            googleAIAPIKey: apiConfig.googleAIAPIKey,
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
        // Ollama dynamic model state and fetcher
        ollamaModels,
        ollamaState,
        fetchOllamaModels,
        // Budgetary Guardian
        apiCallTimestamps,
        setApiCallTimestamps,
        isBudgetGuardTripped,
        setIsBudgetGuardTripped,
    };
}