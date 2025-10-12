

export const UI_COMPONENTS_CODE = `
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

const OrganoidStat = ({label, value, unit, inverted = false}) => {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) {
         return (
            <div className="text-center bg-black/30 p-2 rounded-lg border border-slate-700/50">
                <div className="text-xs text-cyan-300 uppercase tracking-wider whitespace-nowrap">{label}</div>
                <div className='text-lg font-bold text-slate-200 capitalize'>{value}</div>
            </div>
        );
    }

    let colorClass;
    let valueClass = 'font-bold';
    if (!inverted) { // Higher is better
        if (numericValue > 100) {
            colorClass = 'text-cyan-300';
            valueClass = 'font-bold animate-pulse'; // Add a pulse effect for "super" stats
        } else if (numericValue < 40) {
            colorClass = 'text-red-400';
        } else if (numericValue < 70) {
            colorClass = 'text-yellow-400';
        } else {
            colorClass = 'text-emerald-400';
        }
    } else { // Lower is better
        if (numericValue > 60) colorClass = 'text-red-400';
        else if (numericValue > 30) colorClass = 'text-yellow-400';
        else colorClass = 'text-emerald-400';
    }

    return (
        <div className="text-center bg-black/30 p-2 rounded-lg border border-slate-700/50">
            <div className="text-xs text-cyan-300 uppercase tracking-wider whitespace-nowrap">{label}</div>
            <div className={\`text-lg \${valueClass} \${colorClass}\`}>{value} <span className="text-sm font-normal text-slate-400">{unit}</span></div>
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
        <button onClick={() => window.open(source.url || source.uri, '_blank', 'noopener,noreferrer')} className="text-cyan-400 hover:underline font-semibold block truncate text-left w-full">{source.title}</button>
        <p className="text-xs text-slate-500 mt-1">Reliability: {((source.reliabilityScore || 0) * 100).toFixed(0)}% - {source.justification}</p>
        <p className="text-sm text-slate-300 mt-2">{source.summary}</p>
    </div>
);

const InterpretationCard = ({ interpretation }) => (
    <div className="bg-slate-800/60 p-3 rounded-lg border-2 border-dashed border-purple-500/80">
        <h4 className="text-base font-bold text-purple-300 mb-2">Hypothetical Research Abstract</h4>
        <p className="text-sm text-slate-200 whitespace-pre-wrap mb-3">{interpretation.hypotheticalAbstract}</p>
        <div className="pt-3 border-t border-slate-700">
            <h5 className="font-semibold text-cyan-300 mb-2 text-xs uppercase tracking-wider">Based on the gap between:</h5>
            <ul className="list-disc list-inside space-y-1 text-xs text-slate-400">
                {interpretation.neighbors.map((n, i) => <li key={i} className="truncate">{n.title}</li>)}
            </ul>
        </div>
    </div>
);

const MoaScoreIndicator = ({ score, justification }) => {
    const size = 60;
    const strokeWidth = 5;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    let colorClass = 'text-red-400 stroke-red-400';
    if (score >= 75) {
        colorClass = 'text-emerald-400 stroke-emerald-400';
    } else if (score >= 50) {
        colorClass = 'text-yellow-400 stroke-yellow-400';
    }

    return (
        <div className="relative flex items-center justify-center group">
            <svg width={size} height={size} viewBox={\`0 0 \${size} \${size}\`} className="transform -rotate-90">
                <circle className="stroke-slate-700" strokeWidth={strokeWidth} fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
                <circle className={\`transition-all duration-1000 ease-out \${colorClass}\`} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
            </svg>
            <span className={\`absolute text-base font-bold \${colorClass}\`}>{score}</span>
            <div className="absolute left-full ml-2 w-64 bg-slate-800 text-white text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 border border-slate-600 shadow-lg">
                <h6 className="font-bold text-cyan-300 mb-1">MoA Justification</h6>
                {justification}
            </div>
        </div>
    );
};

const TheoryAlignmentChart = ({ scores }) => {
    const theories = [
        { key: 'stochastic', name: 'Stochastic', color: 'bg-sky-500' },
        { key: 'hyperfunction', name: 'Hyperfunction', color: 'bg-red-500' },
        { key: 'information', name: 'Information', color: 'bg-purple-500' },
        { key: 'social', name: 'Social', color: 'bg-orange-500' },
    ];
    const maxScore = 100;
    return (
        <div className="w-full space-y-1.5 mt-2">
            <h4 className="text-xs font-semibold text-slate-300 text-center">Theory Alignment</h4>
            {theories.map(theory => {
                const score = scores[theory.key] || 0;
                const widthPercentage = (score / maxScore) * 100;
                return (
                    <div key={theory.key} className="flex items-center gap-2 group relative">
                        <span className="text-xs text-slate-400 w-16 text-right flex-shrink-0">{theory.name}</span>
                        <div className="w-full bg-slate-700 rounded-full h-3">
                            <div className={\`\${theory.color} h-3 rounded-full transition-all duration-1000 ease-out\`} style={{ width: \`\${widthPercentage}%\` }}></div>
                        </div>
                        <span className="text-xs font-bold text-slate-200 w-6 text-left">{score}</span>
                    </div>
                );
            })}
        </div>
    );
};

const SynergyCard = ({synergy, actions, applySynergy, anyOrganoidAlive}) => {
    const isHypothesized = synergy.status.includes('Hypothesized');
    return (
        <div className={\`bg-slate-800/60 p-4 rounded-lg border border-slate-700 flex flex-col transition-colors \${isHypothesized ? 'hover:border-purple-500/80' : 'hover:border-emerald-500/80'} hover:bg-slate-800\`}>
            <div className="flex justify-between items-start gap-4">
                <div className="flex-grow flex flex-col" style={{minWidth: 0}}>
                    <h4 className={\`text-lg font-bold flex items-center flex-wrap gap-x-2 gap-y-1 \${isHypothesized ? 'text-purple-400' : 'text-emerald-400'}\`}>
                        {synergy.combination.map((c, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && <span className="text-slate-400 text-base font-light">+</span>}
                                <div className="flex items-center gap-1.5 bg-slate-900/50 rounded-full px-2 py-0.5">
                                    <InterventionTypeIcon type={c.type} />
                                    <span className="truncate">{c.name}</span>
                                </div>
                            </React.Fragment>
                        ))}
                    </h4>
                    <span className={\`text-xs font-bold px-2 py-0.5 rounded-full inline-block mt-2 self-start \${isHypothesized ? 'bg-purple-900/70 text-purple-300' : 'bg-emerald-900/70 text-emerald-300'}\`}>{synergy.status || 'Known'}</span>
                    <p className="text-sm font-semibold text-slate-400 mt-2 mb-2">{synergy.synergyType}</p>
                    <p className="text-sm text-slate-300 flex-grow mb-3">{synergy.summary}</p>
                    {synergy.potentialRisks && (
                        <div className="bg-red-900/30 p-2 rounded-md border border-red-700/50 mb-3">
                            <h5 className="text-xs font-bold text-yellow-300 uppercase tracking-wider">Potential Risks</h5>
                            <p className="text-sm text-yellow-200">{synergy.potentialRisks}</p>
                        </div>
                    )}
                     {synergy.sourceUri && (
                        <div className="mt-auto pt-2 border-t border-slate-700/50">
                            <p className="text-xs text-slate-500">Source:</p>
                            <button onClick={() => window.open(synergy.sourceUri, '_blank', 'noopener,noreferrer')} className="text-xs text-cyan-500 hover:underline truncate block text-left w-full" title={\`Open source in new tab: \${synergy.sourceUri}\`}>
                                {synergy.sourceTitle || synergy.sourceUri}
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex-shrink-0 w-48 bg-black/30 p-3 rounded-lg border border-slate-700/50 flex flex-col items-center gap-2">
                     <div className="text-center">
                         <div className={\`text-4xl font-bold \${synergy.trialPriorityScore > 75 ? 'text-emerald-300' : synergy.trialPriorityScore > 50 ? 'text-yellow-300' : 'text-red-300'} drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]\`}>
                            {synergy.trialPriorityScore || 0}
                         </div>
                         <div className="text-xs uppercase tracking-wider text-slate-400">Trial Priority</div>
                     </div>
                     <div className="flex flex-col items-center">
                        <MoaScoreIndicator score={synergy.moaComplementarityScore || 0} justification={synergy.moaJustification || 'No justification provided.'} />
                        <span className="text-xs text-slate-400 mt-1">MoA Score</span>
                     </div>
                     <TheoryAlignmentChart scores={synergy.theoryAlignmentScores || {}} />
                </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-4">
                {actions}
                <button 
                    onClick={() => applySynergy(synergy)} 
                    disabled={!anyOrganoidAlive || !synergy.gameParameters} 
                    className={\`font-bold py-1.5 px-3 rounded-lg self-start transition-colors \${isHypothesized ? 'bg-purple-600 hover:bg-purple-500' : 'bg-emerald-600 hover:bg-emerald-500'} disabled:bg-slate-600 disabled:cursor-not-allowed\`}
                    title={synergy.gameParameters ? "Apply this combination to the live organoid simulations" : "Simulation parameters have not been generated for this synergy."}
                >
                    {synergy.gameParameters ? 'Apply to Organoids' : 'No Parameters'}
                </button>
            </div>
        </div>
    );
};

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

const DossierCard = ({ dossier, synergy }) => {
    const riskAnalysis = dossier.riskAnalysis || {};
    const overallRisk = riskAnalysis.overallRiskScore || 0;
    let riskColorClass = 'text-red-400';
    if (overallRisk < 33) riskColorClass = 'text-emerald-400';
    else if (overallRisk < 66) riskColorClass = 'text-yellow-400';

    return (
        <div className="bg-slate-800/70 p-4 rounded-lg border border-amber-400/30 flex flex-col gap-4">
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

            <details className="text-sm">
                <summary className="cursor-pointer text-cyan-400 hover:underline">Show Full Rationale & Details...</summary>
                <div className="mt-3 space-y-4 pt-3 border-t border-slate-700/50">
                    <div><h4 className="font-semibold text-cyan-300 mb-1">Scientific Rationale</h4><p className="text-sm text-slate-300">{dossier.scientificRationale}</p></div>
                    <div className="bg-black/30 p-3 rounded-md border border-slate-700"><h4 className="font-semibold text-emerald-300 mb-1">In Silico Validation (SynergyForge)</h4><p className="text-sm text-slate-300 font-mono">{dossier.inSilicoValidation}</p></div>
                    <div><h4 className="font-semibold text-cyan-300 mb-1">Market & IP Opportunity</h4><p className="text-sm text-slate-300">{dossier.marketAndIP}</p></div>
                    <div><h4 className="font-semibold text-cyan-300 mb-1">Proposed Roadmap</h4><p className="text-sm text-slate-300">{dossier.roadmap}</p></div>
                </div>
            </details>
            
            {dossier.critique && <CritiqueView critique={dossier.critique} />}
        </div>
    );
};

const ProgressTracker = ({ progress, isRunning }) => {
    if (!isRunning || progress.total === 0) return null;
    const percent = progress.total > 0 ? (progress.step / progress.total) * 100 : 0;
    const formatEta = (seconds) => {
        if (seconds <= 0 || !isFinite(seconds)) return 'Calculating...';
        if (seconds < 60) return \`~\${Math.round(seconds)}s\`;
        const minutes = Math.floor(seconds / 60);
        return \`~\${minutes}m \${Math.round(seconds % 60)}s\`;
    };
    return (
        <div className="flex flex-col gap-2 mt-4">
            <div className="flex justify-between items-center text-xs text-slate-400">
                <span className="font-semibold text-cyan-300">Workflow In Progress...</span>
                <span>ETA: {formatEta(progress.eta)}</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2.5"><div className="bg-gradient-to-r from-cyan-400 to-blue-500 h-2.5 rounded-full transition-all duration-500 ease-linear" style={{width: \`\${percent}%\`}}></div></div>
            <p className="text-sm text-slate-300 text-center truncate">Step {progress.step}/{progress.total}: {progress.message}</p>
        </div>
    );
};

const LoadingIndicator = ({ message }) => (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 p-4">
        <svg className="animate-spin h-6 w-6 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <span>{message || 'Working...'}</span>
    </div>
);
`;