
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
        { name: 'availableModels', type: 'array', description: 'Array of available AI models.', required: true },
        { name: 'selectedModel', type: 'object', description: 'The currently selected AI model.', required: true },
        { name: 'setSelectedModel', type: 'object', description: 'Function to update the selected model.', required: true },
        { name: 'apiConfig', type: 'object', description: 'The API configuration.', required: true },
        { name: 'setApiConfig', type: 'object', description: 'Function to update the API configuration.', required: true },
        { name: 'taskPrompt', type: 'string', description: 'The research objective prompt.', required: true },
        { name: 'setTaskPrompt', type: 'object', description: 'Function to update the prompt.', required: true },
    ],
    implementationCode: `

const { DossierCard, SynergyCard, HypothesisCard, SourceCard, CardComponent } = React.useMemo(() => {
    const InterventionTypeIcon = ({ type }) => {
        const typeMap = {
            drug: { icon: '💊', color: 'bg-sky-500/20 text-sky-300', label: 'Drug (e.g., molecule, wetware)' },
            device: { icon: '⚙️', color: 'bg-amber-500/20 text-amber-300', label: 'Device (e.g., hardware, nanorobot)' },
            behavior: { icon: '🧠', color: 'bg-emerald-500/20 text-emerald-300', label: 'Behavior (e.g., algorithm, lifestyle)' },
        };
        const info = typeMap[type?.toLowerCase()] || { icon: '❓', color: 'bg-slate-500/20 text-slate-300', label: 'Unknown' };

        return (
            <span className={\`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-mono font-bold \${info.color}\`} title={info.label}>
                {info.icon}
            </span>
        );
    };

    const SourceCard = ({source}) => (
        <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700 transition-colors hover:border-cyan-500/80 hover:bg-slate-800 flex flex-col">
            <button onClick={() => window.open(source.url || source.uri, '_blank', 'noopener,noreferrer')} className="text-cyan-400 hover:underline font-semibold block truncate text-left w-full">{source.title}</button>
            <p className="text-xs text-slate-500 mt-1">Reliability: {((source.reliabilityScore || 0) * 100).toFixed(0)}% - {source.justification}</p>
            <p className="text-sm text-slate-300 mt-2 flex-grow">{source.summary}</p>
        </div>
    );

    const OrganImpactDisplay = ({ impacts, justification }) => {
        if (!impacts || Object.keys(impacts).length === 0) return null;
        
        const impactMeta = {
            'High Positive': { color: 'text-emerald-300', symbol: '↑↑↑' },
            'Moderate Positive': { color: 'text-emerald-400', symbol: '↑↑' },
            'Low Positive': { color: 'text-emerald-500', symbol: '↑' },
            'Negligible': { color: 'text-slate-500', symbol: '—' },
            'Low Negative': { color: 'text-yellow-500', symbol: '↓' },
            'Moderate Negative': { color: 'text-orange-400', symbol: '↓↓' },
            'High Negative': { color: 'text-red-400', symbol: '↓↓↓' },
        };

        const relevantImpacts = Object.entries(impacts)
            .filter(([key, value]) => key.endsWith('_impact') && value !== 'Negligible')
            .map(([key, value]) => ({
                organ: key.replace('_impact', ''),
                impact: value,
            }));
            
        if (relevantImpacts.length === 0) return null;
        
        return (
            <div className="mt-auto pt-3 border-t border-slate-700/50 group relative">
                <h5 className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-2">Organ Signature Impact</h5>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {relevantImpacts.map(({organ, impact}) => (
                        <div key={organ} className="flex items-center gap-1">
                            <span className="text-sm capitalize">{organ}</span>
                            <span className={\`font-mono font-bold \${impactMeta[impact]?.color || 'text-slate-200'}\`}>
                                {impactMeta[impact]?.symbol || '?'}
                            </span>
                        </div>
                    ))}
                </div>
                {justification && (
                     <div className="absolute bottom-full mb-2 w-72 bg-slate-800 text-white text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 border border-slate-600 shadow-lg">
                        <h6 className="font-bold text-cyan-300 mb-1">Justification</h6>
                        {justification}
                    </div>
                )}
            </div>
        );
    };

    const SynergyCard = ({ synergy }) => {
        const score = synergy.trialPriorityScore || 0;
        const scoreColor = score > 80 ? 'text-emerald-300' : score > 60 ? 'text-yellow-300' : 'text-red-300';

        return (
            <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700 flex flex-col gap-3 transition-all hover:border-purple-500/80 hover:bg-slate-800">
                <div className="flex justify-between items-start gap-2">
                    <h4 className="text-base font-bold text-purple-300 flex-grow">
                        {synergy.combination.map((c, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && <span className="text-slate-400 font-light"> + </span>}
                                <span>{c.name}</span>
                            </React.Fragment>
                        ))}
                    </h4>
                    <div className="flex-shrink-0 text-right">
                        <div className={\`text-3xl font-bold \${scoreColor} drop-shadow-[0_0_4px_rgba(255,255,255,0.15)]\`}>{score}</div>
                        <div className="text-xs uppercase tracking-wider text-slate-400 -mt-1">Score</div>
                    </div>
                </div>

                <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                    {synergy.combination.map((c, i) => (
                        <div key={i} className="flex items-center gap-1.5 bg-slate-900/50 rounded-full px-2 py-0.5 text-sm">
                            <InterventionTypeIcon type={c.type} />
                            <span className="truncate">{c.name}</span>
                        </div>
                    ))}
                </div>
                
                <p className="text-sm text-slate-300 flex-grow">{synergy.summary}</p>
                
                <div className="text-xs text-slate-400">
                    Found in: <em className="truncate">{synergy.sourceTitle || 'De Novo Hypothesis'}</em>
                </div>

                <div className="bg-black/30 p-2 rounded-md border border-slate-700 flex justify-between items-center text-xs">
                     <div>
                        <div className="uppercase tracking-wider text-slate-400">Est. In Vitro Cost</div>
                        <div className="text-lg font-bold text-emerald-400">\${(synergy.estimatedCost || 0).toLocaleString()}</div>
                     </div>
                     <div>
                        <div className="uppercase tracking-wider text-slate-400 text-right">MoA Complementarity</div>
                        <div className="text-lg font-bold text-cyan-400 text-right">{synergy.moaComplementarityScore || 0}%</div>
                     </div>
                </div>

                <OrganImpactDisplay impacts={synergy.organImpacts} justification={synergy.organImpacts?.justification} />
            </div>
        );
    };

    const HypothesisCard = ({ hypothesis }) => (
        <div className="bg-slate-800/60 p-3 rounded-lg border-2 border-dashed border-purple-500/80 flex flex-col gap-3">
            <div>
                <h4 className="text-base font-bold text-purple-300 mb-1">Hypothetical Research Abstract</h4>
                <p className="text-sm text-slate-200 whitespace-pre-wrap">{hypothesis.hypotheticalAbstract}</p>
            </div>
            
            {hypothesis.proposedCombination && (
                <div className="mt-2">
                    <h5 className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-1">Proposed Combination</h5>
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                        {hypothesis.proposedCombination.map((c, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && <span className="text-slate-400 text-base font-light">+</span>}
                                <div className="flex items-center gap-1.5 bg-slate-900/50 rounded-full px-2 py-0.5">
                                    <InterventionTypeIcon type={c.type} />
                                    <span className="truncate">{c.name}</span>
                                </div>
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            )}
            {hypothesis.coreMechanism && (
                <div className="mt-2">
                    <h5 className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-1">Core Mechanism</h5>
                    <p className="text-sm text-slate-300">{hypothesis.coreMechanism}</p>
                </div>
            )}

            <details className="bg-black/30 p-3 rounded-lg border border-slate-700 group mt-auto">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
                     <div>
                        <div className="text-xs uppercase tracking-wider text-slate-400">Est. In Vitro Cost</div>
                        <div className="text-2xl font-bold text-emerald-400">\${(hypothesis.estimatedCost || 0).toLocaleString()}</div>
                     </div>
                     <div className="text-right">
                        <div className="text-xs uppercase tracking-wider text-slate-400">Required Assays</div>
                        <p className="text-xs text-slate-300 max-w-xs truncate" title={(hypothesis.requiredAssays || []).join(', ')}>{(hypothesis.requiredAssays || []).join(', ')}</p>
                     </div>
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div className="mt-3 pt-3 border-t border-slate-600 text-xs">
                    {hypothesis.experimentPlan && (
                        <div className="mb-3">
                            <h5 className="font-bold text-cyan-300 mb-1">Experiment Plan</h5>
                            <p className="text-slate-300"><strong>Cell Model:</strong> {hypothesis.experimentPlan.cell_model}</p>
                            <p className="text-slate-300"><strong>Interventions:</strong> {(hypothesis.experimentPlan.interventions || []).join(', ')}</p>
                            <p className="text-slate-300"><strong>Justification:</strong> {hypothesis.experimentPlan.justification}</p>
                        </div>
                    )}
                     {hypothesis.costBreakdown && (
                        <div>
                            <h5 className="font-bold text-cyan-300 mb-1">Cost Breakdown</h5>
                            <ul className="text-slate-400 list-disc list-inside">
                                {hypothesis.costBreakdown.map((item, i) => <li key={i}>{item.item}: \${item.cost.toLocaleString()}</li>)}
                                <li>Overhead & Consumables (x1.5)</li>
                            </ul>
                        </div>
                    )}
                </div>
            </details>
            
            <OrganImpactDisplay impacts={hypothesis.organImpacts} justification={hypothesis.organImpacts?.justification} />
            <details className="text-xs">
                <summary className="cursor-pointer text-cyan-500 hover:underline">Show Inspiring Neighbors ({hypothesis.neighbors.length})...</summary>
                <ul className="list-disc list-inside space-y-1 text-slate-400 mt-2">
                    {hypothesis.neighbors.map((n, i) => <li key={i} className="truncate">{n.title}</li>)}
                </ul>
            </details>
        </div>
    );

    const RiskRadarChart = ({ scientific = 0, commercial = 0, safety = 0 }) => {
        const size = 120;
        const center = size / 2;
        const radius = size * 0.4;
        const getPoint = (angle, score) => ({ x: center + (Math.max(0, Math.min(100, score)) / 100 * radius) * Math.cos(angle), y: center + (Math.max(0, Math.min(100, score)) / 100 * radius) * Math.sin(angle) });
        const angleSci = -Math.PI / 2, angleCom = (7 * Math.PI) / 6, angleSaf = (11 * Math.PI) / 6;
        const pSci = getPoint(angleSci, scientific), pCom = getPoint(angleCom, commercial), pSaf = getPoint(angleSaf, safety);
        const points = \`\${pSci.x},\${pSci.y} \${pCom.x},\${pCom.y} \${pSaf.x},\${pSaf.y}\`;
        const axisPoints = [getPoint(angleSci, 100), getPoint(angleCom, 100), getPoint(angleSaf, 100)];
        return (
            <svg viewBox={\`0 0 \${size} \${size}\`} className="w-28 h-28">
                <polygon points={\`\${axisPoints[0].x},\${axisPoints[0].y} \${axisPoints[1].x},\${axisPoints[1].y} \${axisPoints[2].x},\${axisPoints[2].y}\`} fill="rgba(203, 213, 225, 0.05)" />
                <line x1={center} y1={center} x2={axisPoints[0].x} y2={axisPoints[0].y} stroke="rgba(203, 213, 225, 0.2)" strokeWidth="1" />
                <line x1={center} y1={center} x2={axisPoints[1].x} y2={axisPoints[1].y} stroke="rgba(203, 213, 225, 0.2)" strokeWidth="1" />
                <line x1={center} y1={center} x2={axisPoints[2].x} y2={axisPoints[2].y} stroke="rgba(203, 213, 225, 0.2)" strokeWidth="1" />
                <polygon points={points} fill="rgba(248, 113, 113, 0.4)" stroke="rgb(248, 113, 113)" strokeWidth="1.5" />
                <text x={axisPoints[0].x} y={axisPoints[0].y - 5} fill="white" fontSize="10" textAnchor="middle">Sci</text>
                <text x={axisPoints[1].x - 8} y={axisPoints[1].y + 5} fill="white" fontSize="10" textAnchor="end">Com</text>
                <text x={axisPoints[2].x + 8} y={axisPoints[2].y + 5} fill="white" fontSize="10" textAnchor="start">Safe</text>
            </svg>
        );
    };

    const CritiqueView = ({ critique }) => (
        <div className="mt-4 bg-blue-900/40 border border-blue-700 p-3 rounded-lg">
            <h4 className="text-lg font-bold text-cyan-200 mb-2">Critical Analysis</h4>
            <div className="mb-3"><h5 className="font-semibold text-emerald-300 mb-1">Strengths</h5><p className="text-sm text-slate-300">{critique.strengths}</p></div>
            <div className="mb-3"><h5 className="font-semibold text-yellow-300 mb-1">Weaknesses & Risks</h5><p className="text-sm text-slate-300">{critique.weaknesses}</p></div>
            {critique.contradictoryEvidence?.length > 0 && (
                <div className="mb-3">
                    <h5 className="font-semibold text-red-300 mb-1">Contradictory Evidence</h5>
                    <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">{critique.contradictoryEvidence.map((ev, i) => <li key={i}>{ev}</li>)}</ul>
                </div>
            )}
            <div><h5 className="font-semibold text-cyan-300 mb-1">Overall Verdict</h5><p className="text-sm font-bold text-white">{critique.overallVerdict}</p></div>
        </div>
    );

    const DossierCard = ({ dossier }) => {
        const riskAnalysis = dossier.riskAnalysis || {};
        const overallRisk = riskAnalysis.overallRiskScore || 0;
        let riskColorClass = 'text-red-400';
        if (overallRisk < 33) riskColorClass = 'text-emerald-400';
        else if (overallRisk < 66) riskColorClass = 'text-yellow-400';

        const synergy = dossier.synergyData || {};

        return (
            <div className="bg-slate-800/70 p-4 rounded-lg border border-amber-400/30 flex flex-col gap-4 animate-fade-in">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-grow">
                         <h3 className="text-xl font-bold text-amber-300 drop-shadow-[0_0_4px_rgba(252,211,77,0.5)] flex items-center flex-wrap gap-x-2 gap-y-1">
                            {dossier.combination.map((c, i) => (
                                <React.Fragment key={i}>
                                    {i > 0 && <span className="text-slate-400 text-base font-light">+</span>}
                                    <div className="flex items-center gap-1.5 bg-slate-900/50 rounded-full px-2 py-0.5">
                                        <InterventionTypeIcon type={c.type} />
                                        <span className="truncate">{c.name}</span>
                                    </div>
                                </React.Fragment>
                            ))}
                         </h3>
                         <p className="text-sm text-slate-400 mt-1">{dossier.executiveSummary}</p>
                    </div>
                     <div className="flex-shrink-0 text-center">
                        <div className={\`text-5xl font-bold \${(synergy.trialPriorityScore||0) > 75 ? 'text-emerald-300' : (synergy.trialPriorityScore||0) > 50 ? 'text-yellow-300' : 'text-red-300'} drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]\`}>
                            {synergy.trialPriorityScore || 0}
                         </div>
                         <div className="text-xs uppercase tracking-wider text-slate-400">Opportunity Score</div>
                     </div>
                </div>
                
                 <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-black/30 p-3 rounded-md border border-slate-700">
                        <h4 className="font-semibold text-red-300 mb-2 text-center">Risk Analysis</h4>
                        <div className="flex items-center justify-around gap-2">
                            <RiskRadarChart scientific={riskAnalysis.scientificRisk} commercial={riskAnalysis.commercialRisk} safety={riskAnalysis.safetyRisk} />
                            <div className="text-center">
                                <div className={\`text-5xl font-bold \${riskColorClass}\`}>{overallRisk}</div>
                                <div className="text-xs uppercase tracking-wider text-slate-400">Overall Risk</div>
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-2 text-center">{riskAnalysis.riskSummary}</p>
                    </div>
                    <div className="bg-black/30 p-3 rounded-md border border-slate-700 flex flex-col">
                        <h4 className="font-semibold text-emerald-300 mb-2 text-center">Mitigation Plan (Risk Insurance)</h4>
                        <p className="text-sm text-slate-300 flex-grow">{dossier.mitigationPlan}</p>
                        <div className="mt-3 text-center">
                            <div className="text-xs uppercase tracking-wider text-slate-400">Est. Cost to De-Risk</div>
                            <div className="text-2xl font-bold text-emerald-400">\${(dossier.estimatedCostUSD || 0).toLocaleString()}</div>
                        </div>
                    </div>
                </div>

                <details className="text-sm mt-auto">
                    <summary className="cursor-pointer text-cyan-400 hover:underline">Show Full Rationale & Details...</summary>
                    <div className="mt-3 space-y-4 pt-3 border-t border-slate-700/50">
                        <div><h4 className="font-semibold text-cyan-300 mb-1">Scientific Rationale</h4><p className="text-sm text-slate-300">{dossier.scientificRationale}</p></div>
                        {dossier.molecularMechanism && (
                            <div className="bg-black/30 p-3 rounded-md border border-slate-700">
                                <h4 className="font-semibold text-purple-300 mb-1">Molecular Mechanism Validation (Virtual Cell)</h4>
                                <p className="text-sm text-slate-300 whitespace-pre-wrap">{dossier.molecularMechanism}</p>
                            </div>
                        )}
                        <div className="bg-black/30 p-3 rounded-md border border-slate-700"><h4 className="font-semibold text-emerald-300 mb-1">In Silico Validation (SynergyForge)</h4><p className="text-sm text-slate-300 font-mono">{dossier.inSilicoValidation}</p></div>
                        <div><h4 className="font-semibold text-cyan-300 mb-1">Market & IP Opportunity</h4><p className="text-sm text-slate-300">{dossier.marketAndIP}</p></div>
                        <div><h4 className="font-semibold text-cyan-300 mb-1">Proposed Roadmap</h4><p className="text-sm text-slate-300">{dossier.roadmap}</p></div>
                    </div>
                </details>
                
                {dossier.critique && <CritiqueView critique={dossier.critique} />}
            </div>
        );
    };

    const CardComponent = ({ item }) => {
        switch (item.type) {
            case 'dossier':
                return <DossierCard dossier={item.data} />;
            case 'synergy':
                return <SynergyCard synergy={item.data} />;
            case 'hypothesis':
                return <HypothesisCard hypothesis={item.data} />;
            case 'source':
                return <SourceCard source={item.data} />;
            default:
                return null;
        }
    };

    return { DossierCard, SynergyCard, HypothesisCard, SourceCard, CardComponent };
}, []);

const [progressInfo, setProgressInfo] = React.useState({ step: 0, total: 0, message: '', eta: 0 });
const taskStartTime = React.useRef(null);
const lastHistoryLength = React.useRef(0);

React.useEffect(() => {
    if (liveSwarmHistory.length < lastHistoryLength.current) {
        lastHistoryLength.current = 0;
    }
    const newHistoryItems = liveSwarmHistory.slice(lastHistoryLength.current);
    if (newHistoryItems.length === 0) return;
    lastHistoryLength.current = liveSwarmHistory.length;

    setLiveFeed(currentFeed => {
        const feedMap = new Map(currentFeed.map(item => [item.id, item]));

        const processItem = (h, toolName, resultKey, type, idBuilder) => {
            if (h.tool?.name === toolName && h.executionResult?.[resultKey]) {
                const data = h.executionResult[resultKey];
                const id = idBuilder(data);
                const existing = feedMap.get(id);
                // Update if it doesn't exist or if the new one has a better score
                if (!existing || (data.trialPriorityScore || 0) > (existing.data.trialPriorityScore || 0)) {
                    feedMap.set(id, { id, type, data, timestamp: Date.now() });
                }
            }
        };

        newHistoryItems.forEach(h => {
            processItem(h, 'RecordValidatedSource', 'validatedSource', 'source', d => \`source-\${d.uri}\`);
            processItem(h, 'RecordHypothesis', 'hypothesis', 'hypothesis', d => \`hypo-\${d.hypotheticalAbstract.substring(0, 30)}\`);
            processItem(h, 'RecordSynergy', 'synergy', 'synergy', d => \`syn-\${d.combination.map(c=>c.name).sort().join('+')}-\${d.sourceUri || 'novo'}\`);
            processItem(h, 'RecordTrialDossier', 'dossier', 'dossier', d => \`dossier-\${d.combination.map(c=>c.name).sort().join('+')}\`);
        });

        const newFeed = Array.from(feedMap.values()).sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
        return newFeed;
    });
}, [liveSwarmHistory]);

React.useEffect(() => {
    if (isSwarmRunning && eventLog.length > 0) {
        let progressMatch;
        for (let i = eventLog.length - 1; i >= 0; i--) {
            const log = eventLog[i];
            const match = log.match(/\\\[Workflow\\] Processing (\\d+)\\/(\\d+): (.*)/) || log.match(/\\\[Workflow\\] Step (\\d+)\\/(\\d+): (.*)/);
            if (match) { progressMatch = match; break; }
        }
        if (progressMatch) {
            const step = parseInt(progressMatch[1], 10);
            const total = parseInt(progressMatch[2], 10);
            const message = progressMatch[3];
            let eta = 0;
            if (taskStartTime.current && step > 1) {
                const elapsedMs = Date.now() - taskStartTime.current;
                const avgTimePerStep = elapsedMs / (step - 1);
                eta = Math.round((avgTimePerStep * (total - step)) / 1000);
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
        runtime.logEvent('[SYSTEM] New research objective. Resetting workspace.');
        setLiveFeed([]);
        taskStartTime.current = Date.now();
        setProgressInfo({ step: 0, total: 1, message: 'Initiating workflow...', eta: 0 });
        startSwarmTask({ 
            task: { isScripted: true, script: [{ name: 'Execute Full Research and Proposal Workflow', arguments: { researchObjective: taskPrompt } }] },
            systemPrompt: null, 
            allTools: runtime.tools.list() 
        });
    }
};

const topDossiers = React.useMemo(() => {
    const dossiers = liveFeed.filter(item => item.type === 'dossier');
    // Attach the best matching synergy score to each dossier for display
    dossiers.forEach(dossier => {
        const comboKey = dossier.data.combination.map(c => c.name).sort().join('+');
        const matchingSynergies = liveFeed.filter(item => item.type === 'synergy' && item.id.includes(comboKey));
        if (matchingSynergies.length > 0) {
            matchingSynergies.sort((a,b) => (b.data.trialPriorityScore || 0) - (a.data.trialPriorityScore || 0));
            dossier.data.synergyData = matchingSynergies[0].data;
        }
    });
    return dossiers;
}, [liveFeed]);

const discoveryFeed = React.useMemo(() => liveFeed.filter(item => item.type !== 'dossier'), [liveFeed]);

return (
    <div className="h-full w-full flex bg-slate-900 text-slate-200 font-sans overflow-hidden">
        {/* Left Column: Controls */}
        <div className="w-[24rem] h-full flex flex-col p-4 gap-4 border-r border-slate-700/50 flex-shrink-0 overflow-y-auto">
            <div className="flex-shrink-0">
                <h1 className="text-3xl font-bold text-cyan-400 animate-text bg-gradient-to-r from-cyan-400 via-purple-400 to-amber-400 bg-clip-text text-transparent">SynergyForge</h1>
                <p className="text-base text-slate-400">Investor Proposal Engine</p>
            </div>
            <div className="flex flex-col gap-3 bg-black/30 p-4 rounded-lg border border-slate-800">
                <label htmlFor="task-prompt" className="font-semibold text-slate-300">Research Objective:</label>
                <textarea id="task-prompt" value={taskPrompt} onChange={(e) => setTaskPrompt(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm resize-none focus:ring-2 focus:ring-cyan-500" rows={4} placeholder="e.g., Discover novel synergistic treatments for Alzheimer's..." />
                <div>
                    <label htmlFor="model-selector" className="text-sm font-semibold text-slate-300">AI Model:</label>
                    <select id="model-selector" value={selectedModel.id + '|' + selectedModel.provider}
                        onChange={(e) => {
                            const [id, provider] = e.target.value.split('|');
                            const model = availableModels.find(m => m.id === id && m.provider === provider);
                            if (model) setSelectedModel(model);
                        }}
                        className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm"
                    >
                        {availableModels.map(model => <option key={model.id + '|' + model.provider} value={model.id + '|' + model.provider}>{model.name} ({model.provider})</option>)}
                    </select>
                </div>
                <div className="mt-2">
                    <button onClick={handleStart} disabled={isSwarmRunning || !taskPrompt.trim()} className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 text-white font-bold py-3 px-4 rounded-lg disabled:from-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-lg">
                        {isSwarmRunning ? 'Generating...' : 'Generate Proposals'}
                    </button>
                </div>
                {isSwarmRunning && progressInfo.total > 0 && (
                     <div className="flex flex-col gap-2 mt-2">
                        <div className="flex justify-between items-center text-xs text-slate-400">
                           <span className="font-semibold text-cyan-300">Analysis In Progress...</span>
                           <span>ETA: {(() => {
                               const seconds = progressInfo.eta;
                               if (seconds <= 0 || !isFinite(seconds)) return '...';
                               if (seconds < 60) return \`~\${Math.round(seconds)}s\`;
                               return \`~\${Math.floor(seconds / 60)}m \${Math.round(seconds % 60)}s\`;
                           })()}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-1.5"><div className="bg-gradient-to-r from-cyan-400 to-blue-500 h-1.5 rounded-full transition-all duration-500 ease-linear" style={{width: \`\${progressInfo.total > 0 ? (progressInfo.step / progressInfo.total) * 100 : 0}%\`}}></div></div>
                        <p className="text-xs text-slate-300 text-center truncate" title={progressInfo.message}>
                           {progressInfo.step > 0 ? \`\${progressInfo.step}/\${progressInfo.total}: \${progressInfo.message}\`: progressInfo.message}
                        </p>
                    </div>
                )}
            </div>
            <div className="mt-auto p-4 bg-black/20 rounded-lg border border-slate-800 flex flex-col">
                 <h2 className="text-lg font-bold text-slate-300 mb-2">How It Works</h2>
                 <ol className="list-decimal list-inside space-y-2 text-sm text-slate-400">
                    <li><span className="font-semibold">Real-time Analysis:</span> AI reads scientific papers one by one, starting with the most information-dense.</li>
                    <li><span className="font-semibold">Extract & Cost:</span> It identifies all mentioned interventions (drugs, behaviors) and instantly estimates their validation cost.</li>
                    <li><span className="font-semibold">Discover & Hypothesize:</span> It finds both <strong>known synergies</strong> described in the text and generates <strong>novel hypothetical synergies</strong> by identifying overlooked combinations.</li>
                    <li><span className="font-semibold">Score & Propose:</span> Every synergy—known or new—is immediately scored for scientific promise and financial ROI, with the best opportunities being developed into full investment dossiers.</li>
                 </ol>
             </div>
        </div>
        
        {/* Main Content: Live Feed & Dossiers */}
        <div className="flex-1 h-full flex flex-col p-4 gap-4 overflow-y-auto">
            <h2 className="text-3xl font-bold text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.5)] flex-shrink-0">Top Investment Opportunities</h2>
            
            {isSwarmRunning && topDossiers.length === 0 && <p className="text-slate-400 -mt-3">Awaiting first proposals...</p>}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-shrink-0">
                {topDossiers.map(item => <DossierCard key={item.id} dossier={item.data} />)}
            </div>

            {(isSwarmRunning || discoveryFeed.length > 0) && (
                <>
                    <div className="border-t border-slate-700/50 my-4 flex-shrink-0"></div>
                    <h3 className="text-2xl font-bold text-cyan-300 flex-shrink-0">Live Discovery Feed</h3>
                </>
            )}

            {isSwarmRunning && discoveryFeed.length === 0 && (
                 <div className="flex-grow flex items-center justify-center text-slate-500">
                    <div className="text-center">
                        <svg className="animate-spin h-8 w-8 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p>Analyzing scientific literature...</p>
                    </div>
                </div>
            )}
            
            <div className="flex-grow" style={{ columnWidth: '24rem', columnGap: '1rem' }}>
                 {discoveryFeed.map(item => (
                    <div key={item.id} className="mb-4 break-inside-avoid">
                        <CardComponent item={item} />
                    </div>
                 ))}
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
