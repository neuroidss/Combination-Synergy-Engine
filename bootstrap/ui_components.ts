

export const UI_COMPONENTS_CODE = `
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
            {synergy.potentialRisks && (
                <div className="mt-3 bg-red-900/30 p-2 rounded-md border border-red-700/50">
                    <h5 className="text-xs font-bold text-yellow-300 uppercase tracking-wider">Potential Risks</h5>
                    <p className="text-sm text-yellow-200">{synergy.potentialRisks}</p>
                </div>
            )}
            <button onClick={() => applySynergy(synergy)} disabled={!anyOrganoidAlive || !synergy.gameParameters} className={\`mt-4 font-bold py-1.5 px-3 rounded-lg self-start transition-colors \${isHypothesized ? 'bg-purple-600 hover:bg-purple-500' : 'bg-emerald-600 hover:bg-emerald-500'} disabled:bg-slate-600 disabled:cursor-not-allowed\`}>
                {synergy.gameParameters ? 'Apply to Organoids' : 'No Parameters'}
            </button>
        </div>
    );
};

const CritiqueView = ({ critique }) => (
    <div className="mt-4 bg-blue-900/40 border border-blue-700 p-3 rounded-lg">
        <h4 className="text-lg font-bold text-cyan-200 mb-2">Critical Analysis</h4>
        
        <div className="mb-3">
            <h5 className="font-semibold text-emerald-300 mb-1">Strengths</h5>
            <p className="text-sm text-slate-300">{critique.strengths}</p>
        </div>
        
        <div className="mb-3">
            <h5 className="font-semibold text-yellow-300 mb-1">Weaknesses & Risks</h5>
            <p className="text-sm text-slate-300">{critique.weaknesses}</p>
        </div>

        {critique.contradictoryEvidence && critique.contradictoryEvidence.length > 0 && (
            <div className="mb-3">
                <h5 className="font-semibold text-red-300 mb-1">Contradictory Evidence</h5>
                <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
                    {critique.contradictoryEvidence.map((ev, i) => <li key={i}>{ev}</li>)}
                </ul>
            </div>
        )}

        <div>
             <h5 className="font-semibold text-cyan-300 mb-1">Overall Verdict</h5>
             <p className="text-sm font-bold text-white">{critique.overallVerdict}</p>
        </div>
    </div>
);

const DossierCard = ({ dossier, critique }) => (
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
        {critique && <CritiqueView critique={critique} />}
    </div>
);

const ProgressTracker = ({ progress, isRunning }) => {
    if (!isRunning || progress.total === 0) return null;

    const percent = progress.total > 0 ? (progress.step / progress.total) * 100 : 0;
    
    const formatEta = (seconds) => {
        if (seconds <= 0 || !isFinite(seconds)) return 'Calculating...';
        if (seconds < 60) return \`~\${Math.round(seconds)}s\`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.round(seconds % 60);
        return \`~\${minutes}m \${remainingSeconds}s\`;
    };

    return (
        <div className="flex flex-col gap-2 mt-4">
            <div className="flex justify-between items-center text-xs text-slate-400">
                <span className="font-semibold text-cyan-300">Workflow In Progress...</span>
                <span>ETA: {formatEta(progress.eta)}</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2.5 dark:bg-gray-700">
                <div 
                    className="bg-gradient-to-r from-cyan-400 to-blue-500 h-2.5 rounded-full transition-all duration-500 ease-linear" 
                    style={{width: \`\${percent}%\`}}>
                </div>
            </div>
            <p className="text-sm text-slate-300 text-center truncate">Step {progress.step}/{progress.total}: {progress.message}</p>
        </div>
    );
};

const LoadingIndicator = ({ message }) => (
    <div className="flex flex-col items-center justify-center gap-2 text-slate-400 p-4">
        <svg className="animate-spin h-6 w-6 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <span>{message || 'Working...'}</span>
    </div>
);
`