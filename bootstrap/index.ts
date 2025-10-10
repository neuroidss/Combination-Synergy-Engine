
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
    stochastic: { dnaRepairRate: 1.0, autophagyBoost: 1.0, antioxidantCapacity: 1.0, signalInhibition: 1.0, epigeneticStabilization: 1.0 },
    hyperfunction: { dnaRepairRate: 1.0, autophagyBoost: 1.0, antioxidantCapacity: 1.0, signalInhibition: 1.0, epigeneticStabilization: 1.0 },
    information: { dnaRepairRate: 1.0, autophagyBoost: 1.0, antioxidantCapacity: 1.0, signalInhibition: 1.0, epigeneticStabilization: 1.0 },
    social: { dnaRepairRate: 1.0, autophagyBoost: 1.0, antioxidantCapacity: 1.0, signalInhibition: 1.0, epigeneticStabilization: 1.0 },
});

const [researchHistory, setResearchHistory] = React.useState([]);
const [synergies, setSynergies] = React.useState([]);
const [dossiers, setDossiers] = React.useState([]);
const [critiques, setCritiques] = React.useState([]);
// FIX: Renamed 'prompt' to 'taskPrompt' to avoid conflict with the window.prompt function.
const [taskPrompt, setTaskPrompt] = React.useState('Discover a broad range of longevity interventions (e.g., drugs, supplements, lifestyle changes) and analyze them to find both known and novel synergistic combinations.');
const [currentTab, setCurrentTab] = React.useState('sources');

const [progressInfo, setProgressInfo] = React.useState({ step: 0, total: 0, message: '', eta: 0 });
const taskStartTime = React.useRef(null);


const resetOrganoids = React.useCallback(() => {
    setOrganoids(getInitialStates());
    runtime.logEvent('[Organoid] Parallel simulation reset.');
}, [runtime]);

React.useEffect(() => {
    const timer = setInterval(() => {
        setOrganoids(prevs => {
            const nextStates = {};
            let allDead = true;
            for (const key of THEORY_KEYS) {
                const prev = prevs[key];
                if (prev.overallHealth <= 0) {
                    nextStates[key] = prev; // Keep dead state
                    continue;
                }
                allDead = false;
                
                const agingFunction = AGING_FUNCTIONS[key];
                let nextState = agingFunction(prev, interventionEffects.current[key]);

                const healthDeclineRate = prev.overallHealth > nextState.overallHealth ? prev.overallHealth - nextState.overallHealth : 0.01;
                const newLifespan = nextState.age + (nextState.overallHealth / healthDeclineRate);
                nextState.lifespan = Number.isFinite(newLifespan) ? newLifespan : prev.lifespan;
                
                const synapticDecline = (nextState.inflammationLevel / 100 * 0.1) + (nextState.extracellularWaste / 100 * 0.1) + ((100-nextState.proteostasisQuality)/100 * 0.05);
                nextState.synapticDensity = Math.max(0, prev.synapticDensity - synapticDecline);
                nextState.networkActivity = nextState.synapticDensity * (nextState.mitoEfficiency / 100);
                
                nextStates[key] = nextState;
            }

            return nextStates;
        });
        
        // Reset transient effects after each tick
        interventionEffects.current = {
            stochastic: { dnaRepairRate: 1.0, autophagyBoost: 1.0, antioxidantCapacity: 1.0, signalInhibition: 1.0, epigeneticStabilization: 1.0 },
            hyperfunction: { dnaRepairRate: 1.0, autophagyBoost: 1.0, antioxidantCapacity: 1.0, signalInhibition: 1.0, epigeneticStabilization: 1.0 },
            information: { dnaRepairRate: 1.0, autophagyBoost: 1.0, antioxidantCapacity: 1.0, signalInhibition: 1.0, epigeneticStabilization: 1.0 },
            social: { dnaRepairRate: 1.0, autophagyBoost: 1.0, antioxidantCapacity: 1.0, signalInhibition: 1.0, epigeneticStabilization: 1.0 },
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
                // FIX: Add defensive check in case synergyCombination is not an array from old history.
                const key = Array.isArray(combination) ? combination.join(' + ') : String(combination);
                gameParamsMap.set(key, h.executionResult.gameParameters);
            });
        
        const finalSynergies = synergiesData.map(syn => ({ ...syn, gameParameters: gameParamsMap.get(syn.combination.join(' + ')) || null }));
        const finalDossiers = liveSwarmHistory.filter(h => h.tool?.name === 'RecordTrialDossier' && h.executionResult?.dossier).map(h => h.executionResult.dossier);
        const finalCritiques = liveSwarmHistory.filter(h => h.tool?.name === 'RecordCritique' && h.executionResult?.critique).map(h => h.executionResult.critique);

        setResearchHistory(newSources);
        setSynergies(finalSynergies);
        setDossiers(finalDossiers);
        setCritiques(finalCritiques);
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
             setProgressInfo({ step: 0, total: 13, message: 'Starting...', eta: 0 });
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
        setDossiers([]);
        setCritiques([]);
        taskStartTime.current = Date.now();
        setProgressInfo({ step: 0, total: 13, message: 'Initiating workflow...', eta: 0 });

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

const applySynergy = (synergy) => {
    const params = synergy.gameParameters;
    const isHypothesized = synergy.status === 'Hypothesized';
    runtime.logEvent(\`[Organoid] Applying \${isHypothesized ? 'hypothesized' : 'known'} intervention: \${synergy.combination.join(' + ')}\`);

    const uncertaintyFactor = isHypothesized ? (0.5 + Math.random()) : 1;
    const toxicityRisk = (isHypothesized ? (Math.random() * 0.5) : 1) * (params.toxicity_impact || 0);

    const effectiveness = {
        senolytic: { social: 1.0, stochastic: 0.2, hyperfunction: 0.1, information: 0.1 },
        autophagy: { stochastic: 1.0, social: 0.4, hyperfunction: 0.3, information: 0.2 },
        antioxidant: { stochastic: 1.0, hyperfunction: 0.5, social: 0.3, information: 0.1 },
        dna_repair: { stochastic: 1.0, information: 0.4, social: 0.3, hyperfunction: 0.1 },
        epigenetic: { information: 1.0, stochastic: 0.2, social: 0.2, hyperfunction: 0.1 },
        synaptic: { stochastic: 0.8, hyperfunction: 0.6, information: 0.6, social: 0.5 },
        signal_inhibition: { hyperfunction: 1.0, stochastic: 0.2, social: 0.1, information: 0.1 },
    };

    // Apply transient effects for each organoid
    for (const theoryKey of THEORY_KEYS) {
        if (params.dna_repair_rate_boost) interventionEffects.current[theoryKey].dnaRepairRate += params.dna_repair_rate_boost * uncertaintyFactor * (effectiveness.dna_repair[theoryKey] || 0);
        if (params.autophagy_boost) interventionEffects.current[theoryKey].autophagyBoost += params.autophagy_boost * uncertaintyFactor * (effectiveness.autophagy[theoryKey] || 0);
        if (params.antioxidant_capacity_boost) interventionEffects.current[theoryKey].antioxidantCapacity += params.antioxidant_capacity_boost * uncertaintyFactor * (effectiveness.antioxidant[theoryKey] || 0);
        if (params.signaling_pathway_inhibition) interventionEffects.current[theoryKey].signalInhibition += params.signaling_pathway_inhibition * uncertaintyFactor * (effectiveness.signal_inhibition[theoryKey] || 0);
        if (params.epigenetic_stabilization) interventionEffects.current[theoryKey].epigeneticStabilization += params.epigenetic_stabilization * uncertaintyFactor * (effectiveness.epigenetic[theoryKey] || 0);
    }

    setOrganoids(prevs => {
        const nextStates = {};
        for (const theoryKey of THEORY_KEYS) {
            const prev = prevs[theoryKey];
            if (prev.overallHealth <= 0) {
                nextStates[theoryKey] = prev;
                continue;
            };
            
            const newSenescentCellBurden = Math.max(0, prev.senescentCellBurden - ((params.senolytic_clearance || 0) * uncertaintyFactor * (effectiveness.senolytic[theoryKey] || 0)));
            const newEpigeneticNoise = Math.max(0, prev.epigeneticNoise - ((params.epigenetic_reset_value || 0) * uncertaintyFactor * (effectiveness.epigenetic[theoryKey] || 0)));
            const newSynapticDensity = Math.min(100, prev.synapticDensity + ((params.synaptic_density_boost || 0) * uncertaintyFactor * (effectiveness.synaptic[theoryKey] || 0)));
            const toxicityMultiplier = 1 - (toxicityRisk / 100);
            
            nextStates[theoryKey] = { ...prev, senescentCellBurden: newSenescentCellBurden, epigeneticNoise: newEpigeneticNoise, synapticDensity: newSynapticDensity, mitoEfficiency: prev.mitoEfficiency * toxicityMultiplier, proteostasisQuality: prev.proteostasisQuality * toxicityMultiplier };
        }
        return nextStates;
    });
};

const STAT_DEFINITIONS = {
    age: { label: 'Age', unit: 'days' },
    lifespan: { label: 'Lifespan Est.', unit: 'days', formatter: v => organoids[selectedStatTab].overallHealth <= 0 ? '---' : Math.floor(v) },
    overallHealth: { label: 'Health', unit: '%' },
    totalCellCount: { label: 'Cell Count', unit: '', formatter: v => Math.floor(v).toLocaleString() },
    dnaDamage: { label: 'DNA Damage', unit: '%', inverted: true },
    mitoEfficiency: { label: 'Mito Efficiency', unit: '%' },
    proteostasisQuality: { label: 'Proteostasis', unit: '%' },
    oxidativeStress: { label: 'Oxidative Stress', unit: '%', inverted: true },
    extracellularWaste: { label: 'ECF Waste', unit: '%', inverted: true },
    developmentalSignalStrength: { label: 'Hyperfunction Signal', unit: '%', inverted: true },
    cellularHypertrophy: { label: 'Cell Hypertrophy', unit: '%', inverted: true },
    epigeneticNoise: { label: 'Epigenetic Noise', unit: '%', inverted: true },
    misexpressionChance: { label: 'Gene Misexpression', unit: '%', inverted: true },
    senescentCellBurden: { label: 'Senescence', unit: '%', inverted: true },
    inflammationLevel: { label: 'Inflammation', unit: '%', inverted: true },
    stemCellPool: { label: 'Stem Cell Pool', unit: '%' },
    microgliaState: { label: 'Microglia State', unit: '', formatter: v => v === 1 ? 'Reactive' : 'Surveilling' },
    synapticDensity: { label: 'Synaptic Density', unit: '%' },
    networkActivity: { label: 'Network Activity', unit: '%' },
};

const statsForSelectedTab = ['age', 'lifespan', 'totalCellCount', 'overallHealth', ...(THEORIES[selectedStatTab]?.stats || [])];
const uniqueStatsForTab = [...new Set(statsForSelectedTab)];
const currentOrganoidForStats = organoids[selectedStatTab];

const chronologicalAge = currentOrganoidForStats.age;
const damageScore = (currentOrganoidForStats.dnaDamage + currentOrganoidForStats.oxidativeStress + currentOrganoidForStats.extracellularWaste) / 3;
const damageClockAge = chronologicalAge * (1 + (damageScore / 110));
const infoLossScore = (currentOrganoidForStats.epigeneticNoise * 0.7 + currentOrganoidForStats.misexpressionChance * 0.3);
const epigeneticClockAge = chronologicalAge * (1 + (infoLossScore / 110));
const functionalDecline = ((100 - currentOrganoidForStats.mitoEfficiency) + (100 - currentOrganoidForStats.networkActivity) + (100 - currentOrganoidForStats.proteostasisQuality)) / 3;
const functionalClockAge = chronologicalAge * (1 + (functionalDecline / 110));

const critiqueMap = new Map();
critiques.forEach(c => {
    if(c.combination) {
        const key = c.combination.join(' + ');
        critiqueMap.set(key, c);
    }
});

const emptyStateMessage = React.useMemo(() => {
    if (isSwarmRunning) {
        return 'Results will appear here as they are generated...';
    }
    if (researchHistory.length > 0 || synergies.length > 0) {
        return 'Research complete. Ready for new objective.';
    }
    return 'Agent is idle. Define an objective and generate proposals.';
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
                            const [id, provider] = e.target.value.split('|');
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
                        {isSwarmRunning ? 'Working...' : 'Generate Proposals'}
                    </button>
                </div>
                 <ProgressTracker progress={progressInfo} isRunning={isSwarmRunning} />
            </div>
            <div className="flex-grow bg-black/20 rounded-lg flex flex-col overflow-hidden border border-slate-800">
                <div className="flex-shrink-0 border-b border-slate-700">
                    <nav className="flex">
                        <button onClick={() => setCurrentTab('sources')} className={\`py-2 px-4 font-semibold transition-colors \${currentTab === 'sources' ? 'text-white bg-slate-700/50 border-b-2 border-cyan-400' : 'text-slate-400 border-b-2 border-transparent hover:bg-slate-800/50'}\`}>Sources ({researchHistory.length})</button>
                        <button onClick={() => setCurrentTab('synergies')} className={\`py-2 px-4 font-semibold transition-colors \${currentTab === 'synergies' ? 'text-white bg-slate-700/50 border-b-2 border-emerald-400' : 'text-slate-400 border-b-2 border-transparent hover:bg-slate-800/50'}\`}>Synergies ({synergies.length})</button>
                        <button onClick={() => setCurrentTab('proposals')} className={\`py-2 px-4 font-semibold transition-colors \${currentTab === 'proposals' ? 'text-white bg-slate-700/50 border-b-2 border-amber-400' : 'text-slate-400 border-b-2 border-transparent hover:bg-slate-800/50'}\`}>Proposals ({dossiers.length})</button>
                    </nav>
                </div>
                <div className="flex-grow overflow-y-auto p-3 space-y-3">
                    {isSwarmRunning && (researchHistory.length === 0 && synergies.length === 0 && dossiers.length === 0) && <LoadingIndicator message={progressInfo.message} />}
                    {currentTab === 'sources' && researchHistory.map((src, i) => <SourceCard key={i} source={src} />)}
                    {currentTab === 'synergies' && synergies.map((syn, i) => <SynergyCard key={i} synergy={syn} />)}
                    {currentTab === 'proposals' && dossiers.length > 0 && (
                        <div className="bg-yellow-900/40 border border-yellow-700 text-yellow-200 text-sm p-3 rounded-lg">
                            <strong className="font-bold">Disclaimer:</strong> This content is AI-generated and for informational purposes only. It is not scientific or medical advice. All proposals require rigorous verification by qualified experts before any real-world application.
                        </div>
                    )}
                    {currentTab === 'proposals' && dossiers.map((dos, i) => {
                        const critique = critiqueMap.get(dos.combination.join(' + '));
                        return <DossierCard key={i} dossier={dos} critique={critique} />;
                    })}
                    
                    {
                        (currentTab === 'sources' && researchHistory.length === 0) || 
                        (currentTab === 'synergies' && synergies.length === 0) ||
                        (currentTab === 'proposals' && dossiers.length === 0)
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
                            if (!statDef) return null;
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