
import { UI_CARD_COMPONENTS_CODE } from './ui_card_components';

export const MAIN_PANEL_CODE = `
const { ModelProvider } = runtime.getState();
const { DossierCard, SynergyCard, HypothesisCard, SourceCard, CardComponent } = React.useMemo(() => {
    ${UI_CARD_COMPONENTS_CODE}

    return { DossierCard, SynergyCard, HypothesisCard, SourceCard, CardComponent };
}, []);

const [progressInfo, setProgressInfo] = React.useState({ step: 0, total: 0, message: '', eta: 0 });
const taskStartTime = React.useRef(null);
const lastHistoryLength = React.useRef(0);
const [selectedProvider, setSelectedProvider] = React.useState(selectedModel.provider);
const [customModelId, setCustomModelId] = React.useState('');
const [historyModalDossier, setHistoryModalDossier] = React.useState(null);


// Fetch Ollama models on mount
React.useEffect(() => {
    fetchOllamaModels();
}, []);

// Effect to handle switching between providers and custom inputs
React.useEffect(() => {
    if (selectedProvider === 'GoogleAI') {
        const googleModel = availableModels.find(m => m.provider === 'GoogleAI');
        if (googleModel) setSelectedModel(googleModel);
    } else if (selectedProvider === 'Ollama' && ollamaModels.length > 0) {
        setSelectedModel(ollamaModels[0]);
    } else if (selectedProvider === 'HuggingFace') {
        const hfModel = availableModels.find(m => m.provider === 'HuggingFace');
        if (hfModel) setSelectedModel(hfModel);
    } else if (selectedProvider === 'DeepSeek') {
        const dsModel = availableModels.find(m => m.provider === 'DeepSeek');
        if (dsModel) setSelectedModel(dsModel);
    } else if (selectedProvider === 'Ollama' || selectedProvider === 'OpenAI_API') {
        if (customModelId.trim()) {
            const model = { id: customModelId.trim(), name: customModelId.trim(), provider: selectedProvider };
            setSelectedModel(model);
        }
    }
}, [selectedProvider, customModelId, ollamaModels, availableModels]);


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
                // Dossiers always replace previous versions to show updates.
                if (type === 'dossier' || !existing || (data.trialPriorityScore || 0) > (existing.data.trialPriorityScore || 0)) {
                    feedMap.set(id, { id, type, data, timestamp: Date.now() });
                }
            }
        };

        newHistoryItems.forEach(h => {
            processItem(h, 'RecordValidatedSource', 'validatedSource', 'source', d => \`source-\${d.uri}\`);
            processItem(h, 'RecordHypothesis', 'hypothesis', 'hypothesis', d => \`hypo-\${(d.hypotheticalAbstract || 'no-abstract').substring(0, 30)}\`);
            processItem(h, 'RecordSynergy', 'synergy', 'synergy', d => \`syn-\${d.combination.map(c=>c.name).sort().join('+')}-\${d.sourceUri || 'novo'}\`);
            processItem(h, 'RecordTrialDossier', 'dossier', 'dossier', d => \`dossier-\${d.combination.map(c=>c.name).sort().join('+')}\`);
            processItem(h, 'RecordCritique', 'critique', 'critique', d => \`critique-\${d.combination.map(c=>c.name).sort().join('+')}\`);
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
            const match = log.match(/\\[Workflow\\] Processing (\\d+)\\/(\\d+): (.*)/) || log.match(/\\[Workflow\\] Step (\\d+)\\/(\\d+): (.*)/);
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
        runtime.logEvent('[SYSTEM] New research objective. Starting swarm...');
        taskStartTime.current = Date.now();
        setProgressInfo({ step: 0, total: 1, message: 'Initiating workflow...', eta: 0 });
        startSwarmTask({ 
            task: { isScripted: true, script: [{ name: 'Execute Full Research and Proposal Workflow', arguments: { researchObjective: taskPrompt } }] },
            systemPrompt: null, 
            allTools: runtime.tools.list() 
        });
    }
};

const handleToggleChronicler = async () => {
    if (!isChroniclerActive) {
        runtime.logEvent("[Chronicler] User action detected. Priming audio systems...");

        // Prime speech synthesis
        window.speechSynthesis.cancel();
        const voices = window.speechSynthesis.getVoices(); 
        if (voices.length > 0) {
            runtime.logEvent("[Chronicler] ✅ Speech synthesis primed successfully.");
        } else {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (window.speechSynthesis.getVoices().length > 0) {
                 runtime.logEvent("[Chronicler] ✅ Speech synthesis primed successfully after short delay.");
            } else {
                runtime.logEvent("[Chronicler] ⚠️ WARN: Speech synthesis voices not available. Narration may not work.");
            }
        }
        
        // Prime Web Audio API for ambient music
        if (!window.__chroniclerAudio) {
            try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                window.__chroniclerAudio = {
                    context: audioCtx,
                    osc1: null,
                    osc2: null,
                    gain: null,
                };
            } catch(e) {
                console.error("Web Audio API is not supported in this browser.");
                runtime.logEvent("[Chronicler] ❌ ERROR: Web Audio API not supported.");
            }
        }
        
        const audio = window.__chroniclerAudio;
        if (audio && audio.context) {
             if (audio.context.state === 'suspended') {
                try {
                    await audio.context.resume();
                    runtime.logEvent("[Chronicler] ✅ Web Audio context for music resumed successfully.");
                } catch(e) {
                    runtime.logEvent(\`[Chronicler] ❌ ERROR: Failed to resume audio context: \${e.message}\`);
                }
            } else {
                runtime.logEvent("[Chronicler] ✅ Web Audio context for music is already active.");
            }
        } else {
            runtime.logEvent("[Chronicler] ❌ ERROR: Web Audio context could not be initialized.");
        }

    } else {
        window.speechSynthesis.cancel();
    }
    setIsChroniclerActive(!isChroniclerActive);
};


const topDossiers = React.useMemo(() => {
    return liveFeed.filter(item => item.type === 'dossier');
}, [liveFeed]);

const critiques = React.useMemo(() => {
    const critiqueMap = new Map();
    liveFeed.filter(item => item.type === 'critique').forEach(critique => {
        const key = \`dossier-\${critique.data.combination.map(c=>c.name).sort().join('+')}\`;
        critiqueMap.set(key, critique.data);
    });
    return critiqueMap;
}, [liveFeed]);


const discoveryFeed = React.useMemo(() => liveFeed.filter(item => item.type !== 'dossier' && item.type !== 'critique'), [liveFeed]);

const googleModels = React.useMemo(() => availableModels.filter(m => m.provider === 'GoogleAI'), [availableModels]);
const hfModels = React.useMemo(() => availableModels.filter(m => m.provider === 'HuggingFace'), [availableModels]);
const deepseekModels = React.useMemo(() => availableModels.filter(m => m.provider === 'DeepSeek'), [availableModels]);

const renderProviderConfig = () => {
    const commonInputClasses = "w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm";
    const commonLabelClasses = "text-sm font-semibold text-slate-300";
    
    switch (selectedProvider) {
        case 'GoogleAI':
            return (
                <div className="space-y-3">
                    <div>
                        <label htmlFor="google-api-key" className={commonLabelClasses}>Google AI API Key:</label>
                        <input id="google-api-key" type="password" placeholder="Enter your Gemini API Key..."
                            value={apiConfig.googleAIAPIKey || ''}
                            onChange={(e) => setApiConfig(c => ({...c, googleAIAPIKey: e.target.value}))}
                            className={commonInputClasses} autoComplete="off"
                        />
                    </div>
                    <div>
                        <label htmlFor="google-model-selector" className={commonLabelClasses}>AI Model:</label>
                        <select id="google-model-selector" value={selectedModel.id} onChange={(e) => {
                            const model = googleModels.find(m => m.id === e.target.value);
                            if (model) setSelectedModel(model);
                        }} className={commonInputClasses}>
                            {googleModels.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
                        </select>
                    </div>
                </div>
            );
        case 'Ollama':
            return (
                 <div className="space-y-3">
                    <div>
                        <label htmlFor="ollama-host" className={commonLabelClasses}>Ollama Host URL:</label>
                        <input id="ollama-host" type="text" placeholder="http://localhost:11434"
                            value={apiConfig.ollamaHost || ''}
                            onChange={(e) => setApiConfig(c => ({...c, ollamaHost: e.target.value}))}
                            className={commonInputClasses}
                        />
                    </div>
                    <div>
                        <label className={commonLabelClasses}>AI Model:</label>
                        <div className="flex items-center gap-2 mt-1">
                            { (ollamaState.error || ollamaModels.length === 0) && !ollamaState.loading &&
                                <input type="text" placeholder="Enter Ollama model ID..." value={customModelId} onChange={e => setCustomModelId(e.target.value)} className={commonInputClasses + ' mt-0'} />
                            }
                            { !ollamaState.error && ollamaModels.length > 0 &&
                                 <select value={selectedModel.id} onChange={(e) => {
                                    const model = ollamaModels.find(m => m.id === e.target.value);
                                    if (model) setSelectedModel(model);
                                }} className={commonInputClasses + ' mt-0'}>
                                    {ollamaModels.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
                                </select>
                            }
                            <button onClick={fetchOllamaModels} disabled={ollamaState.loading} className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600 disabled:opacity-50 flex-shrink-0">
                                {ollamaState.loading ? 
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M20 4h-5v5M4 20h5v-5" /></svg>
                                }
                            </button>
                        </div>
                         {ollamaState.error && <p className="text-xs text-red-400 mt-1">{ollamaState.error}</p>}
                    </div>
                </div>
            );
         case 'OpenAI_API':
            return (
                 <div className="space-y-3">
                    <div>
                        <label htmlFor="openai-base-url" className={commonLabelClasses}>API Base URL:</label>
                        <input id="openai-base-url" type="text" placeholder="http://localhost:11434/v1"
                            value={apiConfig.openAIBaseUrl || ''}
                            onChange={(e) => setApiConfig(c => ({...c, openAIBaseUrl: e.target.value}))}
                            className={commonInputClasses}
                        />
                    </div>
                     <div>
                        <label htmlFor="openai-api-key" className={commonLabelClasses}>API Key:</label>
                        <input id="openai-api-key" type="password" placeholder="Enter your API Key..."
                            value={apiConfig.openAIAPIKey || ''}
                            onChange={(e) => setApiConfig(c => ({...c, openAIAPIKey: e.target.value}))}
                            className={commonInputClasses} autoComplete="off"
                        />
                    </div>
                    <div>
                        <label htmlFor="openai-model-id" className={commonLabelClasses}>Model ID:</label>
                        <input id="openai-model-id" type="text" placeholder="e.g., gemma2:9b" value={customModelId} onChange={e => setCustomModelId(e.target.value)} className={commonInputClasses} />
                    </div>
                 </div>
            );
        case 'DeepSeek':
             return (
                 <div className="space-y-3">
                      <div>
                        <label htmlFor="deepseek-api-key" className={commonLabelClasses}>Nebius API Key:</label>
                        <p className="text-xs text-slate-400">Uses the key from the "OpenAI-compatible" section.</p>
                        <input id="deepseek-api-key" type="password" placeholder="Enter your Nebius API Key..."
                            value={apiConfig.openAIAPIKey || ''}
                            onChange={(e) => setApiConfig(c => ({...c, openAIAPIKey: e.target.value}))}
                            className={commonInputClasses} autoComplete="off"
                        />
                    </div>
                    <div>
                        <label htmlFor="deepseek-model-selector" className={commonLabelClasses}>AI Model:</label>
                        <select id="deepseek-model-selector" value={selectedModel.id} onChange={(e) => {
                            const model = deepseekModels.find(m => m.id === e.target.value);
                            if (model) setSelectedModel(model);
                        }} className={commonInputClasses}>
                            {deepseekModels.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
                        </select>
                    </div>
                 </div>
            );
        case 'HuggingFace':
            return (
                <div className="space-y-3">
                    <div>
                        <label htmlFor="hf-model-selector" className={commonLabelClasses}>AI Model:</label>
                        <select id="hf-model-selector" value={selectedModel.id} onChange={(e) => {
                            const model = hfModels.find(m => m.id === e.target.value);
                            if (model) setSelectedModel(model);
                        }} className={commonInputClasses}>
                            {hfModels.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
                        </select>
                    </div>
                    <p className="text-xs text-slate-400">
                        Models run directly in your browser via Transformers.js. The first-time model load may be slow as files are downloaded and cached.
                    </p>
                </div>
            );
        default:
            return null;
    }
};


return (
    <>
    <div className="h-full w-full flex bg-slate-900 text-slate-200 font-sans overflow-hidden">
        {/* Left Column: Controls */}
        <div className="w-[24rem] h-full flex flex-col p-4 gap-4 border-r border-slate-700/50 flex-shrink-0 overflow-y-auto">
            <div className="flex-shrink-0">
                <h1 className="text-3xl font-bold text-cyan-400 animate-text bg-gradient-to-r from-cyan-400 via-purple-400 to-amber-400 bg-clip-text text-transparent">SynergyForge</h1>
                <p className="text-base text-slate-400">Immortality Risk Navigator</p>
            </div>
            <div className="flex flex-col gap-4 bg-black/30 p-4 rounded-lg border border-slate-800">
                <div>
                    <label htmlFor="task-prompt" className="font-semibold text-slate-300">Expedition Objective:</label>
                    <textarea id="task-prompt" value={taskPrompt} onChange={(e) => setTaskPrompt(e.target.value)} className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm resize-none focus:ring-2 focus:ring-cyan-500" rows={4} placeholder="e.g., Discover novel synergistic treatments for Alzheimer's..." />
                </div>
                
                <div>
                    <label htmlFor="provider-selector" className="font-semibold text-slate-300">AI Provider:</label>
                    <select id="provider-selector" value={selectedProvider}
                        onChange={(e) => setSelectedProvider(e.target.value)}
                        className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm"
                    >
                        <option value="GoogleAI">Google AI (Gemini)</option>
                        <option value="DeepSeek">DeepSeek (Nebius)</option>
                        <option value="Ollama">Ollama (Local)</option>
                        <option value="OpenAI_API">OpenAI-compatible</option>
                        <option value="HuggingFace">HuggingFace (Browser)</option>
                    </select>
                </div>
                
                <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                    {renderProviderConfig()}
                </div>

                <div className="mt-2 space-y-2">
                    <button onClick={handleStart} disabled={isSwarmRunning || !taskPrompt.trim()} className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 text-white font-bold py-3 px-4 rounded-lg disabled:from-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-lg">
                        {isSwarmRunning ? 'Navigating...' : 'Chart Expedition'}
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

            <div className="p-4 bg-black/20 rounded-lg border border-slate-800">
                <h2 className="font-bold text-slate-300 mb-2 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 12.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                    </svg>
                    Ship's Chronicler
                </h2>
                <p className="text-sm text-slate-400 mb-3">Activates a narrative AI to comment on the expedition's progress.</p>
                <button 
                    onClick={handleToggleChronicler} 
                    className={\`w-full font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors \${isChroniclerActive ? 'bg-purple-600 hover:bg-purple-500 text-purple-100' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}\`}
                    aria-pressed={isChroniclerActive}
                >
                    <div className={\`w-3 h-3 rounded-full \${isChroniclerActive ? 'bg-green-400 animate-pulse' : 'bg-slate-400'}\`}></div>
                    {isChroniclerActive ? 'Chronicler Active' : 'Activate Chronicler'}
                </button>
                <label htmlFor="tts-lang" className="text-sm font-semibold text-slate-300 mt-3 block">Narrator Language:</label>
                <select 
                    id="tts-lang" 
                    value={selectedTtsLang} 
                    onChange={e => setSelectedTtsLang(e.target.value)} 
                    className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm focus:ring-2 focus:ring-purple-500"
                    disabled={availableTtsLangs.length === 0}
                >
                    {availableTtsLangs.length > 0 ? 
                        availableTtsLangs.map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>) :
                        <option>Loading languages...</option>
                    }
                </select>
                <label htmlFor="tts-voice" className="text-sm font-semibold text-slate-300 mt-3 block">Narrator Voice:</label>
                <select 
                    id="tts-voice" 
                    value={selectedTtsVoice} 
                    onChange={e => setSelectedTtsVoice(e.target.value)} 
                    className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm focus:ring-2 focus:ring-purple-500"
                    disabled={ttsVoices.length === 0}
                >
                    {ttsVoices.length > 0 ? 
                        ttsVoices.map(voice => <option key={voice} value={voice}>{voice}</option>) :
                        <option>{selectedTtsLang ? 'No voices for this language' : 'Select a language'}</option>
                    }
                </select>
                <label htmlFor="chronicler-freq" className="text-sm font-semibold text-slate-300 mt-3 block">Update Interval:</label>
                <div className="flex items-center gap-2">
                    <input 
                        id="chronicler-freq" 
                        type="range" 
                        min="5000" 
                        max="30000" 
                        step="1000" 
                        value={chroniclerFrequency} 
                        onChange={e => setChroniclerFrequency(Number(e.target.value))} 
                        className="w-full"
                        aria-label="Chronicler update interval"
                    />
                    <span className="text-sm text-slate-400 w-12 text-right tabular-nums">{(chroniclerFrequency / 1000).toFixed(1)}s</span>
                </div>
            </div>
            
            <div className="p-4 bg-black/20 rounded-lg border border-slate-800">
                <h2 className="font-bold text-slate-300 mb-2 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    Sentinel Agent Status
                </h2>
                <p className="text-sm text-slate-400">The Sentinel periodically scans for new research to keep the Atlas up-to-date.</p>
                <div className="text-xs mt-2 text-cyan-300 bg-cyan-900/50 p-2 rounded-md">
                    Status: Idle. Next scan scheduled automatically.
                </div>
            </div>

            <div className="mt-auto p-4 bg-black/20 rounded-lg border border-slate-800 flex flex-col">
                 <h2 className="text-lg font-bold text-slate-300 mb-2">Philosophy</h2>
                 <p className="text-sm text-slate-400">"The safe path is a dead end. Immortality lies on the other side of navigated risk."</p>
                 <ol className="list-decimal list-inside space-y-2 text-sm text-slate-400 mt-2">
                    <li><span className="font-semibold">Model All Risks:</span> The AI charts a multi-layered map of dangers for each synergy, from known side-effects to long-term evolutionary traps.</li>
                    <li><span className="font-semibold">Engineer "Fuses":</span> For each risk, it designs a cheap, targeted lab test—a "signal beacon"—to get an early warning.</li>
                    <li><span className="font-semibold">Chart "Detours":</span> The agent proposes engineering improvements to the hypothesis—"course corrections"—to navigate around identified dangers.</li>
                 </ol>
             </div>
        </div>
        
        {/* Main Content: Live Feed & Dossiers */}
        <div className="flex-1 h-full flex flex-col p-4 gap-4 overflow-y-auto">
            <h2 className="text-3xl font-bold text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.5)] flex-shrink-0">Expedition Navigation Maps</h2>
            
            {isSwarmRunning && topDossiers.length === 0 && <p className="text-slate-400 -mt-3">Awaiting first expedition maps...</p>}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-shrink-0">
                {topDossiers.map(item => <CardComponent key={item.id} item={item} critique={critiques.get(item.id)} onShowHistory={setHistoryModalDossier} />)}
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
                        <CardComponent item={item} onShowHistory={setHistoryModalDossier} />
                    </div>
                 ))}
            </div>
        </div>
    </div>
    
    {historyModalDossier && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={() => setHistoryModalDossier(null)}>
            <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-700">
                    <h3 className="text-lg font-bold text-amber-300">History: {historyModalDossier.synergyData.combination.map(c=>c.name).join(' + ')}</h3>
                    <p className="text-sm text-slate-400">Last updated: {new Date(historyModalDossier.updatedAt).toLocaleString()}</p>
                </div>
                <div className="p-4 overflow-y-auto">
                    <ul className="space-y-4">
                        {(historyModalDossier.history || []).map((entry, index) => (
                             <li key={index} className="text-sm text-slate-300 border-l-2 border-cyan-500 pl-3">
                                {entry}
                            </li>
                        ))}
                    </ul>
                </div>
                 <div className="p-3 border-t border-slate-700 text-right">
                    <button onClick={() => setHistoryModalDossier(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md text-sm">Close</button>
                </div>
            </div>
        </div>
    )}
    
    {isChroniclerActive && <ChroniclerView eventLog={eventLog} runtime={runtime} selectedTtsVoice={selectedTtsVoice} selectedTtsLang={selectedTtsLang} isChroniclerActive={isChroniclerActive} isSwarmRunning={isSwarmRunning} chroniclerFrequency={chroniclerFrequency} taskPrompt={taskPrompt} narrativeLog={narrativeLog} setNarrativeLog={setNarrativeLog} />}
    </>
);
`