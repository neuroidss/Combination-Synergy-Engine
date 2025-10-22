export const UI_CARD_COMPONENTS_CODE = `
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

    const TextWithCitations = React.memo(({ text, sources }) => {
        if (!text) return null;

// FIX: Correctly escape backslashes for special characters like '[' and ']' in regex literals inside a template string.
        const parts = text.split(/(\\[\\s*\\d+(?:,\\s*\\d+)*(?:-\\d+)?\\s*\\])/g);
        
        return (
            <React.Fragment>
                {parts.map((part, index) => {
                    if (index % 2 === 0) { // Text part
                        return part;
                    }

                    // Citation part
// FIX: Correctly escape backslashes for special characters like '[' and ']' in regex literals inside a template string.
                    const numbersStr = part.replace(/[\\[\\]\\s]/g, '');
                    const citationNumbers = new Set();
                    numbersStr.split(',').forEach(numStr => {
                        if (numStr.includes('-')) {
                            const [start, end] = numStr.split('-').map(n => parseInt(n, 10));
                            if (!isNaN(start) && !isNaN(end)) {
                                for (let i = start; i <= end; i++) {
                                    citationNumbers.add(i);
                                }
                            }
                        } else if (numStr) {
                            const num = parseInt(numStr, 10);
                            if (!isNaN(num)) {
                                citationNumbers.add(num);
                            }
                        }
                    });

                    return (
                        <span key={index} className="whitespace-nowrap">
                            {'['}
                            {Array.from(citationNumbers).sort((a,b) => a-b).map((num, i) => {
                                const source = sources[num - 1]; // 1-based index
                                return (
                                    <React.Fragment key={num}>
                                        {i > 0 && ', '}
                                        {source ? (
                                            <a href={source.url || source.uri} target="_blank" rel="noopener noreferrer"
                                               className="text-cyan-400 hover:underline"
                                               title={\`Source \${num}: \${source.title}\`}>
                                                {num}
                                            </a>
                                        ) : (
                                            <span>{num}</span>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            {']'}
                        </span>
                    );
                })}
            </React.Fragment>
        );
    });

    const SourceCard = ({source}) => (
        <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700 transition-colors hover:border-cyan-500/80 hover:bg-slate-800 flex flex-col">
            <a href={source.url || source.uri} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline font-semibold block truncate text-left w-full">{source.title}</a>
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
                
                <div className="text-xs text-slate-400 truncate">
                    Found in: {synergy.sourceUri ? (
                        <a href={synergy.sourceUri} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                            <em>{synergy.sourceTitle || 'Source'}</em>
                        </a>
                    ) : (
                        <em>{synergy.sourceTitle || 'De Novo Hypothesis'}</em>
                    )}
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

    const DossierCard = ({ dossier, onShowHistory, critique }) => {
        const [isFullyExpanded, setIsFullyExpanded] = React.useState(false);
        const synergy = dossier.synergyData || {};
        const backgroundSources = dossier.backgroundSources || [];
        const riskDossier = dossier.riskDossier || [];
        const totalDeRiskingCost = riskDossier.reduce((sum, risk) => sum + (risk.navigation_protocol?.signal_beacon?.estimated_cost || 0), 0);
        
        const opportunityMeta = {
            'DE NOVO HYPOTHESIS': { color: 'border-purple-400 text-purple-300', label: 'High Risk / Transformational Reward' },
            'HYPOTHETICAL SYNERGY': { color: 'border-cyan-400 text-cyan-300', label: 'Medium Risk / High Reward' },
            'KNOWN SYNERGY': { color: 'border-slate-500 text-slate-300', label: 'Low Risk / Incremental Reward' },
        };
        const opportunityInfo = opportunityMeta[dossier.noveltyClass] || opportunityMeta['HYPOTHETICAL SYNERGY'];

        const layer1Risks = riskDossier.filter(r => r.risk_layer === 1);
        const layer2Risks = riskDossier.filter(r => r.risk_layer === 2);
        const layer3Risks = riskDossier.filter(r => r.risk_layer === 3);

        const RiskLayerSection = ({ title, risks, color, icon, layer, description, isExpanded }) => {
            if (!risks || risks.length === 0) return null;
            return (
                <details className="bg-slate-900/50 rounded-lg border" open={isExpanded || layer > 1}>
                    <summary className={\`cursor-pointer list-none p-2 flex items-center gap-3 \${color}\`}>
                        {icon}
                        <div>
                            <h4 className="font-bold">{title} ({risks.length})</h4>
                            <p className="text-xs text-slate-400">{description}</p>
                        </div>
                    </summary>
                    <div className="p-3 space-y-3 text-sm">
                        {risks.map((risk, i) => (
                           <div key={i} className="p-2 rounded-md bg-slate-800/50 border-t border-slate-700 first:border-t-0">
                               <h5 className="font-semibold text-yellow-300">{risk.risk_name}</h5>
                               <p className="text-xs text-slate-300 mt-1"><strong className="font-semibold">Mechanism / Scenario:</strong> {risk.risk_origin?.synergy_factor}</p>
                               
                               {risk.risk_origin?.evidence && (
                                    <div className="mt-2 p-2 bg-black/30 rounded-md border border-slate-600">
                                        <h6 className="font-semibold text-cyan-300 text-xs mb-1">Supporting Evidence</h6>
                                        <blockquote className="border-l-2 border-cyan-500 pl-2 italic text-slate-400 text-xs">
                                            "{risk.risk_origin.evidence}"
                                        </blockquote>
                                        <p className="text-xs text-slate-500 mt-1 text-right">Source: {risk.risk_origin.source_title || 'N/A'}</p>
                                    </div>
                               )}
                           </div>
                        ))}
                    </div>
                </details>
            );
        };
        
        return (
            <div className="bg-slate-800/70 p-4 rounded-lg border border-amber-400/30 flex flex-col gap-4 animate-fade-in">
                {/* --- Section I: Expedition Description --- */}
                <div className="flex justify-between items-start">
                     <div>
                         <h3 className="text-lg font-bold text-amber-300 flex items-center flex-wrap gap-x-2 gap-y-1">
                            Expedition: {(synergy.combination || []).map((c, i) => (
                                <React.Fragment key={i}>
                                    {i > 0 && <span className="text-slate-400 text-base font-light">+</span>}
                                    <div className="flex items-center gap-1.5 bg-slate-900/50 rounded-full px-2 py-0.5">
                                        <InterventionTypeIcon type={c.type} />
                                        <span className="truncate">{c.name}</span>
                                    </div>
                                </React.Fragment>
                            ))}
                         </h3>
                     </div>
                     <div className="text-right flex-shrink-0">
                         <div className="font-bold text-slate-300 text-sm">v{dossier.version?.toFixed(1) || '1.0'}</div>
                         <button onClick={() => onShowHistory(dossier)} className="text-xs text-cyan-400 hover:underline">History</button>
                         <button onClick={() => setIsFullyExpanded(!isFullyExpanded)} className="ml-2 text-xs text-cyan-400 hover:underline">
                            {isFullyExpanded ? 'Collapse All' : 'Expand All'}
                        </button>
                     </div>
                </div>

                <div>
                     <div className={\`mt-1 text-center font-semibold text-sm p-1 rounded-md border-2 \${opportunityInfo.color} bg-black/30\`}>
                           Opportunity Class: {opportunityInfo.label}
                     </div>
                      <div className="text-sm text-slate-300 mt-2">
                        <strong className="text-cyan-300">Hypothesis:</strong>{' '}
                        <TextWithCitations text={synergy.moaJustification || synergy.summary} sources={backgroundSources} />
                     </div>
                </div>
                
                {/* --- Section II: Commercialization Outlook --- */}
                {dossier.targetIndication && (
                    <details className="bg-black/30 rounded-lg border border-emerald-500/50 group" open={isFullyExpanded}>
                        <summary className="cursor-pointer list-none bg-emerald-900/40 p-3 flex items-center justify-between gap-4">
                            <h4 className="font-bold text-emerald-300 text-lg">Commercialization Outlook</h4>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </summary>
                        <div className="p-3 space-y-3 text-sm">
                           <div>
                                <h5 className="font-semibold text-slate-300">Target Indication</h5>
                                <p className="text-slate-400 pl-2 border-l-2 border-emerald-700">{dossier.targetIndication} - <span className="italic">{dossier.indicationJustification || 'N/A'}</span></p>
                            </div>
                            {dossier.marketData && (
                                <div>
                                    <h5 className="font-semibold text-slate-300">Market Snapshot</h5>
                                    <ul className="list-disc list-inside text-slate-400 pl-2">
                                        <li><strong className="text-slate-300">Est. Market Size:</strong> {dossier.marketData.tam || 'N/A'}</li>
                                        <li><strong className="text-slate-300">CAGR:</strong> {dossier.marketData.cagr || 'N/A'}</li>
                                        <li><strong className="text-slate-300">Competitors:</strong> {(dossier.marketData.competitors || []).join(', ') || 'N/A'}</li>
                                    </ul>
                                </div>
                            )}
                            {dossier.ipStrategy && (
                                 <div>
                                    <h5 className="font-semibold text-slate-300">IP Strategy</h5>
                                     <p className="text-slate-400 pl-2 border-l-2 border-emerald-700"><strong className="text-slate-300">{dossier.ipStrategy.type}:</strong> {dossier.ipStrategy.description}</p>
                                </div>
                            )}
                            {dossier.regulatoryPathway && (
                                 <div>
                                    <h5 className="font-semibold text-slate-300">Regulatory Pathway</h5>
                                     <p className="text-slate-400 pl-2 border-l-2 border-emerald-700"><strong className="text-slate-300">{dossier.regulatoryPathway.pathway}:</strong> {dossier.regulatoryPathway.justification}</p>
                                </div>
                            )}
                        </div>
                    </details>
                )}

                {/* --- Section III: Risk Map --- */}
                <details className="bg-black/30 rounded-lg border border-red-500/50 group" open={isFullyExpanded}>
                     <summary className="cursor-pointer list-none bg-red-900/40 p-3 flex items-center justify-between gap-4">
                         <h4 className="font-bold text-red-300 text-lg">Risk Navigation Map</h4>
                         <p className="text-xs text-slate-400 flex-grow">Modeling threats across foundational, synergistic, and existential layers.</p>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                     </summary>
                     <div className="p-3 space-y-2">
                        <RiskLayerSection 
                           layer={1} title="Layer 1: Known Reefs" risks={layer1Risks} color="text-slate-300"
                           description="Foundational risks of individual components."
                           isExpanded={isFullyExpanded}
                           icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
                        <RiskLayerSection 
                           layer={2} title="Layer 2: Hidden Currents" risks={layer2Risks} color="text-yellow-300"
                           description="Unexpected threats from mechanistic interactions."
                            isExpanded={isFullyExpanded}
                           icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>} />
                        <RiskLayerSection 
                           layer={3} title="Layer 3: Chthonic Threats" risks={layer3Risks} color="text-red-400"
                           description="Long-term, evolutionary & systemic failure scenarios."
                            isExpanded={isFullyExpanded}
                           icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>} />
                     </div>
                </details>

                {/* --- Section IV: Engineering Navigation Protocol --- */}
                 <details className="bg-black/30 rounded-lg border border-cyan-500/50 group" open={isFullyExpanded}>
                     <summary className="cursor-pointer list-none bg-cyan-900/40 p-3 flex items-center justify-between gap-4">
                        <div>
                             <h4 className="font-bold text-cyan-300 text-lg">Engineering Navigation Protocol</h4>
                             <p className="text-xs text-slate-400">Actionable plan to navigate the identified risks.</p>
                        </div>
                        <div className="text-right">
                             <div className="text-xs uppercase tracking-wider text-slate-400">Total De-Risking Cost</div>
                             <div className="text-2xl font-bold text-emerald-400">\${totalDeRiskingCost.toLocaleString()}</div>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                     </summary>
                     
                     <div className="p-3 space-y-4">
                        {riskDossier.length > 0 ? riskDossier.map((risk, i) => (
                            <div key={i} className="border-b border-slate-700/50 pb-3 last:border-b-0 last:pb-0">
                                <h5 className="font-bold text-yellow-300">{risk.risk_name} (Layer {risk.risk_layer})</h5>
                                
                                <div className="mt-2 bg-slate-900/50 p-2 rounded-md border border-slate-700">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                        <div className="border-r border-slate-600 pr-3">
                                            <div className="font-semibold text-cyan-300 mb-1">"Signal Beacon" (Early Test)</div>
                                            <p className="text-slate-300">{risk.navigation_protocol?.signal_beacon?.name}</p>
                                            <p className="text-emerald-400 font-bold">\${(risk.navigation_protocol?.signal_beacon?.estimated_cost || 0).toLocaleString()}</p>
                                            <p className="text-red-300 mt-1"><strong className="font-semibold">Abort If:</strong> {risk.navigation_protocol?.go_no_go_criteria}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <div className="font-semibold text-purple-300 mb-1">"Course Corrections" (Improvements)</div>
                                            <ul className="list-disc list-inside text-slate-300 space-y-1">
                                                {(risk.navigation_protocol?.course_corrections || []).map((alt, j) => (
                                                    <li key={j} title={alt.improvement_hypothesis}><strong>{alt.strategy}:</strong> {alt.description}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )) : <p className="text-sm text-slate-400 text-center">No specific risks were modeled for this expedition.</p>}
                     </div>
                </details>

                {/* --- Section V: Red Team Critique --- */}
                {critique && (
                    <details className="bg-black/30 rounded-lg border border-yellow-500/50 group" open={isFullyExpanded}>
                        <summary className="cursor-pointer list-none bg-yellow-900/40 p-3 flex items-center justify-between gap-4">
                            <h4 className="font-bold text-yellow-300 text-lg">Red Team Critique</h4>
                            <div className={\`text-sm font-bold px-2 py-0.5 rounded-md \${critique.overallVerdict === 'Sound' ? 'bg-green-800 text-green-300' : critique.overallVerdict === 'Needs Revision' ? 'bg-yellow-800 text-yellow-300' : 'bg-red-800 text-red-300'}\`}>
                                Verdict: {critique.overallVerdict}
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </summary>
                        <div className="p-3 space-y-4 text-sm">
                            <div>
                                <h5 className="font-semibold text-green-300 mb-1">Strengths</h5>
                                <p className="text-slate-300">{critique.strengths}</p>
                            </div>
                            <div>
                                <h5 className="font-semibold text-red-300 mb-1">Weaknesses & Understated Risks</h5>
                                <p className="text-slate-300">{critique.weaknesses}</p>
                            </div>
                            {critique.contradictoryEvidence && critique.contradictoryEvidence.length > 0 && (
                                <div>
                                    <h5 className="font-semibold text-yellow-300 mb-1">Contradictory Evidence</h5>
                                    <ul className="list-disc list-inside text-slate-300 space-y-1">
                                        {critique.contradictoryEvidence.map((ev, i) => <li key={i}>{ev}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </details>
                )}
            </div>
        );
    };

    const CardComponent = ({ item, onShowHistory, critique }) => {
        switch (item.type) {
            case 'dossier':
                return <DossierCard dossier={item.data} onShowHistory={onShowHistory} critique={critique} />;
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
`;