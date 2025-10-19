import { LLMTool, APIConfig } from './types';
import { PCA } from 'https://esm.sh/ml-pca';

const STORAGE_KEY = 'singularity-agent-factory-state';
const MAP_STORAGE_KEY = 'synergy-forge-map-state';
const CURRENT_STORAGE_VERSION = 6;
const CURRENT_MAP_VERSION = 2; // Version for the map data structure

export interface AppState {
    version: number;
    tools: LLMTool[];
    apiConfig?: APIConfig;
}

interface MapState {
    version: number;
    allSources: any[];
    mapData: any[];
    pcaModel: any | null;
    mapNormalization: any | null;
    liveFeed?: any[];
    taskPrompt?: string;
}

export const loadStateFromStorage = (): AppState | null => {
    const stateJson = localStorage.getItem(STORAGE_KEY);
    if (stateJson) {
        try {
            const state = JSON.parse(stateJson);
            // If the loaded state has a version and it matches the current version, and it has a tools array, it's considered valid.
            if (state.version === CURRENT_STORAGE_VERSION && Array.isArray(state.tools)) {
                return state;
            }
            // If the version doesn't match, we will fall through and return null, effectively discarding the old state.
        } catch (e) {
            console.error("Failed to parse stored state, clearing it.", e);
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
    }
    // No valid state found, or an older version was found.
    return null;
};

export const saveStateToStorage = (partialState: Partial<Omit<AppState, 'version'>>) => {
    try {
        const currentState = loadStateFromStorage() || { version: CURRENT_STORAGE_VERSION, tools: [] };
        const stateToSave: AppState = {
            ...currentState,
            ...partialState,
            version: CURRENT_STORAGE_VERSION,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
        console.error("Failed to save state to localStorage. Data might be too large.", e);
    }
};

export const loadMapStateToStorage = (logEvent: (msg: string) => void): Omit<MapState, 'version'> | null => {
    const mapStateJson = localStorage.getItem(MAP_STORAGE_KEY);
    if (!mapStateJson) {
        logEvent("[SYSTEM] No persistent map state found. A new map will be created.");
        return null;
    }
    try {
        const state: MapState = JSON.parse(mapStateJson);
        if (state.version !== CURRENT_MAP_VERSION) {
            logEvent(`[SYSTEM] WARN: Found incompatible map data (version ${state.version || 'unknown'}, expected ${CURRENT_MAP_VERSION}). Discarding old map.`);
            localStorage.removeItem(MAP_STORAGE_KEY);
            return null;
        }
        
        // The PCA model needs to be re-hydrated from its JSON representation.
        const pcaModel = state.pcaModel ? PCA.load(state.pcaModel) : null;
        const liveFeed = state.liveFeed || [];
        const taskPrompt = state.taskPrompt;
        
        logEvent(`[SYSTEM] ✅ Loaded persistent map with ${state.allSources.length} sources and ${liveFeed.length} feed items.`);
        return { ...state, pcaModel, liveFeed, taskPrompt };

    } catch (e) {
        logEvent(`[SYSTEM] ERROR: Failed to parse stored map state, clearing it. Error: ${e instanceof Error ? e.message : String(e)}`);
        localStorage.removeItem(MAP_STORAGE_KEY);
        return null;
    }
};

export function saveMapStateToStorage(partialState: Partial<Omit<MapState, 'version'>>, logEvent: (msg: string) => void) {
    if (!partialState.allSources || partialState.allSources.length === 0) {
        // Don't save an empty map state.
        return;
    }
    try {
        // Handle PCA model serialization. The PCA instance itself is not serializable.
        const serializablePcaModel = partialState.pcaModel instanceof PCA
            ? partialState.pcaModel.toJSON()
            : partialState.pcaModel;

        const stateToSave: MapState = {
            version: CURRENT_MAP_VERSION,
            allSources: partialState.allSources || [],
            mapData: partialState.mapData || [],
            pcaModel: serializablePcaModel,
            mapNormalization: partialState.mapNormalization || null,
            liveFeed: partialState.liveFeed || [],
            taskPrompt: partialState.taskPrompt || '',
        };
        localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
        logEvent(`[SYSTEM] ERROR: Failed to save map state to localStorage. Data may be too large. Error: ${e instanceof Error ? e.message : String(e)}`);
        console.error("Failed to save map state to localStorage:", e);
    }
}
