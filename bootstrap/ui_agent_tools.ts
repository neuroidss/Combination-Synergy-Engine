
import type { ToolCreatorPayload } from '../types';

export const SYNERGY_FORGE_TOOLS: ToolCreatorPayload[] = [{
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
        { name: 'eventLog', type: 'array', description: 'The global application event log.', required: true },
        { name: 'availableModels', type: 'array', description: 'An array of available AI models for selection.', required: true },
        { name: 'selectedModel', type: 'object', description: 'The currently selected AI model object.', required: true },
        { name: 'setSelectedModel', type: 'object', description: 'A function to update the selected AI model.', required: true },
        { name: 'apiConfig', type: 'object', description: 'The current API configuration object.', required: true },
        { name: 'setApiConfig', type: 'object', description: 'A function to update the API configuration.', required: true },
    ],
    implementationCode: `
// --- THEORIES OF AGING CONFIGURATION ---
const THEORIES = {
    stochastic: { name: 'Stochastic Damage', description: 'Aging is the result of accumulating random damage to cells.', stats: ['dnaDamage', 'mitoEfficiency', 'proteostasisQuality', 'oxidativeStress', 'extracellularWaste', 'networkActivity', 'synapticDensity', 'senescentCellBurden'] },
    hyperfunction: { name: 'Programmed Hyperfunction', description: 'Aging is a continuation of a developmental program that becomes harmful.', stats: ['developmentalSignalStrength', 'cellularHypertrophy', 'mitoEfficiency', 'oxidativeStress', 'proteostasisQuality', 'inflammationLevel', 'synapticDensity', 'networkActivity'] },
    information: { name: 'Information Entropy', description: 'Aging is the loss of epigenetic information and cellular identity.', stats: ['epigeneticNoise', 'misexpressionChance', 'proteostasisQuality', 'mitoEfficiency', 'dnaDamage', 'networkActivity', 'senescentCellBurden', 'synapticDensity'] },
    social: { name: 'Cellular Society Collapse', description: 'Aging is caused by "bad actor" cells disrupting tissue function.', stats: ['senescentCellBurden', 'inflammationLevel', 'stemCellPool', 'microgliaState', 'extracellularWaste', 'synapticDensity', 'networkActivity', 'dnaDamage'] },
};
const THEORY_KEYS = Object.keys(THEORIES);

// --- ORGANOID STATE & SIMULATION ---
const getInitialOrganoidState = () => ({
    // Foundational stats
    age: 0,
    lifespan: 120,
    overallHealth: 100,
    totalCellCount: 1000000,
    // Theory 1: Stochastic Damage
    dnaDamage: 0,
    mitoEfficiency: 100,
    proteostasisQuality: 100,
    oxidativeStress: 0,
    extracellularWaste: 0,
    // Theory 2: Programmed Hyperfunction
    developmentalSignalStrength: 5,
    cellularHypertrophy: 0,
    // Theory 3: Information Entropy
    epigeneticNoise: 0,
    misexpressionChance: 0,
    // Theory 4: Cellular Society
    senescentCellBurden: 0,
    inflammationLevel: 0,
    stemCellPool: 100,
    microgliaState: 0, // 0 for surveilling, 1 for reactive
    // Shared functional params
    synapticDensity: 100,
    networkActivity: 100,
});

const getInitialStates = () => ({
    stochastic: getInitialOrganoidState(),
    hyperfunction: getInitialOrganoidState(),
    information: getInitialOrganoidState(),
    social: getInitialOrganoidState(),
});

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
// FIX: Renamed 'prompt' to 'taskPrompt' to avoid conflict with the window.prompt function.
const [taskPrompt, setTaskPrompt] = React.useState('Discover a broad range of longevity interventions (e.g., drugs, supplements, lifestyle changes) and analyze them to find both known and novel synergistic combinations.');
const [currentTab, setCurrentTab] = React.useState('sources');
const [agentStatus, setAgentStatus] = React.useState('Agent is idle.');

const resetOrganoids = React.useCallback(() => {
    setOrganoids(getInitialStates());
    setAgentStatus('Organoids reset. New parallel simulation started.');
    runtime.logEvent('[Organoid] Parallel simulation reset.');
}, [runtime]);

// --- AGING MODELS PER THEORY ---
const runStochasticAging = (prev, effects) => {
    const newAge = prev.age + 1;
    const ageFactor = 1 + (newAge / 300);
    let dnaDamageIncrease = (0.05 * ageFactor) / effects.dnaRepairRate;
    const mitoDecline = 0.06 * ageFactor;
    const newMitoEfficiency = Math.max(0, prev.mitoEfficiency - mitoDecline);
    let oxStressIncrease = (0.1 * ageFactor) + ((100 - newMitoEfficiency) / 100 * 0.2);
    const proteostasisDecline = 0.05 * ageFactor;
    const newProteostasisQuality = Math.max(0, prev.proteostasisQuality - proteostasisDecline);
    const wasteIncrease = (100 - newProteostasisQuality) / 100 * 0.2;
    dnaDamageIncrease += (prev.oxidativeStress / 100) * 0.15;
    let senescentIncrease = prev.dnaDamage > (80 - (newAge / 10)) ? 0.1 * ageFactor : 0;
    
    const health = (
        ((100 - Math.min(100, prev.dnaDamage + dnaDamageIncrease)) * 0.3) +
        (newMitoEfficiency * 0.2) +
        (newProteostasisQuality * 0.2) +
        ((100 - prev.senescentCellBurden) * 0.1) +
        ((100 - prev.inflammationLevel) * 0.1) +
        ((100 - prev.oxidativeStress) * 0.1)
    );
    return {...prev, age:newAge, overallHealth: health, dnaDamage: Math.min(100, prev.dnaDamage + dnaDamageIncrease), mitoEfficiency: newMitoEfficiency, proteostasisQuality: newProteostasisQuality, oxidativeStress: Math.min(100, prev.oxidativeStress + oxStressIncrease / effects.antioxidantCapacity), extracellularWaste: Math.min(100, (prev.extracellularWaste + wasteIncrease) / effects.autophagyBoost), senescentCellBurden: Math.min(100, prev.senescentCellBurden + senescentIncrease) };
};

const runHyperfunctionAging = (prev, effects) => {
    const newAge = prev.age + 1;
    const ageFactor = 1 + (newAge / 400);
    const newSignalStrength = Math.min(100, (prev.developmentalSignalStrength + (0.1 * ageFactor)) / effects.signalInhibition);
    const newHypertrophy = Math.min(100, prev.cellularHypertrophy + (newSignalStrength / 100 * 0.3));
    const newMitoEfficiency = Math.max(0, prev.mitoEfficiency - (newHypertrophy / 100 * 0.1));
    const newOxStress = Math.min(100, prev.oxidativeStress + (newHypertrophy / 100 * 0.2));
    
    const health = (
        ((100 - newSignalStrength) * 0.4) +
        ((100 - newHypertrophy) * 0.3) +
        (newMitoEfficiency * 0.15) +
        ((100 - newOxStress) * 0.15)
    );
    return {...prev, age:newAge, overallHealth: health, developmentalSignalStrength: newSignalStrength, cellularHypertrophy: newHypertrophy, mitoEfficiency: newMitoEfficiency, oxidativeStress: newOxStress};
};

const runInformationAging = (prev, effects) => {
    const newAge = prev.age + 1;
    const ageFactor = 1 + (newAge / 350);
    const newEpigeneticNoise = Math.min(100, (prev.epigeneticNoise + (0.08 * ageFactor)) / effects.epigeneticStabilization);
    const newMisexpressionChance = Math.min(100, prev.misexpressionChance + (newEpigeneticNoise / 100 * 0.2));
    const newProteostasisQuality = Math.max(0, prev.proteostasisQuality - (newMisexpressionChance / 100 * 0.05));
    const newMitoEfficiency = Math.max(0, prev.mitoEfficiency - (newMisexpressionChance / 100 * 0.05));

    const health = (
        ((100 - newEpigeneticNoise) * 0.5) +
        ((100 - newMisexpressionChance) * 0.2) +
        (newProteostasisQuality * 0.15) +
        (newMitoEfficiency * 0.15)
    );
    return {...prev, age:newAge, overallHealth: health, epigeneticNoise: newEpigeneticNoise, misexpressionChance: newMisexpressionChance, proteostasisQuality: newProteostasisQuality, mitoEfficiency: newMitoEfficiency };
};

const runSocialAging = (prev, effects) => {
    const newAge = prev.age + 1;
    const ageFactor = 1 + (newAge / 250);
    const newSenescentBurden = Math.min(100, prev.senescentCellBurden + (0.15 * ageFactor));
    const newInflammation = Math.min(100, prev.inflammationLevel + (newSenescentBurden / 100 * 0.4));
    const newStemCellPool = Math.max(0, prev.stemCellPool - (newInflammation / 100 * 0.2));
    const newMicrogliaState = newInflammation > 50 ? 1 : 0;
    const newDnaDamage = Math.min(100, prev.dnaDamage + (newInflammation/100 * 0.1));

    const health = (
        ((100 - newSenescentBurden) * 0.4) +
        ((100 - newInflammation) * 0.3) +
        (newStemCellPool * 0.2) +
        ((100-newDnaDamage) * 0.1)
    );
    return {...prev, age:newAge, overallHealth: health, senescentCellBurden: newSenescentBurden, inflammationLevel: newInflammation, stemCellPool: newStemCellPool, microgliaState: newMicrogliaState, dnaDamage: newDnaDamage };
};

const AGING_FUNCTIONS = {
    stochastic: runStochasticAging,
    hyperfunction: runHyperfunctionAging,
    information: runInformationAging,
    social: runSocialAging,
};

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

            if (allDead && agentStatus !== 'All organoids have perished.') {
                 setAgentStatus('All organoids have perished.');
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
}, [agentStatus]);

React.useEffect(() => {
    if (!isSwarmRunning && lastSwarmRunHistory) {
        const history = lastSwarmRunHistory;

        const enrichAndValidateStep = history.find(h => h.tool?.name === 'Enrich and Validate Sources' && h.executionResult?.success);
        const sources = enrichAndValidateStep ? (enrichAndValidateStep.executionResult.validatedSources || []) : [];

        const synergiesData = history.filter(h => h.tool?.name === 'RecordSynergy' && h.executionResult?.synergy).map(h => h.executionResult.synergy);
        const gameParamsMap = new Map();
        history.filter(h => h.tool?.name === 'RecordSynergyGameParameters' && h.executionResult?.synergyCombination).forEach(h => {
            const key = h.executionResult.synergyCombination.join(' + ');
            gameParamsMap.set(key, h.executionResult.gameParameters);
        });
        const finalSynergies = synergiesData.map(syn => ({ ...syn, gameParameters: gameParamsMap.get(syn.combination.join(' + ')) || null }));
        const finalDossiers = history.filter(h => h.tool?.name === 'RecordTrialDossier').map(h => h.executionResult.dossier);

        // Since the start handlers clear state, we just populate the new results here.
        setResearchHistory(sources);
        setSynergies(finalSynergies);
        setDossiers(finalDossiers);

        // Switch to the most relevant tab to show the user what was generated.
        if (finalDossiers.length > 0) {
            setCurrentTab('proposals');
        } else if (finalSynergies.length > 0) {
            setCurrentTab('synergies');
        } else if (sources.length > 0) {
            setCurrentTab('sources');
        }
    }
}, [isSwarmRunning, lastSwarmRunHistory]);

const anyOrganoidAlive = React.useMemo(() => Object.values(organoids).some(o => o.overallHealth > 0), [organoids]);

React.useEffect(() => {
    if (!anyOrganoidAlive) { setAgentStatus('All organoids have perished.'); return; }
    if (isSwarmRunning && eventLog && eventLog.length > 0) {
        const lastLog = eventLog[eventLog.length - 1] || '';
        let status = 'Agent is working...';
        if (lastLog.includes('Generating investment dossiers')) status = 'Stage 6: Generating investment dossiers...';
        else if (lastLog.includes('Verifying sources') || lastLog.includes('Enrichment complete')) status = 'Stage 2: Verifying sources...';
        else if (lastLog.includes('Recording synergy:')) status = 'Stage 3: Identifying synergies...';
        else if (lastLog.includes('Recording parameters for:')) status = 'Stage 4: Generating game parameters...';
        else if (lastLog.includes('Starting federated search')) status = 'Stage 1: Searching for articles...';
        setAgentStatus(status);
    } else if (!isSwarmRunning) {
        if (researchHistory.length > 0 || synergies.length > 0) setAgentStatus('Research complete. Ready for new objective.');
        else setAgentStatus('Agent is idle.');
    }
}, [eventLog, isSwarmRunning, researchHistory, synergies, anyOrganoidAlive]);

const handleStart = () => {
    if (taskPrompt.trim()) {
        setResearchHistory([]);
        setSynergies([]);
        setDossiers([]);
        startSwarmTask({ task: taskPrompt, systemPrompt: null, allTools: runtime.tools.list() });
    }
};

const handleStartProposalGeneration = () => {
    const proposalTaskPrompt = 'Perform a full end-to-end analysis. First, discover and validate a broad range of longevity interventions from scientific literature. Second, analyze the validated findings to identify both known and novel synergistic combinations. Finally, based on this comprehensive research, identify the top 2-3 most promising combinations and generate a thorough "Trial-Ready Combination Dossier" for each by calling the appropriate tool. The entire process should be autonomous.';
    setResearchHistory([]);
    setSynergies([]);
    setDossiers([]);
    startSwarmTask({ task: proposalTaskPrompt, systemPrompt: null, allTools: runtime.tools.list() });
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

const OrganoidStat = ({label, value, unit, inverted = false}) => {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) {
         return (
            <div className="text-center bg-black/30 p-2 rounded-lg border border-slate-700">
                <div className="text-xs text-cyan-300 uppercase tracking-wider whitespace-nowrap">{label}</div>
                <div className='text-lg font-bold text-slate-200 capitalize'>{value}</div>
            </div>
        );
    }

    let colorClass;
    if (!inverted) { // Higher is better
        if (numericValue < 40) colorClass = 'text-red-400';
        else if (numericValue < 70) colorClass = 'text-yellow-400';
        else colorClass = 'text-emerald-400';
    } else { // Lower is better
        if (numericValue > 60) colorClass = 'text-red-400';
        else if (numericValue > 30) colorClass = 'text-yellow-400';
        else colorClass = 'text-emerald-400';
    }

    return (
        <div className="text-center bg-black/30 p-2 rounded-lg border border-slate-700">
            <div className="text-xs text-cyan-300 uppercase tracking-wider whitespace-nowrap">{label}</div>
            <div className={\`text-lg font-bold \${colorClass}\`}>{value} <span className="text-sm font-normal text-slate-400">{unit}</span></div>
        </div>
    );
};

const MiniOrganoid = ({ theoryKey, organoid }) => {
    const theory = THEORIES[theoryKey];
    return (
        <div className="bg-black/20 p-3 rounded-lg border border-slate-800 flex flex-col items-center gap-2">
            <h3 className="text-sm font-bold text-cyan-300">{theory.name}</h3>
            <div className="w-24 h-24 rounded-full flex items-center justify-center bg-slate-900/50 relative shadow-md">
                <div className="w-full h-full rounded-full border-2 border-emerald-500/30 shadow-[inset_0_0_10px_rgba(74,222,128,0.5)]" style={{ opacity: organoid.overallHealth <= 0 ? 0.3 : 1 }}>
                    <div className="w-full h-full rounded-full flex items-center justify-center bg-emerald-900/40 backdrop-blur-sm">
                         <p className="text-2xl font-mono text-emerald-200/90 drop-shadow-[0_0_5px_rgba(110,231,183,0.8)]">
                            {organoid.overallHealth > 0 ? \`\${organoid.overallHealth.toFixed(0)}%\` : 'DEAD'}
                         </p>
                    </div>
                </div>
            </div>
            <div className="text-xs text-slate-400">Age: {organoid.age} days</div>
        </div>
    );
};

const AgingClock = ({ name, biologicalAge, chronologicalAge }) => {
    const ageDifference = biologicalAge - chronologicalAge;
    let colorClass = 'text-yellow-300';
    let differenceText = \`~\${ageDifference.toFixed(1)} days\`;

    if (ageDifference < -1) {
        colorClass = 'text-emerald-300';
        differenceText = \`-\${Math.abs(ageDifference).toFixed(1)} days\`;
    } else if (ageDifference > 1) {
        colorClass = 'text-red-300';
        differenceText = \`+\${ageDifference.toFixed(1)} days\`;
    }

    return (
        <div className="bg-black/40 p-3 rounded-lg border border-slate-700 flex flex-col items-center justify-center text-center">
            <div className="text-xs uppercase tracking-wider text-cyan-400 mb-1">{name}</div>
            <div className="text-2xl font-bold text-slate-100">{biologicalAge.toFixed(1)}</div>
            <div className="text-xs text-slate-400">Bio Age (days)</div>
            <div className={\`mt-2 text-sm font-semibold \${colorClass}\`}>{differenceText}</div>
            <div className="text-xs text-slate-500">vs Chrono Age ({chronologicalAge})</div>
        </div>
    );
};

const SourceCard = ({source}) => (
    <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700 transition-colors hover:border-cyan-500/80 hover:bg-slate-800">
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline font-semibold block truncate">{source.title}</a>
        <p className="text-xs text-slate-500 mt-1">Reliability: {(source.reliabilityScore * 100).toFixed(0)}% - {source.justification}</p>
        <p className="text-sm text-slate-300 mt-2">{source.summary}</p>
    </div>
);

const SynergyCard = ({synergy}) => {
    const isHypothesized = synergy.status === 'Hypothesized';
    return (
        <div className={\`bg-slate-800/60 p-3 rounded-lg border border-slate-700 flex flex-col transition-colors \${isHypothesized ? 'hover:border-purple-500/80' : 'hover:border-emerald-500/80'} hover:bg-slate-800\`}>
            <div className="flex justify-between items-start mb-1">
                <h4 className={\`text-lg font-bold \${isHypothesized ? 'text-purple-400' : 'text-emerald-400'}\`}>{synergy.combination.join(' + ')}</h4>
                <span className={\`text-xs font-bold px-2 py-0.5 rounded-full \${isHypothesized ? 'bg-purple-900/70 text-purple-300' : 'bg-emerald-900/70 text-emerald-300'}\`}>{synergy.status || 'Known'}</span>
            </div>
            <p className="text-sm font-semibold text-slate-400 mb-2">{synergy.synergyType}</p>
            <p className="text-sm text-slate-300 flex-grow">{synergy.summary}</p>
            <button onClick={() => applySynergy(synergy)} disabled={!anyOrganoidAlive || !synergy.gameParameters} className={\`mt-4 font-bold py-1.5 px-3 rounded-lg self-start transition-colors \${isHypothesized ? 'bg-purple-600 hover:bg-purple-500' : 'bg-emerald-600 hover:bg-emerald-500'} disabled:bg-slate-600 disabled:cursor-not-allowed\`}>
                {synergy.gameParameters ? 'Apply to Organoids' : 'No Parameters'}
            </button>
        </div>
    );
};

const DossierCard = ({ dossier }) => (
    <div className="bg-slate-800/70 p-4 rounded-lg border border-amber-400/30 flex flex-col gap-4">
        <div className="border-b border-amber-400/20 pb-2">
            <h3 className="text-xl font-bold text-amber-300 drop-shadow-[0_0_4px_rgba(252,211,77,0.5)]">{dossier.combination.join(' + ')}</h3>
            <p className="text-sm text-slate-400">{dossier.executiveSummary}</p>
        </div>
        <div>
            <h4 className="font-semibold text-cyan-300 mb-1">Scientific Rationale</h4>
            <p className="text-sm text-slate-300">{dossier.scientificRationale}</p>
        </div>
        <div className="bg-black/30 p-3 rounded-md border border-slate-700">
            <h4 className="font-semibold text-emerald-300 mb-1">In Silico Validation (SynergyForge)</h4>
            <p className="text-sm text-slate-300 font-mono">{dossier.inSilicoValidation}</p>
        </div>
        <div>
            <h4 className="font-semibold text-cyan-300 mb-1">Market & IP Opportunity</h4>
            <p className="text-sm text-slate-300">{dossier.marketAndIP}</p>
        </div>
        <div>
            <h4 className="font-semibold text-cyan-300 mb-1">Proposed Roadmap</h4>
            <p className="text-sm text-slate-300">{dossier.roadmap}</p>
        </div>
        <div>
            <h4 className="font-semibold text-yellow-300 mb-1">Risk Analysis</h4>
            <p className="text-sm text-slate-300">{dossier.risks}</p>
        </div>
    </div>
);


const LoadingIndicator = () => (
    <div className="flex items-center gap-2 text-slate-400 p-4">
        <svg className="animate-spin h-5 w-5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <span>{agentStatus}</span>
    </div>
);

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
                <div className="mt-2 flex gap-2">
                     <button onClick={handleStart} disabled={isSwarmRunning || !taskPrompt.trim()} className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-2 px-4 rounded-lg disabled:from-slate-700 disabled:to-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed transition-all">
                        {isSwarmRunning ? 'Working...' : 'Begin Research'}
                    </button>
                    <button onClick={handleStartProposalGeneration} disabled={isSwarmRunning} className="flex-1 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-bold py-2 px-4 rounded-lg disabled:from-slate-700 disabled:to-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed transition-all">
                        Generate Proposals
                    </button>
                </div>
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
                    {isSwarmRunning && <LoadingIndicator />}
                    {currentTab === 'sources' && !isSwarmRunning && researchHistory.map((src, i) => <SourceCard key={i} source={src} />)}
                    {currentTab === 'synergies' && !isSwarmRunning && synergies.map((syn, i) => <SynergyCard key={i} synergy={syn} />)}
                    {currentTab === 'proposals' && !isSwarmRunning && dossiers.map((dos, i) => <DossierCard key={i} dossier={dos} />)}
                    
                    {!isSwarmRunning && (
                        (currentTab === 'sources' && researchHistory.length === 0) || 
                        (currentTab === 'synergies' && synergies.length === 0) ||
                        (currentTab === 'proposals' && dossiers.length === 0)
                     ) && <p className="text-slate-500 p-4 text-center">{agentStatus}</p>}
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
