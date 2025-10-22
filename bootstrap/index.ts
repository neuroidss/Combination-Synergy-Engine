import type { ToolCreatorPayload } from '../types';

import { SERVER_MANAGEMENT_TOOLS } from '../framework/mcp';
import { AUTOMATION_TOOLS } from '../framework/automation';
import { WORKFLOW_TOOLS } from './workflow_tools';
import { RESEARCH_TOOLS } from './research_tools';
import { ANALYSIS_TOOLS } from './analysis_tools';
import { COMMERCIAL_TOOLS } from './commercial_tools';
import { RISK_TOOLS } from './risk_tools';
import { DATA_RECORDER_TOOLS } from './data_recorder_tools';
import { DIAGNOSTIC_TOOLS } from './diagnostic_tools';
import { ORGANOID_SIMULATION_CODE } from './organoid_simulation';
import { SYNERGY_FORGE_UI_CODE } from './ui_components';
import { DISCOVERY_TOOLS } from './discovery_tools';
import { PERSONALIZATION_TOOLS } from './personalization_tools';

const SYNERGY_FORGE_TOOLS: ToolCreatorPayload[] = [{
    name: 'Synergy Forge Main UI',
    description: 'The main user interface for the SynergyForge application, refactored to show a live discovery feed and the top resulting investment proposals.',
    category: 'UI Component',
    executionEnvironment: 'Client',
    purpose: "To provide a dynamic 'Board Room' dashboard that shows both the real-time research process and the final, high-quality, cost-analyzed investment opportunities.",
    parameters: [
        { name: 'runtime', type: 'object', description: 'The application runtime API.', required: true },
        { name: 'isSwarmRunning', type: 'boolean', description: 'Indicates if the agent swarm is active.', required: true },
        { name: 'startSwarmTask', type: 'object', description: 'Function to initiate a swarm task.', required: true },
        { name: 'liveSwarmHistory', type: 'array', description: 'The real-time execution history.', required: true },
        { name: 'liveFeed', type: 'array', description: 'The unified feed of all results.', required: true },
        { name: 'setLiveFeed', type: 'object', description: 'Function to update the liveFeed.', required: true },
        { name: 'eventLog', type: 'array', description: 'The global event log.', required: true },
        { name: 'availableModels', type: 'array', description: 'Array of available static AI models.', required: true },
        { name: 'selectedModel', type: 'object', description: 'The currently selected AI model.', required: true },
        { name: 'setSelectedModel', type: 'object', description: 'Function to update the selected model.', required: true },
        { name: 'apiConfig', type: 'object', description: 'The API configuration.', required: true },
        { name: 'setApiConfig', type: 'object', description: 'Function to update the API configuration.', required: true },
        { name: 'taskPrompt', type: 'string', description: 'The research objective prompt.', required: true },
        { name: 'setTaskPrompt', type: 'object', description: 'Function to update the prompt.', required: true },
        // New props for dynamic model fetching
        { name: 'ollamaModels', type: 'array', description: 'Array of dynamically fetched Ollama models.', required: true },
        { name: 'ollamaState', type: 'object', description: 'State of the Ollama model fetching process.', required: true },
        { name: 'fetchOllamaModels', type: 'object', description: 'Function to fetch models from Ollama.', required: true },
        // Chronicler props
        { name: 'isChroniclerActive', type: 'boolean', description: 'Whether the narrative agent is active.', required: true },
        { name: 'setIsChroniclerActive', type: 'object', description: 'Function to toggle the Chronicler.', required: true },
        { name: 'availableTtsLangs', type: 'array', description: 'List of available TTS languages.', required: true },
        { name: 'selectedTtsLang', type: 'string', description: 'The currently selected language code.', required: true },
        { name: 'setSelectedTtsLang', type: 'object', description: 'Function to set the TTS language.', required: true },
        { name: 'ttsVoices', type: 'array', description: 'List of available TTS voices for the selected language.', required: true },
        { name: 'selectedTtsVoice', type: 'string', description: 'The currently selected voice.', required: true },
        { name: 'setSelectedTtsVoice', type: 'object', description: 'Function to set the TTS voice.', required: true },
        // New Chronicler frequency props
        { name: 'chroniclerFrequency', type: 'number', description: 'The update frequency for the Chronicler agent in ms.', required: true },
        { name: 'setChroniclerFrequency', type: 'object', description: 'Function to set the Chronicler frequency.', required: true },
        // New Chronicler state props
        { name: 'narrativeLog', type: 'array', description: 'The array of narrative log entries.', required: true },
        { name: 'setNarrativeLog', type: 'object', description: 'Function to update the narrative log.', required: true },
    ],
    implementationCode: SYNERGY_FORGE_UI_CODE,
}];

export const BOOTSTRAP_TOOL_PAYLOADS: ToolCreatorPayload[] = [
    ...AUTOMATION_TOOLS,
    ...SERVER_MANAGEMENT_TOOLS,
    ...SYNERGY_FORGE_TOOLS,
    ...WORKFLOW_TOOLS,
    ...RESEARCH_TOOLS,
    ...ANALYSIS_TOOLS,
    ...COMMERCIAL_TOOLS,
    ...RISK_TOOLS,
    ...DATA_RECORDER_TOOLS,
    ...DIAGNOSTIC_TOOLS,
    ...DISCOVERY_TOOLS,
    ...PERSONALIZATION_TOOLS,
];