

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
import { DISCOVERY_TOOLS } from './discovery_tools';
import { PERSONALIZATION_TOOLS } from './personalization_tools';

const SYNERGY_FORGE_TOOLS: ToolCreatorPayload[] = [{
    name: 'Synergy Forge Main UI',
    description: 'The main user interface for the SynergyForge application, an advanced research environment for longevity science. It features a real-time discovery map, a unified results feed, and a multi-theory organoid simulator.',
    category: 'UI Component',
    executionEnvironment: 'Client',
    purpose: "To provide the complete interactive front-end for the SynergyForge application, allowing users to define research objectives, run AI agent swarms, and visualize all results in a single, real-time view.",
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

// --- PERSONALIZATION STATE ---
const [userAgingVector, setUserAgingVector] = React.useState(null);
const [userCoordinates, setUserCoordinates] = React.useState(null);
const [personalizedVacancies, setPersonalizedVacancies] = React.useState([]);
const [isProfileOpen, setIsProfileOpen] = React.useState(true); // Open by default
const [profileForm, setProfileForm] = React.useState({ age: 45, sleep: 7, stress: 5, diet: 'average', exercise: 3 });


const [organoids, setOrganoids] = React.useState(getInitialStates());
const [selectedStatTab, setSelectedStatTab] = React.useState('stochastic');

const interventionEffects = React.useRef({
    stochastic: getInitialInterventionEffects(),
    hyperfunction: getInitialInterventionEffects(),
    information: getInitialInterventionEffects(),
    social: getInitialInterventionEffects(),
});

const [taskPrompt, setTaskPrompt] = React.useState('Discover a broad range of longevity interventions (e.g., drugs, supplements, lifestyle changes) and analyze them to find both known and novel synergistic combinations.');
const [sortConfig, setSortConfig] = React.useState({ key: 'trialPriorityScore', direction: 'desc' });
const [progressInfo, setProgressInfo] = React.useState({ step: 0, total: 0, message: '', eta: 0 });
const taskStartTime = React.useRef(null);
const [isRescoring, setIsRescoring] = React.useState(false);
const [generatingDossiers, setGeneratingDossiers] = React.useState(new Set());

// REAL-TIME STATES
const [liveFeed, setLiveFeed] = React.useState([]);
const [allSources, setAllSources] = React.useState([]);
const [mapData, setMapData] = React.useState([]);
const [vacancies, setVacancies] = React.useState([]);
const [isInterpreting, setIsInterpreting] = React.useState(false);
const [isMapLoading, setIsMapLoading] = React.useState(false);

const updateMapRealtime = React.useCallback(async (sources) => {
    if (!sources || sources.length < 3) { // Need at least 3 points for a meaningful map
        setMapData([]);
        setVacancies([]);
        return;
    }

    setIsMapLoading(true);
    runtime.logEvent('[Discovery Map] Change detected. Re-generating semantic map...');
    try {
        // Step 1: Embed all sources
        const embedResult = await runtime.tools.run('Embed All Sources', { sources });
        if (!embedResult || !embedResult.embeddedSources) {
            throw new Error("Embedding step failed.");
        }
        const embeddedSources = embedResult.embeddedSources;

        // Step 2: Generate 2D coordinates using PCA
        const mapGenResult = await runtime.tools.run('Generate 2D Map Coordinates', { embeddedSources });
        if (!mapGenResult || !mapGenResult.mapData) {
            throw new Error("Map coordinate generation step failed.");
        }
        const newMapData = mapGenResult.mapData;

        // Step 3: Find vacancies using grid-based density
        const newVacancies = [];
        const mapSize = 500;
        const gridSize = 20; // 20x20 grid
        const cellSize = mapSize / gridSize;
        const grid = Array(gridSize).fill(0).map(() => Array(gridSize).fill(0));

        for (const point of newMapData) {
            const gridX = Math.floor(point.x / cellSize);
            const gridY = Math.floor(point.y / cellSize);
            if (grid[gridX] && grid[gridX][gridY] !== undefined) {
                grid[gridX][gridY]++;
            }
        }
        
        const vacancyThreshold = 1; // Cells with this many points or fewer are vacancies
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                if (grid[i][j] <= vacancyThreshold) {
                    newVacancies.push({
                        id: \`v-\${i}-\${j}\`,
                        x: (i + 0.5) * cellSize, // Center of the cell
                        y: (j + 0.5) * cellSize,
                        radius: cellSize * 0.7, // Make radius slightly smaller than cell
                    });
                }
            }
        }
        
        setMapData(newMapData);
        setVacancies(newVacancies);
        runtime.logEvent(\`[Discovery Map] ✅ Map updated with \${newMapData.length} sources and \${newVacancies.length} potential vacancies.\`);

    } catch (e) {
        runtime.logEvent(\`[Discovery Map] ❌ Error generating map: \${e.message}\`);
        // Don't clear map on error, keep the old one
    } finally {
        setIsMapLoading(false);
    }
}, [runtime]);


const handleInterpretVacancy = async (vacancy) => {
    setIsInterpreting(true);
    try {
        const result = await runtime.tools.run('InterpretVacancy', { vacancy, mapData });
        setLiveFeed(prev => [{ type: 'interpretation', data: result, id: Date.now() }, ...prev]);
    } catch (e) {
        runtime.logEvent(\`[Discovery Map] Error interpreting vacancy: \${e.message}\`);
    } finally {
        setIsInterpreting(false);
    }
};

const resetOrganoids = React.useCallback(() => {
    setOrganoids(getInitialStates(userAgingVector)); // Reset with user vector if available
    runtime.logEvent('[Organoid] Parallel simulation reset.');
}, [runtime, userAgingVector]);

React.useEffect(() => {
    // This effect runs whenever new sources are added, triggering a re-evaluation of all synergies.
    const reScoreAllSynergies = async () => {
        const synergiesToRescore = liveFeed.filter(item => item.type === 'synergy').map(item => item.data);
        if (isSwarmRunning || isRescoring || synergiesToRescore.length === 0 || allSources.length === 0) {
            return;
        }

        setIsRescoring(true);
        runtime.logEvent('[Re-evaluation] Change detected in research data. Starting background re-scoring of all synergies...');
        
        for (const synergy of synergiesToRescore) {
            if (isSwarmRunning) {
                runtime.logEvent('[Re-evaluation] Swarm started, aborting background re-scoring.');
                break;
            }
            try {
                const scoringResult = await runtime.tools.run('Score Single Synergy', {
                    synergyToScore: synergy,
                    backgroundSources: allSources,
                });
                
                if (scoringResult && scoringResult.updatedSynergy) {
                    setLiveFeed(prevFeed => {
                        const getComboKey = (s) => Array.isArray(s.combination) ? s.combination.map(c => c.name).sort().join('+') : 'invalid';
                        const keyToFind = getComboKey(scoringResult.updatedSynergy);
                        const index = prevFeed.findIndex(item => item.type === 'synergy' && getComboKey(item.data) === keyToFind);

                        if (index !== -1) {
                            const newFeed = [...prevFeed];
                            newFeed[index] = { ...newFeed[index], data: scoringResult.updatedSynergy };
                            return newFeed;
                        }
                        return prevFeed;
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
}, [allSources.length]);

// --- PERSONALIZATION LOGIC ---
const handleProfileFormChange = (e) => {
    const { name, value, type } = e.target;
    setProfileForm(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) : value }));
};

const handleCreateProfile = async (e) => {
    e.preventDefault();
    const vectorResult = await runtime.tools.run('CreateUserAgingVector', { lifestyleData: profileForm });
    if (vectorResult.userAgingVector) {
        setUserAgingVector(vectorResult.userAgingVector);
        // Immediately initialize the organoid simulator with the new user profile
        setOrganoids(getInitialStates(vectorResult.userAgingVector));
        runtime.logEvent('[Personalization] Organoid "virtual twin" configured for user profile.');
        setIsProfileOpen(false); // Close the profile modal
    }
};

React.useEffect(() => {
    // This effect projects the user onto the map and finds personalized vacancies
    const updateUserProjection = async () => {
        if (userAgingVector && mapData.length > 0 && vacancies.length > 0) {
            try {
                const coordsResult = await runtime.tools.run('ProjectUserOntoMap', { userAgingVector, mapData });
                if (coordsResult && coordsResult.userCoordinates) {
                    setUserCoordinates(coordsResult.userCoordinates);
                    const vacanciesResult = await runtime.tools.run('FindPersonalizedVacancies', {
                        userCoordinates: coordsResult.userCoordinates,
                        mapData,
                        vacancies,
                    });
                    if (vacanciesResult && vacanciesResult.personalizedVacancies) {
                       setPersonalizedVacancies(vacanciesResult.personalizedVacancies);
                       runtime.logEvent(\`[Personalization] Found \${vacanciesResult.personalizedVacancies.length} high-potential research areas for you.\`);
                    }
                }
            } catch (e) {
                 runtime.logEvent(\`[Personalization] ❌ Error updating user projection: \${e.message}\`);
            }
        }
    };
    updateUserProjection();
}, [userAgingVector, mapData, vacancies]);
// --- END PERSONALIZATION ---


React.useEffect(() => {
    const timer = setInterval(() => {
        setOrganoids(prevs => {
            const nextStates = {};
            for (const key of THEORY_KEYS) {
                const prev = prevs[key];
                if (prev.overallHealth <= 0) {
                    nextStates[key] = prev;
                    continue;
                }
                const agingFunction = AGING_FUNCTIONS[key];
                let nextState = agingFunction(prev, interventionEffects.current[key]);
                nextStates[key] = nextState;
            }
            return nextStates;
        });
        
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
    if (!liveSwarmHistory || liveSwarmHistory.length === 0) return;

    const newSources = liveSwarmHistory
        .filter(h => 
            h.tool?.name === 'RecordValidatedSource' && 
            h.executionResult?.validatedSource &&
            // Filter out sources with 0 reliability, as they are typically 404s or invalid.
            h.executionResult.validatedSource.reliabilityScore > 0
        )
        .map(h => ({
            ...h.executionResult.validatedSource,
            id: h.executionResult.validatedSource.uri,
            type: 'source'
        }));

    const newSynergies = liveSwarmHistory
        .filter(h => h.tool?.name === 'RecordSynergy' && h.executionResult?.synergy)
        .map(h => ({
            data: h.executionResult.synergy,
            id: (h.executionResult.synergy.combination.map(c => c.name).sort().join('+') + (h.executionResult.synergy.sourceUri || '')),
            type: 'synergy'
        }));

    const newDossiers = liveSwarmHistory
        .filter(h => h.tool?.name === 'RecordTrialDossier' && h.executionResult?.dossier)
        .map(h => ({
            data: h.executionResult.dossier,
            id: h.executionResult.dossier.combination.map(c => c.name).sort().join('+'),
            type: 'dossier'
        }));
    
    const newCritiques = liveSwarmHistory
        .filter(h => h.tool?.name === 'RecordCritique' && h.executionResult?.critique)
        .map(h => ({
            data: h.executionResult.critique,
            id: h.executionResult.critique.combination.map(c => c.name).sort().join('+'),
            type: 'critique'
        }));

    setAllSources(currentSources => {
        const newUniqueSources = newSources
            .map(s => s)
            .filter(s => !currentSources.some(cs => cs.id === s.id));
        if (newUniqueSources.length > 0) {
            const updatedSources = [...currentSources, ...newUniqueSources];
            updateMapRealtime(updatedSources);
            return updatedSources;
        }
        return currentSources;
    });

    setLiveFeed(currentFeed => {
        const feedMap = new Map(currentFeed.map(item => [item.id, item]));

        newSources.forEach(source => {
            if (!feedMap.has(source.id)) {
                feedMap.set(source.id, { type: 'source', data: source, id: source.id, timestamp: Date.now() });
            }
        });

        newSynergies.forEach(synergy => {
            // Only add if it's not already a dossier
            const dossierKey = synergy.data.combination.map(c => c.name).sort().join('+');
            const existing = feedMap.get(synergy.id);
            const existingDossier = feedMap.get(dossierKey);
            
            if (existingDossier && existingDossier.type === 'dossier') return;

            if (!existing || (synergy.data.trialPriorityScore || 0) > (existing.data.trialPriorityScore || 0)) {
                feedMap.set(synergy.id, { ...synergy, timestamp: Date.now() });
            }
        });
        
        newDossiers.forEach(dossier => {
            const dossierKey = dossier.id;
            const existingItem = feedMap.values().find(item => item.id.startsWith(dossierKey));
            
            let originalSynergy = {};
            if (existingItem && existingItem.type === 'synergy') {
                 originalSynergy = existingItem.data;
                 feedMap.delete(existingItem.id); // remove all synergy versions
            }
            
            feedMap.set(dossier.id, { type: 'dossier', data: { ...dossier.data, synergyData: originalSynergy }, id: dossier.id, timestamp: Date.now() });
        });

        newCritiques.forEach(critique => {
            const dossierKey = critique.id;
            const existingDossier = feedMap.get(dossierKey);
            if (existingDossier && existingDossier.type === 'dossier') {
                existingDossier.data.critique = critique.data;
                feedMap.set(dossierKey, existingDossier);
            }
        });
        
        return Array.from(feedMap.values()).sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
    });

    if (newDossiers.length > 0) {
        const justGeneratedKeys = newDossiers.map(d => d.id);
        setGeneratingDossiers(prev => {
            const newSet = new Set(prev);
            justGeneratedKeys.forEach(key => newSet.delete(key));
            return newSet;
        });
    }

}, [liveSwarmHistory, updateMapRealtime]);

const anyOrganoidAlive = React.useMemo(() => Object.values(organoids).some(o => o.overallHealth > 0), [organoids]);

React.useEffect(() => {
    if (isSwarmRunning && eventLog && eventLog.length > 0) {
        // Search backwards for the last progress update to ensure we don't miss it.
        let progressMatch = null;
        for (let i = eventLog.length - 1; i >= 0; i--) {
            const log = eventLog[i];
            const match = log.match(/\\\[Workflow\\] Step (\\d+)\\/(\\d+): (.*)/);
            if (match) {
                progressMatch = match;
                break; // Found the most recent progress update
            }
        }

        if (progressMatch) {
            const step = parseInt(progressMatch[1], 10);
            const total = parseInt(progressMatch[2], 10);
            const message = progressMatch[3];
            
            let eta = 0;
            if (taskStartTime.current && step > 1) {
                const elapsedMs = Date.now() - taskStartTime.current;
                const avgTimePerStep = elapsedMs / (step - 1);
                const remainingSteps = total - step;
                eta = Math.round((avgTimePerStep * remainingSteps) / 1000);
            }
            
            setProgressInfo({ step, total, message, eta });
        }
    } else if (!isSwarmRunning) {
         taskStartTime.current = null;
         setProgressInfo({ step: 0, total: 0, message: '', eta: 0 });
    }
}, [eventLog, isSwarmRunning]);

const handleStart = () => {
    if (taskPrompt.trim()) {
        setLiveFeed([]);
        setAllSources([]);
        setMapData([]);
        setVacancies([]);
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
    const key = synergy.combination.map(c => c.name).sort().join(' + ');
    setGeneratingDossiers(prev => new Set(prev).add(key));

    const workflowTask = {
        isScripted: true,
        script: [
            {
                name: 'Generate Proposal for Single Synergy',
                arguments: { synergy, backgroundSources: allSources }
            }
        ]
    };
    startSwarmTask({ task: workflowTask, systemPrompt: null, allTools: runtime.tools.list() });
}, [isSwarmRunning, allSources, runtime, startSwarmTask]);


const applySynergy = (synergy) => {
    const params = synergy.gameParameters;
    if (!params) return;

    const isHypothesized = synergy.status.includes('Hypothesized');
    const comboString = synergy.combination.map(c => c.name).join(' + ');
    runtime.logEvent(\`[Organoid] Applying \${isHypothesized ? 'hypothesized' : 'known'} intervention: \${comboString}\`);

    const uncertaintyFactor = isHypothesized ? (0.5 + Math.random() * 0.5) : 1.0;
    const toxicityRisk = (params.toxicity_impact || 0) * (isHypothesized ? 1.5 : 1.0);

    for (const theoryKey of THEORY_KEYS) {
        if (params.dna_repair_rate_boost) interventionEffects.current[theoryKey].genomicStability *= (1 + (params.dna_repair_rate_boost * uncertaintyFactor / 100));
        if (params.autophagy_boost) interventionEffects.current[theoryKey].proteostasis *= (1 + (params.autophagy_boost * uncertaintyFactor / 100));
        if (params.antioxidant_capacity_boost) interventionEffects.current[theoryKey].mitoEfficiency *= (1 + (params.antioxidant_capacity_boost * uncertaintyFactor / 100));
        if (params.signaling_pathway_inhibition) interventionEffects.current[theoryKey].nutrientSensing *= (1 + (params.signaling_pathway_inhibition * uncertaintyFactor / 100));
        if (params.epigenetic_stabilization) interventionEffects.current[theoryKey].epigeneticStability *= (1 + (params.epigenetic_stabilization * uncertaintyFactor / 100));
        if (params.myelin_repair_boost) interventionEffects.current[theoryKey].myelinRepair *= (1 + (params.myelin_repair_boost * uncertaintyFactor / 100));
        if (params.neurotransmitter_stabilization) interventionEffects.current[theoryKey].neurotransmitterSupport *= (1 + (params.neurotransmitter_stabilization * uncertaintyFactor / 100));
    }

    setOrganoids(prevs => {
        const nextStates = {};
        for (const theoryKey of THEORY_KEYS) {
            const prev = prevs[theoryKey];
            if (prev.overallHealth <= 0) {
                nextStates[theoryKey] = prev;
                continue;
            };
            
            const SUPER_NEURON_CAP = 200;
            const senescentClearance = (params.senolytic_clearance || 0) * uncertaintyFactor;
            const epigeneticReset = (params.epigenetic_reset_value || 0) * uncertaintyFactor;
            const synapticBoost = (params.synaptic_density_boost || 0) * uncertaintyFactor;
            const dendriticBoost = (params.dendritic_arborization_factor || 0) * uncertaintyFactor;
            const toxicityMultiplier = 1 - (toxicityRisk / 100);

            nextStates[theoryKey] = { 
                ...prev, 
                cellularSenescence: Math.max(0, prev.cellularSenescence - senescentClearance),
                epigeneticAlterations: Math.max(0, prev.epigeneticAlterations - epigeneticReset),
                synapticDensity: Math.min(SUPER_NEURON_CAP, prev.synapticDensity + synapticBoost),
                dendriticComplexity: Math.min(SUPER_NEURON_CAP, prev.dendriticComplexity + dendriticBoost),
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
    genomicInstability: { label: 'Genomic Instability', unit: '%', inverted: true },
    telomereAttrition: { label: 'Telomere Attrition', unit: '%', inverted: true },
    epigeneticAlterations: { label: 'Epigenetic Noise', unit: '%', inverted: true },
    proteostasisLoss: { label: 'Proteostasis Loss', unit: '%', inverted: true },
    nutrientSensing: { label: 'Dereg. Nutrient Sensing', unit: '%', inverted: true },
    mitoDysfunction: { label: 'Mito Dysfunction', unit: '%', inverted: true },
    cellularSenescence: { label: 'Senescence', unit: '%', inverted: true },
    stemCellExhaustion: { label: 'Stem Cell Exhaustion', unit: '%', inverted: true },
    intercellularCommunication: { label: 'Altered Communication', unit: '%', inverted: true },
    inflammation: { label: 'Inflammation', unit: '%', inverted: true },
    synapticDensity: { label: 'Synaptic Density', unit: '%' },
    networkActivity: { label: 'Network Activity', unit: '%' },
    myelinIntegrity: { label: 'Myelin Integrity', unit: '%' },
    neurotransmitterBalance: { label: 'Neurotransmitter Balance', unit: '%' },
    dendriticComplexity: { label: 'Dendritic Complexity', unit: '%' },
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

const personalizedVacancyIds = new Set(personalizedVacancies.map(v => v.id));

return (
    <div className="h-full w-full flex bg-slate-900 text-slate-200 font-sans overflow-hidden">
        {isProfileOpen && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-opacity duration-300">
                <div className="w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl text-center animate-fade-in">
                    <h2 className="text-3xl font-bold text-cyan-300">Create Your Personal Longevity Profile</h2>
                    <p className="text-slate-400 mt-2 mb-6">Answer a few questions to project yourself onto the research map and initialize your virtual twin.</p>
                    <form onSubmit={handleCreateProfile} className="text-left space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="age" className="block text-sm font-medium text-slate-300">Current Age</label>
                                <input type="number" name="age" id="age" value={profileForm.age} onChange={handleProfileFormChange} className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"/>
                            </div>
                            <div>
                                <label htmlFor="sleep" className="block text-sm font-medium text-slate-300">Avg. Sleep (hours/night)</label>
                                <input type="number" name="sleep" id="sleep" value={profileForm.sleep} onChange={handleProfileFormChange} className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"/>
                            </div>
                            <div>
                                <label htmlFor="stress" className="block text-sm font-medium text-slate-300">Stress Level (1-10)</label>
                                <input type="range" name="stress" id="stress" min="1" max="10" value={profileForm.stress} onChange={handleProfileFormChange} className="mt-1 block w-full"/>
                            </div>
                            <div>
                                <label htmlFor="exercise" className="block text-sm font-medium text-slate-300">Exercise (days/week)</label>
                                <input type="number" name="exercise" id="exercise" value={profileForm.exercise} onChange={handleProfileFormChange} className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"/>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="diet" className="block text-sm font-medium text-slate-300">Diet Quality</label>
                            <select name="diet" id="diet" value={profileForm.diet} onChange={handleProfileFormChange} className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500">
                                <option value="poor">Poor (Processed Foods)</option>
                                <option value="average">Average (Mixed)</option>
                                <option value="good">Good (Whole Foods)</option>
                            </select>
                        </div>
                        <button type="submit" className="w-full mt-6 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold py-3 px-4 rounded-lg text-lg transition-transform hover:scale-105">
                            Find My Path to Longevity
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* Left Column: Controls & Simulation */}
        <div className="w-[28rem] h-full flex flex-col p-4 gap-4 border-r border-slate-700/50 flex-shrink-0 overflow-y-auto">
            {/* Control Panel */}
            <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-cyan-400">SynergyForge</h1>
                <p className="text-sm text-slate-400">Your Personal Longevity Navigator</p>
            </div>
            <div className="flex flex-col gap-3 bg-black/30 p-4 rounded-lg border border-slate-800">
                <label htmlFor="task-prompt" className="font-semibold text-slate-300">Research Objective:</label>
                <textarea id="task-prompt" value={taskPrompt} onChange={(e) => setTaskPrompt(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm text-slate-200 resize-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" rows={4} placeholder="e.g., Discover novel synergistic treatments for Alzheimer's disease..." />
                 <div>
                    <label htmlFor="model-selector" className="text-sm font-semibold text-slate-300">AI Model:</label>
                    <select id="model-selector" value={selectedModel.id + '|' + selectedModel.provider}
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
                    {selectedModel.provider === 'GoogleAI' && !apiConfig.googleAIAPIKey && (
                        <div>
                            <label htmlFor="gemini-key" className="text-xs font-semibold text-yellow-300">Google AI API Key:</label>
                            <input id="gemini-key" type="password" placeholder="Enter your Google AI Key" value={apiConfig.googleAIAPIKey || ''} onChange={(e) => setApiConfig(prev => ({ ...prev, googleAIAPIKey: e.target.value }))} className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm text-slate-200 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500" />
                        </div>
                    )}
                     {selectedModel.provider === 'OpenAI_API' && !apiConfig.openAIAPIKey && (
                         <div>
                            <label htmlFor="openai-key" className="text-xs font-semibold text-yellow-300">OpenAI-Comp. API Key:</label>
                            <input id="openai-key" type="password" placeholder="Enter your OpenAI-compatible Key" value={apiConfig.openAIAPIKey || ''} onChange={(e) => setApiConfig(prev => ({ ...prev, openAIAPIKey: e.target.value }))} className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm text-slate-200 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500" />
                        </div>
                    )}
                     {selectedModel.provider === 'OpenAI_API' && (
                         <div>
                            <label htmlFor="openai-url" className="text-xs font-semibold text-slate-300">OpenAI-Comp. Base URL:</label>
                            <input id="openai-url" type="text" placeholder="e.g., https://api.openai.com/v1" value={apiConfig.openAIBaseUrl || ''} onChange={(e) => setApiConfig(prev => ({ ...prev, openAIBaseUrl: e.target.value }))} className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" />
                        </div>
                    )}
                     {selectedModel.provider === 'Ollama' && (
                         <div>
                            <label htmlFor="ollama-host" className="text-xs font-semibold text-slate-300">Ollama Host URL:</label>
                            <input id="ollama-host" type="text" placeholder="e.g., http://localhost:11434" value={apiConfig.ollamaHost || ''} onChange={(e) => setApiConfig(prev => ({ ...prev, ollamaHost: e.target.value }))} className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" />
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
            
            {/* Organoid Section */}
            <div className="flex-shrink-0 flex justify-between items-center mt-4">
                <h2 className="text-2xl font-bold text-emerald-300 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]">Your Virtual Twin</h2>
                 <button onClick={resetOrganoids} className="bg-red-800/50 text-red-300 border border-red-700 rounded-md px-3 py-1.5 text-xs hover:bg-red-700/50 font-semibold">Reset All</button>
            </div>
            <p className="text-sm text-slate-400 -mt-3">A Parallel Theory Sandbox</p>
            <div className="grid grid-cols-2 gap-4 flex-shrink-0">
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
            <div className="flex-shrink-0 bg-black/20 rounded-lg flex flex-col overflow-hidden border border-slate-800 mt-4">
                <div className="flex-shrink-0 border-b border-slate-700">
                    <nav className="flex">
                        {THEORY_KEYS.map(key => (
                            <button key={key} onClick={() => setSelectedStatTab(key)} className={\`flex-1 py-2 px-4 text-xs font-semibold transition-colors capitalize \${selectedStatTab === key ? 'text-white bg-slate-700/50 border-b-2 border-cyan-400' : 'text-slate-400 border-b-2 border-transparent hover:bg-slate-800/50'}\`}>
                                {THEORIES[key].name}
                            </button>
                        ))}
                    </nav>
                </div>
                <div className="overflow-y-auto p-3">
                    <div className="grid grid-cols-2 gap-2">
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
        
        {/* Center Column: Discovery Map */}
        <div className="flex-1 h-full flex flex-col p-4 gap-4 border-r border-slate-700/50">
            <h2 className="text-2xl font-bold text-purple-300 drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]">Live Discovery Map</h2>
            <p className="text-sm text-slate-400 -mt-3">Your personal view of the research landscape.</p>
            <div className="flex-grow w-full bg-black/40 rounded-lg border border-slate-700 relative overflow-hidden" style={{ minHeight: '400px', backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '20px 20px'}}>
                {isMapLoading && (
                     <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-20 flex items-center justify-center">
                        <LoadingIndicator message="Generating semantic map..." />
                    </div>
                )}
                {!isMapLoading && isSwarmRunning && mapData.length === 0 && <LoadingIndicator message={progressInfo.message || 'Waiting for first sources to appear...'} />}
                {!isMapLoading && !isSwarmRunning && mapData.length === 0 && (
                    <div className="flex items-center justify-center h-full text-slate-500 text-center p-4">
                        The semantic map will be generated here once research begins.
                    </div>
                )}
                {mapData.map(({ source, x, y }, i) => (
                    <div key={i} className="absolute w-2.5 h-2.5 bg-cyan-400 rounded-full -translate-x-1/2 -translate-y-1/2 transition-all duration-300 hover:scale-150 group" style={{ left: \`\${(x/500)*100}%\`, top: \`\${(y/500)*100}%\` }}>
                         <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-slate-800 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 border border-slate-600 shadow-lg">
                            {source.title}
                        </div>
                    </div>
                ))}
                {vacancies.map((v, i) => {
                    const isPersonalized = personalizedVacancyIds.has(v.id);
                    return (
                        <button 
                            key={v.id} 
                            onClick={() => handleInterpretVacancy(v)}
                            disabled={isInterpreting}
                            className={\`absolute rounded-full transition-all duration-300 -translate-x-1/2 -translate-y-1/2 z-10 \${isPersonalized 
                                ? 'bg-yellow-500/30 border-2 border-dashed border-yellow-300 animate-pulse hover:animate-none hover:bg-yellow-500/40' 
                                : 'bg-purple-500/20 border-2 border-dashed border-purple-400 hover:bg-purple-500/40'} 
                                cursor-pointer disabled:cursor-wait disabled:bg-purple-900/50\`} 
                            style={{ left: \`\${(v.x/500)*100}%\`, top: \`\${(v.y/500)*100}%\`, width: \`\${v.radius}px\`, height: \`\${v.radius}px\` }}
                            title={isPersonalized ? "This is a high-potential research area for you! Click to interpret." : "Click to interpret this research vacancy"}
                        />
                    );
                })}
                {userCoordinates && (
                     <div className="absolute w-5 h-5 bg-yellow-300 rounded-full flex items-center justify-center -translate-x-1/2 -translate-y-1/2 border-2 border-white shadow-lg animate-pulse" style={{ left: \`\${(userCoordinates.x/500)*100}%\`, top: \`\${(userCoordinates.y/500)*100}%\`, zIndex: 30}} title="This is you on the map, based on your profile.">
                        <span className="text-[10px] font-bold text-black">You</span>
                    </div>
                )}
                {isInterpreting && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-20 flex items-center justify-center">
                        <LoadingIndicator message="Generating hypothesis..." />
                    </div>
                )}
            </div>
        </div>

        {/* Right Column: Live Feed */}
        <div className="w-[34rem] h-full flex flex-col p-4 gap-4 flex-shrink-0">
             <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.5)]">Live Results Feed</h2>
                 {isRescoring && <div className="flex items-center gap-2 text-xs text-cyan-300"><svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Re-scoring...</div>}
             </div>
            <p className="text-sm text-slate-400 -mt-3">All sources, synergies, and proposals stream here.</p>
            <div className="flex-grow bg-black/20 rounded-lg overflow-y-auto p-3 space-y-3 border border-slate-800">
                {isSwarmRunning && liveFeed.length === 0 && <LoadingIndicator message={progressInfo.message} />}
                {!isSwarmRunning && liveFeed.length === 0 && <p className="text-slate-500 p-4 text-center">Agent is idle. Define an objective and begin research.</p>}
                
                {liveFeed.map(item => {
                    switch (item.type) {
                        case 'source':
                            return <SourceCard key={item.id} source={item.data} />;
                        case 'synergy':
                            const synergyKey = item.data.combination.map(c => c.name).sort().join(' + ');
                            const isGenerating = generatingDossiers.has(synergyKey);
                            return <SynergyCard 
                                key={item.id} 
                                synergy={item.data} 
                                actions={(
                                    <button
                                        onClick={() => handleGenerateDossier(item.data)}
                                        disabled={isSwarmRunning || isGenerating}
                                        title={isSwarmRunning ? "Cannot generate dossier while a research task is running." : isGenerating ? "This dossier is already being generated." : "Generate a full, investment-ready dossier for this proposal."}
                                        className="font-bold py-1.5 px-3 rounded-lg self-start transition-colors bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 disabled:cursor-not-allowed"
                                    >
                                        {isGenerating ? 'Generating...' : 'Generate Full Dossier'}
                                    </button>
                                )}
                                applySynergy={applySynergy}
                                anyOrganoidAlive={anyOrganoidAlive}
                             />;
                        case 'dossier':
                             return <DossierCard key={item.id} dossier={item.data} synergy={item.data.synergyData || {}} />;
                        case 'interpretation':
                            return <InterpretationCard key={item.id} interpretation={item.data} />;
                        default:
                            return null;
                    }
                })}
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
    ...DISCOVERY_TOOLS,
    ...PERSONALIZATION_TOOLS,
];