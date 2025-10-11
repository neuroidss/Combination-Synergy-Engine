

import type { ToolCreatorPayload } from '../types';

import { SERVER_MANAGEMENT_TOOLS } from '../framework/mcp';
import { AUTOMATION_TOOLS } from '../framework/automation';
import { WORKFLOW_TOOLS } from './workflow_tools';
import { RESEARCH_TOOLS } from './research_tools';
import { ANALYSIS_TOOLS } from './analysis_tools';
import { DATA_RECORDER_TOOLS } from './data_recorder_tools';
import { DIAGNOSTIC_TOOLS } from './diagnostic_tools';
import { ORGANOID_SIMULATION_CODE } from './organoid_simulation';
import { UI_COMPONENTS_CODE } from './ui_components';

const SYNERGY_FORGE_TOOLS: ToolCreatorPayload[] = [{
    name: 'Synergy Forge Main UI',
    description: 'The main user interface for the SynergyForge application, an advanced research environment for longevity science. It features a multi-theory organoid simulator and an AI agent swarm for analyzing scientific literature.',
    category: 'UI Component',
    executionEnvironment: 'Client',
    purpose: "To provide the complete interactive front-end for the SynergyForge application, allowing users to define research objectives, run AI agent swarms, and visualize the results of both the research and the organoid simulations.",
    parameters: [
        { name: 'runtime', type: 'object', description: 'The application runtime API, providing access to AI services, tools, and logging.', required: true },
        { name: 'isSwarmRunning', type: 'boolean', description: 'A boolean indicating if the agent swarm is currently active.', required: true },
        { name: 'startSwarmTask', type: 'object', description: 'A function to initiate a new task for the agent swarm.', required: true },
        { name: 'lastSwarmRunHistory', type: 'array', description: 'An array containing the execution history of the last completed swarm task.', required: true },
        { name: 'liveSwarmHistory', type: 'array', description: 'An array containing the real-time execution history of the current swarm task.', required: true },
        { name: 'eventLog', type: 'array', description: 'The global application event log.', required: true },
        { name: 'availableModels', type: 'array', description: 'An array of available AI models for selection.', required: true },
        { name: 'selectedModel', type: 'object', description: 'The currently selected AI model object.', required: true },
        { name: 'setSelectedModel', type: 'object', description: 'A function to update the selected AI model.', required: true },
        { name: 'apiConfig', type: 'object', description: 'The current API configuration object.', required: true },
        { name: 'setApiConfig', type: 'object', description: 'A function to update the API configuration.', required: true },
    ],
    implementationCode: `
${ORGANOID_SIMULATION_CODE}
${UI_COMPONENTS_CODE}

const [organoids, setOrganoids] = React.useState(getInitialStates());
const [selectedStatTab, setSelectedStatTab] = React.useState('stochastic');

// Intervention-modifiable temporary buffs/debuffs for each organoid
const interventionEffects = React.useRef({
    stochastic: getInitialInterventionEffects(),
    hyperfunction: getInitialInterventionEffects(),
    information: getInitialInterventionEffects(),
    social: getInitialInterventionEffects(),
});

const [researchHistory, setResearchHistory] = React.useState([]);
const [synergies, setSynergies] = React.useState([]);
const [proposals, setProposals] = React.useState([]);
const [dossiers, setDossiers] = React.useState([]);
const [critiques, setCritiques] = React.useState([]);
const [generatingDossiers, setGeneratingDossiers] = React.useState(new Set());
// FIX: Renamed 'prompt' to 'taskPrompt' to avoid conflict with the window.prompt function.
const [taskPrompt, setTaskPrompt] = React.useState('Discover a broad range of longevity interventions (e.g., drugs, supplements, lifestyle changes) and analyze them to find both known and novel synergistic combinations.');
const [currentTab, setCurrentTab] = React.useState('sources');
const [sortConfig, setSortConfig] = React.useState({ key: 'trialPriorityScore', direction: 'desc' });


const [progressInfo, setProgressInfo] = React.useState({ step: 0, total: 0, message: '', eta: 0 });
const taskStartTime = React.useRef(null);
const [isRescoring, setIsRescoring] = React.useState(false);


const resetOrganoids = React.useCallback(() => {
    setOrganoids(getInitialStates());
    runtime.logEvent('[Organoid] Parallel simulation reset.');
}, [runtime]);

React.useEffect(() => {
    // This effect runs whenever new research sources are added, triggering a re-evaluation of all synergies.
    const reScoreAllSynergies = async () => {
        if (isSwarmRunning || isRescoring || synergies.length === 0 || researchHistory.length === 0) {
            return;
        }

        setIsRescoring(true);
        runtime.logEvent('[Re-evaluation] Change detected in research data. Starting background re-scoring of all synergies...');
        
        const currentSynergies = [...synergies]; // Create a snapshot to iterate over

        for (const synergy of currentSynergies) {
            if (isSwarmRunning) { // Check if a new task started during the loop
                runtime.logEvent('[Re-evaluation] Swarm started, aborting background re-scoring.');
                break;
            }
            try {
                const scoringResult = await runtime.tools.run('Score Single Synergy', {
                    synergyToScore: synergy,
                    backgroundSources: researchHistory,
                });
                
                if (scoringResult && scoringResult.updatedSynergy) {
                    setSynergies(prevSynergies => {
                        const getComboKey = (s) => Array.isArray(s.combination) ? s.combination.map(c => c.name).join('+') : 'invalid';
                        const index = prevSynergies.findIndex(s => getComboKey(s) === getComboKey(scoringResult.updatedSynergy) && s.sourceUri === scoringResult.updatedSynergy.sourceUri);
                        if (index !== -1) {
                            const newSynergies = [...prevSynergies];
                            newSynergies[index] = scoringResult.updatedSynergy;
                            return newSynergies;
                        }
                        return prevSynergies;
                    });
                }
            } catch (error) {
                const comboString = Array.isArray(synergy.combination) ? synergy.combination.map(c => c.name).join(' + ') : 'Unknown';
                runtime.logEvent(\`[Re-evaluation] ⚠️ Failed to re-score synergy: \${comboString}. Error: \${error.message}\`);
            }
        }
        
        runtime.logEvent('[Re-evaluation] ✅ Background re-scoring complete.');
        setIsRescoring(false);
    };

    reScoreAllSynergies();
}, [researchHistory.length]); // This effect triggers only when new sources are added.


React.useEffect(() => {
    const timer = setInterval(() => {
        setOrganoids(prevs => {
            const nextStates = {};
            for (const key of THEORY_KEYS) {
                const prev = prevs[key];
                if (prev.overallHealth <= 0) {
                    nextStates[key] = prev; // Keep dead state
                    continue;
                }
                const agingFunction = AGING_FUNCTIONS[key];
                let nextState = agingFunction(prev, interventionEffects.current[key]);
                
                nextStates[key] = nextState;
            }

            return nextStates;
        });
        
        // Reset transient effects after each tick to their baseline values
        interventionEffects.current = {
            stochastic: getInitialInterventionEffects(),
            hyperfunction: getInitialInterventionEffects(),
            information: getInitialInterventionEffects(),
            social: getInitialInterventionEffects(),
        };

    }, 1000);
    return () => clearInterval(timer);
}, []);

React.useEffect(() => {
    // This effect runs whenever liveSwarmHistory updates, populating results in real-time.
    if (liveSwarmHistory) {
        const newSources = liveSwarmHistory
            .filter(h => h.tool?.name === 'RecordValidatedSource' && h.executionResult?.validatedSource)
            .map(h => ({
                url: h.executionResult.validatedSource.uri,
                title: h.executionResult.validatedSource.title,
                summary: h.executionResult.validatedSource.summary,
                reliabilityScore: h.executionResult.validatedSource.reliability,
                justification: h.executionResult.validatedSource.reliabilityJustification,
            }));

        const synergiesData = liveSwarmHistory
            .filter(h => h.tool?.name === 'RecordSynergy' && h.executionResult?.synergy)
            .map(h => h.executionResult.synergy);

        const gameParamsMap = new Map();
        liveSwarmHistory
            .filter(h => h.tool?.name === 'RecordSynergyGameParameters' && h.executionResult?.synergyCombination)
            .forEach(h => {
                const combination = h.executionResult.synergyCombination;
                const key = Array.isArray(combination) ? combination.join(' + ') : String(combination);
                gameParamsMap.set(key, h.executionResult.gameParameters);
            });
        
        const finalSynergies = synergiesData.map(syn => ({ ...syn, gameParameters: gameParamsMap.get(syn.combination.map(c => c.name).join(' + ')) || null }));
        const finalDossiers = liveSwarmHistory.filter(h => h.tool?.name === 'RecordTrialDossier' && h.executionResult?.dossier).map(h => h.executionResult.dossier);
        const finalCritiques = liveSwarmHistory.filter(h => h.tool?.name === 'RecordCritique' && h.executionResult?.critique).map(h => h.executionResult.critique);

        setResearchHistory(newSources);
        setSynergies(finalSynergies);
        setDossiers(finalDossiers);
        setCritiques(finalCritiques);

        // De-duplicate synergies to create proposals, keeping the one with the highest score.
        const proposalMap = new Map();
        finalSynergies.forEach(syn => {
            const key = syn.combination.map(c => c.name).join(' + ');
            const existing = proposalMap.get(key);
            if (!existing || (syn.trialPriorityScore || 0) > (existing.trialPriorityScore || 0)) {
                proposalMap.set(key, syn);
            }
        });
        setProposals(Array.from(proposalMap.values()));
        
        // When a dossier is found, stop tracking its "generating" state
        if (finalDossiers.length > 0) {
            const justGeneratedKeys = finalDossiers.map(d => d.combination.map(c => c.name).join(' + '));
            setGeneratingDossiers(prev => {
                const newSet = new Set(prev);
                justGeneratedKeys.forEach(key => newSet.delete(key));
                return newSet;
            });
        }
    }
}, [liveSwarmHistory]);

const anyOrganoidAlive = React.useMemo(() => Object.values(organoids).some(o => o.overallHealth > 0), [organoids]);

React.useEffect(() => {
    if (isSwarmRunning && eventLog && eventLog.length > 0) {
        const lastLog = eventLog[eventLog.length - 1] || '';
        const progressMatch = lastLog.match(/\\\[Workflow\\] Step (\\d+)\\/(\\d+): (.*)/);

        if (progressMatch) {
            const step = parseInt(progressMatch[1], 10);
            const total = parseInt(progressMatch[2], 10);
            const message = progressMatch[3];
            
            let eta = 0;
            if (taskStartTime.current && step > 1) {
                const elapsedMs = Date.now() - taskStartTime.current;
                const avgTimePerStep = elapsedMs / (step - 1);
                const remainingSteps = total - step;
                eta = Math.round((avgTimePerStep * remainingSteps) / 1000); // in seconds
            }
            
            setProgressInfo({ step, total, message, eta });
        } else if (lastLog.includes('[Workflow] Starting full research')) {
             setProgressInfo({ step: 0, total: 4, message: 'Starting...', eta: 0 });
        }
    } else if (!isSwarmRunning) {
         taskStartTime.current = null;
         // Reset progress when not running
         setProgressInfo({ step: 0, total: 0, message: '', eta: 0 });
    }
}, [eventLog, isSwarmRunning]);

const handleStart = () => {
    if (taskPrompt.trim()) {
        setResearchHistory([]);
        setSynergies([]);
        setProposals([]);
        setDossiers([]);
        setCritiques([]);
        taskStartTime.current = Date.now();
        setProgressInfo({ step: 0, total: 4, message: 'Initiating workflow...', eta: 0 });

        const workflowTask = {
            isScripted: true,
            script: [
                {
                    name: 'Execute Full Research and Proposal Workflow',
                    arguments: { researchObjective: taskPrompt }
                }
            ]
        };
        startSwarmTask({ task: workflowTask, systemPrompt: null, allTools: runtime.tools.list() });
    }
};

const handleGenerateDossier = React.useCallback((synergy) => {
    if (isSwarmRunning) {
        runtime.logEvent("[UI] Cannot generate dossier while another task is running.");
        return;
    }
    const key = synergy.combination.map(c => c.name).join(' + ');
    setGeneratingDossiers(prev => new Set(prev).add(key));

    const backgroundSources = researchHistory;

    const workflowTask = {
        isScripted: true,
        script: [
            {
                name: 'Generate Proposal for Single Synergy',
                arguments: { synergy, backgroundSources }
            }
        ]
    };
    startSwarmTask({ task: workflowTask, systemPrompt: null, allTools: runtime.tools.list() });
}, [isSwarmRunning, researchHistory, runtime, startSwarmTask]);


const applySynergy = (synergy) => {
    const params = synergy.gameParameters;
    if (!params) return;

    const isHypothesized = synergy.status === 'Hypothesized';
    const comboString = synergy.combination.map(c => c.name).join(' + ');
    runtime.logEvent(\`[Organoid] Applying \${isHypothesized ? 'hypothesized' : 'known'} intervention: \${comboString}\`);

    const uncertaintyFactor = isHypothesized ? (0.5 + Math.random() * 0.5) : 1.0; // Hypothesized effects are less certain and potent
    const toxicityRisk = (params.toxicity_impact || 0) * (isHypothesized ? 1.5 : 1.0); // Hypothesized combos might have unknown risks

    // Apply transient effects for each organoid. These are multipliers that affect rates.
    for (const theoryKey of THEORY_KEYS) {
        // Map abstract parameters to specific Hallmark effects
        if (params.dna_repair_rate_boost) interventionEffects.current[theoryKey].genomicStability *= (1 + (params.dna_repair_rate_boost * uncertaintyFactor / 100));
        if (params.autophagy_boost) interventionEffects.current[theoryKey].proteostasis *= (1 + (params.autophagy_boost * uncertaintyFactor / 100));
        if (params.antioxidant_capacity_boost) interventionEffects.current[theoryKey].mitoEfficiency *= (1 + (params.antioxidant_capacity_boost * uncertaintyFactor / 100));
        if (params.signaling_pathway_inhibition) interventionEffects.current[theoryKey].nutrientSensing *= (1 + (params.signaling_pathway_inhibition * uncertaintyFactor / 100));
        if (params.epigenetic_stabilization) interventionEffects.current[theoryKey].epigeneticStability *= (1 + (params.epigenetic_stabilization * uncertaintyFactor / 100));
    }

    // Apply direct, permanent state changes
    setOrganoids(prevs => {
        const nextStates = {};
        for (const theoryKey of THEORY_KEYS) {
            const prev = prevs[theoryKey];
            if (prev.overallHealth <= 0) {
                nextStates[theoryKey] = prev;
                continue;
            };
            
            // Map abstract parameters to direct Hallmark state changes
            const senescentClearance = (params.senolytic_clearance || 0) * uncertaintyFactor;
            const epigeneticReset = (params.epigenetic_reset_value || 0) * uncertaintyFactor;
            const synapticBoost = (params.synaptic_density_boost || 0) * uncertaintyFactor;
            
            const toxicityMultiplier = 1 - (toxicityRisk / 100);

            nextStates[theoryKey] = { 
                ...prev, 
                cellularSenescence: Math.max(0, prev.cellularSenescence - senescentClearance),
                epigeneticAlterations: Math.max(0, prev.epigeneticAlterations - epigeneticReset),
                synapticDensity: Math.min(100, prev.synapticDensity + synapticBoost),
                // Apply toxicity as a general debuff to core functional hallmarks
                mitoDysfunction: Math.min(100, prev.mitoDysfunction + (1 - toxicityMultiplier) * 50),
                proteostasisLoss: Math.min(100, prev.proteostasisLoss + (1- toxicityMultiplier) * 30),
             };
        }
        return nextStates;
    });
};

const STAT_DEFINITIONS = {
    age: { label: 'Age', unit: 'days' },
    lifespan: { label: 'Lifespan Est.', unit: 'days', formatter: v => organoids[selectedStatTab].overallHealth <= 0 ? '---' : Math.floor(v) },
    overallHealth: { label: 'Health', unit: '%' },
    // Core Hallmarks
    genomicInstability: { label: 'Genomic Instability', unit: '%', inverted: true },
    telomereAttrition: { label: 'Telomere Attrition', unit: '%', inverted: true },
    epigeneticAlterations: { label: 'Epigenetic Noise', unit: '%', inverted: true },
    proteostasisLoss: { label: 'Proteostasis Loss', unit: '%', inverted: true },
    nutrientSensing: { label: 'Dereg. Nutrient Sensing', unit: '%', inverted: true },
    mitoDysfunction: { label: 'Mito Dysfunction', unit: '%', inverted: true },
    cellularSenescence: { label: 'Senescence', unit: '%', inverted: true },
    stemCellExhaustion: { label: 'Stem Cell Exhaustion', unit: '%', inverted: true },
    intercellularCommunication: { label: 'Altered Communication', unit: '%', inverted: true },
    // Functional Outputs
    inflammation: { label: 'Inflammation', unit: '%', inverted: true },
    synapticDensity: { label: 'Synaptic Density', unit: '%' },
    networkActivity: { label: 'Network Activity', unit: '%' },
};

const statsForSelectedTab = ['age', 'lifespan', 'overallHealth', ...(THEORIES[selectedStatTab]?.stats || [])];
const uniqueStatsForTab = [...new Set(statsForSelectedTab)];
const currentOrganoidForStats = organoids[selectedStatTab];

const chronologicalAge = currentOrganoidForStats.age;
const damageScore = (currentOrganoidForStats.genomicInstability + currentOrganoidForStats.telomereAttrition + currentOrganoidForStats.mitoDysfunction) / 3;
const damageClockAge = chronologicalAge * (1 + (damageScore / 110));
const infoLossScore = (currentOrganoidForStats.epigeneticAlterations);
const epigeneticClockAge = chronologicalAge * (1 + (infoLossScore / 110));
const functionalDecline = ((100 - currentOrganoidForStats.stemCellFunction) + (100 - currentOrganoidForStats.networkActivity) + currentOrganoidForStats.proteostasisLoss) / 3;
const functionalClockAge = chronologicalAge * (1 + (functionalDecline / 110));

const critiqueMap = React.useMemo(() => {
    const map = new Map();
    critiques.forEach(c => {
        if(c.combination) {
            const key = c.combination.map(c => c.name).join(' + ');
            map.set(key, c);
        }
    });
    return map;
}, [critiques]);

const dossierMap = React.useMemo(() => {
    const map = new Map();
    dossiers.forEach(d => {
        if(d.combination) {
            const key = d.combination.map(c => c.name).join(' + ');
            map.set(key, d);
        }
    });
    return map;
}, [dossiers]);

const sortedProposals = React.useMemo(() => {
    return [...proposals].sort((a, b) => {
        const dossierA = dossierMap.get(a.combination.map(c => c.name).join(' + '));
        const dossierB = dossierMap.get(b.combination.map(c => c.name).join(' + '));
        
        let valA, valB;

        if (sortConfig.key.startsWith('riskAnalysis.')) {
            const riskKey = sortConfig.key.split('.')[1];
            valA = dossierA?.riskAnalysis?.[riskKey] ?? -1; // Use -1 to sort items without dossiers last
            valB = dossierB?.riskAnalysis?.[riskKey] ?? -1;
        } else if (sortConfig.key === 'estimatedCostUSD') {
            valA = dossierA?.estimatedCostUSD ?? -1;
            valB = dossierB?.estimatedCostUSD ?? -1;
        } else { // Default to trialPriorityScore on the synergy object itself
            valA = a.trialPriorityScore || 0;
            valB = b.trialPriorityScore || 0;
        }

        if (sortConfig.direction === 'asc') {
            if (valA === -1 && valB !== -1) return 1;
            if (valB === -1 && valA !== -1) return -1;
            return valA - valB;
        } else {
            return valB - valA;
        }
    });
}, [proposals, dossierMap, sortConfig]);

const sortedSynergies = React.useMemo(() => {
    const sourceReliabilityMap = new Map(researchHistory.map(r => [r.url, r.reliabilityScore || 0]));
    return [...synergies].sort((a, b) => {
        const reliabilityA = sourceReliabilityMap.get(a.sourceUri) || 0;
        const reliabilityB = sourceReliabilityMap.get(b.sourceUri) || 0;
        if (reliabilityB !== reliabilityA) {
            return reliabilityB - reliabilityA;
        }
        // Secondary sort: Synergistic > Additive > Antagonistic
        const typeOrder = { 'Synergistic': 3, 'Additive': 2, 'Antagonistic': 1 };
        return (typeOrder[b.synergyType] || 0) - (typeOrder[a.synergyType] || 0);
    });
}, [synergies, researchHistory]);

const emptyStateMessage = React.useMemo(() => {
    if (isSwarmRunning) {
        return 'Results will appear here as they are generated...';
    }
    if (researchHistory.length > 0 || synergies.length > 0) {
        return 'Research complete. Ready for new objective.';
    }
    return 'Agent is idle. Define an objective and begin research.';
}, [isSwarmRunning, researchHistory, synergies]);


return (
    <div className="h-full w-full flex bg-slate-900 text-slate-200 font-sans">
        <div className="w-1/3 h-full flex flex-col p-4 gap-4 border-r border-slate-700/50">
            <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-cyan-400">SynergyForge</h1>
                <p className="text-sm text-slate-400">Longevity Engine & Organoid Simulator</p>
            </div>
            <div className="flex flex-col gap-3 bg-black/30 p-4 rounded-lg border border-slate-800">
                <label htmlFor="task-prompt" className="font-semibold text-slate-300">Research Objective:</label>
                <textarea id="task-prompt" value={taskPrompt} onChange={(e) => setTaskPrompt(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm text-slate-200 resize-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" rows={4} placeholder="Use this for the 'Begin Research' task..." />
                 <div>
                    <label htmlFor="model-selector" className="text-sm font-semibold text-slate-300">AI Model:</label>
                    <select 
                        id="model-selector"
                        value={selectedModel.id + '|' + selectedModel.provider}
                        onChange={(e) => {
                            const parts = e.target.value.split('|');
                            const provider = parts.pop();
                            const id = parts.join('|');
                            const model = availableModels.find(m => m.id === id && m.provider === provider);
                            if (model) setSelectedModel(model);
                        }}
                        className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    >
                        {availableModels.map((model, index) => (
                            <option key={model.id + '|' + model.provider + '|' + index} value={model.id + '|' + model.provider}>
                                {model.name} ({model.provider})
                            </option>
                        ))}
                    </select>
                </div>
                <div className="space-y-2 pt-2">
                    {!apiConfig.googleAIAPIKey && (
                        <div>
                            <label htmlFor="gemini-key" className="text-xs font-semibold text-yellow-300">Google AI API Key:</label>
                            <input
                                id="gemini-key"
                                type="password"
                                placeholder="Enter your Google AI Key"
                                value={apiConfig.googleAIAPIKey || ''}
                                onChange={(e) => setApiConfig(prev => ({ ...prev, googleAIAPIKey: e.target.value }))}
                                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm text-slate-200 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                            />
                        </div>
                    )}
                     {selectedModel.provider === 'OpenAI_API' && !apiConfig.openAIAPIKey && (
                         <div>
                            <label htmlFor="openai-key" className="text-xs font-semibold text-yellow-300">OpenAI-Comp. API Key:</label>
                            <input
                                id="openai-key"
                                type="password"
                                placeholder="Enter your OpenAI-compatible Key"
                                value={apiConfig.openAIAPIKey || ''}
                                onChange={(e) => setApiConfig(prev => ({ ...prev, openAIAPIKey: e.target.value }))}
                                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm text-slate-200 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                            />
                        </div>
                    )}
                     {selectedModel.provider === 'OpenAI_API' && (
                         <div>
                            <label htmlFor="openai-url" className="text-xs font-semibold text-slate-300">OpenAI-Comp. Base URL:</label>
                            <input
                                id="openai-url"
                                type="text"
                                placeholder="e.g., https://api.openai.com/v1"
                                value={apiConfig.openAIBaseUrl || ''}
                                onChange={(e) => setApiConfig(prev => ({ ...prev, openAIBaseUrl: e.target.value }))}
                                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                            />
                        </div>
                    )}
                     {selectedModel.provider === 'Ollama' && (
                         <div>
                            <label htmlFor="ollama-host" className="text-xs font-semibold text-slate-300">Ollama Host URL:</label>
                            <input
                                id="ollama-host"
                                type="text"
                                placeholder="e.g., http://localhost:11434"
                                value={apiConfig.ollamaHost || ''}
                                onChange={(e) => setApiConfig(prev => ({ ...prev, ollamaHost: e.target.value }))}
                                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                            />
                        </div>
                    )}
                    {(!apiConfig.googleAIAPIKey || (selectedModel.provider === 'OpenAI_API' && !apiConfig.openAIAPIKey)) &&
                        <p className="text-xs text-slate-500 text-center pt-1">API keys are stored locally in your browser.</p>
                    }
                </div>
                <div className="mt-2 flex">
                    <button onClick={handleStart} disabled={isSwarmRunning || !taskPrompt.trim()} className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-bold py-2 px-4 rounded-lg disabled:from-slate-700 disabled:to-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed transition-all">
                        {isSwarmRunning ? 'Working...' : 'Begin Research'}
                    </button>
                </div>
                 <ProgressTracker progress={progressInfo} isRunning={isSwarmRunning} />
            </div>
            <div className="flex-grow bg-black/20 rounded-lg flex flex-col overflow-hidden border border-slate-800">
                <div className="flex-shrink-0 border-b border-slate-700">
                    <nav className="flex">
                        <button onClick={() => setCurrentTab('sources')} className={\`py-2 px-4 font-semibold transition-colors \${currentTab === 'sources' ? 'text-white bg-slate-700/50 border-b-2 border-cyan-400' : 'text-slate-400 border-b-2 border-transparent hover:bg-slate-800/50'}\`}>Sources ({researchHistory.length})</button>
                        <button onClick={() => setCurrentTab('synergies')} className={\`py-2 px-4 font-semibold transition-colors flex items-center gap-2 \${currentTab === 'synergies' ? 'text-white bg-slate-700/50 border-b-2 border-emerald-400' : 'text-slate-400 border-b-2 border-transparent hover:bg-slate-800/50'}\`}>
                            <span>Synergies ({synergies.length})</span>
                            {isRescoring && <svg className="animate-spin h-4 w-4 text-cyan-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                        </button>
                        <button onClick={() => setCurrentTab('proposals')} className={\`py-2 px-4 font-semibold transition-colors \${currentTab === 'proposals' ? 'text-white bg-slate-700/50 border-b-2 border-amber-400' : 'text-slate-400 border-b-2 border-transparent hover:bg-slate-800/50'}\`}>Proposals ({proposals.length})</button>
                    </nav>
                </div>
                <div className="flex-grow overflow-y-auto p-3 space-y-3">
                    {isSwarmRunning && (researchHistory.length === 0 && synergies.length === 0 && dossiers.length === 0) && <LoadingIndicator message={progressInfo.message} />}
                    {currentTab === 'sources' && researchHistory.map((src, i) => <SourceCard key={i} source={src} />)}
                    {currentTab === 'synergies' && sortedSynergies.map((syn, i) => {
                        const isHypothesized = syn.status === 'Hypothesized';
                        const key = \`\${syn.combination.map(c=>c.name).join('+')}-\${syn.sourceUri || i}\`;
                        return (
                            <SynergyCard 
                                key={key}
                                synergy={syn}
                                actions={(
                                    <button 
                                        onClick={() => applySynergy(syn)} 
                                        disabled={!anyOrganoidAlive || !syn.gameParameters} 
                                        className={\`font-bold py-1.5 px-3 rounded-lg self-start transition-colors \${isHypothesized ? 'bg-purple-600 hover:bg-purple-500' : 'bg-emerald-600 hover:bg-emerald-500'} disabled:bg-slate-600 disabled:cursor-not-allowed\`}
                                    >
                                        {syn.gameParameters ? 'Apply to Organoids' : 'No Parameters'}
                                    </button>
                                )}
                            />
                        );
                    })}
                     {currentTab === 'proposals' && proposals.length > 0 && (
                        <div className="flex flex-col gap-3">
                             <div className="bg-yellow-900/40 border border-yellow-700 text-yellow-200 text-sm p-3 rounded-lg">
                                <strong className="font-bold">Disclaimer:</strong> This content is AI-generated and for informational purposes only. It is not scientific or medical advice. All proposals require rigorous verification by qualified experts before any real-world application.
                            </div>
                             <div className="flex items-center gap-2 px-1">
                                <label htmlFor="sort-proposals" className="text-sm font-semibold text-slate-400">Sort by:</label>
                                <select
                                    id="sort-proposals"
                                    value={\`\${sortConfig.key}-\${sortConfig.direction}\`}
                                    onChange={e => {
                                        const [key, direction] = e.target.value.split('-');
                                        setSortConfig({ key, direction });
                                    }}
                                    className="bg-slate-800 border border-slate-600 rounded-md p-1.5 text-sm text-slate-200 focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="trialPriorityScore-desc">Opportunity (High-Low)</option>
                                    <option value="riskAnalysis.overallRiskScore-asc">Overall Risk (Low-High)</option>
                                    <option value="riskAnalysis.overallRiskScore-desc">Overall Risk (High-Low)</option>
                                    <option value="estimatedCostUSD-asc">Mitigation Cost (Low-High)</option>
                                    <option value="estimatedCostUSD-desc">Mitigation Cost (High-Low)</option>
                                    <option value="riskAnalysis.scientificRisk-asc">Scientific Risk (Low-High)</option>
                                    <option value="riskAnalysis.commercialRisk-asc">Commercial Risk (Low-High)</option>
                                    <option value="riskAnalysis.safetyRisk-asc">Safety Risk (Low-High)</option>
                                </select>
                            </div>
                        </div>
                    )}
                    {currentTab === 'proposals' && sortedProposals.map((syn, i) => {
                        const key = syn.combination.map(c => c.name).join(' + ');
                        const dossier = dossierMap.get(key);
                        const critique = critiqueMap.get(key);

                        if (dossier) {
                            return <DossierCard key={key} dossier={dossier} critique={critique} synergy={syn} />;
                        }

                        const isGenerating = generatingDossiers.has(key);
                        const dossierButtonTitle = isSwarmRunning
                            ? "Cannot generate dossier while a research task is running."
                            : isGenerating
                            ? "This dossier is already being generated."
                            : "Generate a full, investment-ready dossier for this proposal.";
                        return (
                             <SynergyCard
                                key={key}
                                synergy={syn}
                                actions={(
                                    <button
                                        onClick={() => handleGenerateDossier(syn)}
                                        disabled={isSwarmRunning || isGenerating}
                                        title={dossierButtonTitle}
                                        className="font-bold py-1.5 px-3 rounded-lg self-start transition-colors bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 disabled:cursor-not-allowed"
                                    >
                                        {isGenerating ? 'Generating Dossier...' : 'Generate Full Dossier'}
                                    </button>
                                )}
                            />
                        );
                    })}
                    
                    {
                        (currentTab === 'sources' && researchHistory.length === 0) || 
                        (currentTab === 'synergies' && synergies.length === 0) ||
                        (currentTab === 'proposals' && sortedProposals.length === 0)
                     && <p className="text-slate-500 p-4 text-center">{emptyStateMessage}</p>}
                </div>
            </div>
        </div>

        <div className="w-2/3 h-full flex flex-col p-4 gap-4">
            <div className="flex-shrink-0 flex justify-between items-center">
                <h2 className="text-3xl font-bold text-emerald-300 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]">Organoid Odyssey</h2>
                 <button onClick={resetOrganoids} className="bg-red-800/50 text-red-300 border border-red-700 rounded-md px-4 py-2 text-sm hover:bg-red-700/50 font-semibold">Reset All</button>
            </div>
            <p className="text-sm text-slate-400 -mt-3">A Parallel Theory Sandbox</p>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
               {THEORY_KEYS.map(key => <MiniOrganoid key={key} theoryKey={key} organoid={organoids[key]} />)}
            </div>

            <div className="flex-shrink-0 mt-4">
                <h3 className="text-xl font-semibold text-slate-300 mb-2">Integrated Aging Clocks ({THEORIES[selectedStatTab].name})</h3>
                <div className="grid grid-cols-3 gap-4">
                    <AgingClock name="Damage Clock" biologicalAge={damageClockAge} chronologicalAge={chronologicalAge} />
                    <AgingClock name="Epigenetic Clock" biologicalAge={epigeneticClockAge} chronologicalAge={chronologicalAge} />
                    <AgingClock name="Functional Clock" biologicalAge={functionalClockAge} chronologicalAge={chronologicalAge} />
                </div>
            </div>

            <div className="flex-grow bg-black/20 rounded-lg flex flex-col overflow-hidden border border-slate-800 mt-4">
                <div className="flex-shrink-0 border-b border-slate-700">
                    <nav className="flex">
                        {THEORY_KEYS.map(key => (
                            <button 
                                key={key}
                                onClick={() => setSelectedStatTab(key)} 
                                className={\`py-2 px-4 text-sm font-semibold transition-colors capitalize \${selectedStatTab === key ? 'text-white bg-slate-700/50 border-b-2 border-cyan-400' : 'text-slate-400 border-b-2 border-transparent hover:bg-slate-800/50'}\`}
                            >
                                {THEORIES[key].name}
                            </button>
                        ))}
                    </nav>
                </div>
                <div className="flex-grow overflow-y-auto p-4">
                    <div className="grid grid-cols-4 gap-3">
                         {uniqueStatsForTab.map(key => {
                            const statDef = STAT_DEFINITIONS[key];
                            if (!statDef || currentOrganoidForStats[key] === undefined) return null;
                            const rawValue = currentOrganoidForStats[key];
                            const formattedValue = statDef.formatter ? statDef.formatter(rawValue) : typeof rawValue === 'number' ? rawValue.toFixed(1) : rawValue;
                            return <OrganoidStat key={key} label={statDef.label} value={formattedValue} unit={statDef.unit} inverted={statDef.inverted} />;
                         })}
                    </div>
                </div>
            </div>

        </div>
    </div>
);
`
}];

export const BOOTSTRAP_TOOL_PAYLOADS: ToolCreatorPayload[] = [
    ...AUTOMATION_TOOLS,
    ...SERVER_MANAGEMENT_TOOLS,
    ...SYNERGY_FORGE_TOOLS,
    ...WORKFLOW_TOOLS,
    ...RESEARCH_TOOLS,
    ...ANALYSIS_TOOLS,
    ...DATA_RECORDER_TOOLS,
    ...DIAGNOSTIC_TOOLS,
];