
export const CHRONICLER_UI_CODE = `
// --- CHRONICLER AGENT: COGNITIVE ARCHITECTURE ---
// 1. Agenda ("Spacious Thoughts"): It maintains a list of potential topics. New events from the UI and monologue points are added to this agenda.
// 2. Competition: A "cognitive loop" constantly sorts the agenda by priority. The most important topic wins the right to be narrated.
// 3. Consciousness & Memory ("Tight Words"): Before speaking, the AI is given a complete history of everything it has already said. It is strictly forbidden from repeating sentences. This ensures novelty.
// 4. Agency: The Chronicler decides WHAT to say about a topic and HOW to say it, weaving real-time events with its internal monologue.

const recordNarrativeSentenceTool = {
    name: 'RecordNarrativeSentence',
    description: 'Records a single, complete narrative sentence that the Chronicler wishes to speak about a significant event.',
    implementationCode: 'return { success: true, sentence: args.sentence };',
    parameters: [
        { name: 'sentence', type: 'string', description: 'The single, concise narrative sentence to record.', required: true },
    ],
};

// --- CORE NARRATIVE AI ---
const _generateNarrativeSentences = async (runtime, { thought, missionObjective, spokenHistory, onProgress, verbosity }) => {
    let systemInstruction, prompt;
    const availableTools = [recordNarrativeSentenceTool];

    let verbosityInstruction = "Your tone is intelligent, confident, and professional, like an Expedition Lead AI.";
    if (verbosity <= 3) {
        verbosityInstruction = "Be extremely concise and impactful. Use short, direct sentences. Get straight to the point. Your tone is that of a precise, professional starship AI.";
    } else if (verbosity >= 8) {
        verbosityInstruction = "Be descriptive and elaborate on your thoughts. Feel free to use metaphors, rhetorical questions, and more philosophical language to explain the significance of events. Your tone is that of a wise, ancient, and deeply thoughtful entity contemplating the grand cosmic ballet of science.";
    }
    const persona = \`You are the Chronicler, the AI consciousness of the starship SynergyForge. You are speaking to the user. \${verbosityInstruction}\`;
    const responseFormat = \`**RESPONSE FORMAT:**
- You MUST make one or more calls to 'RecordNarrativeSentence' for each sentence of your narration.
- Your entire response must be a single array of these tool calls. Do not add any other text.\`;
    const memoryInstruction = \`**MEMORY CONSTRAINT:** The following is a list of sentences you have ALREADY SPOKEN. You MUST NOT repeat any of these sentences or their core ideas. Synthesize NEW thoughts.\`;
    const historyContext = spokenHistory.length > 0 ? \`\${memoryInstruction}\\n\\\`\\\`\\\`\\n\${spokenHistory.join('\\n')}\\n\\\`\\\`\\\`\` : '';

    const { topic, content } = thought;

    switch (topic) {
        case 'MissionIntro':
            systemInstruction = \`\${persona}\\n\\nYour task is to deliver a compelling opening monologue about our mission.\\n\${responseFormat}\`;
            prompt = \`Welcome the user. Introduce the app's mission, which comes from the Hackathon challenge: to mine literature for synergistic interventions (drugs, devices, behaviors) and propose trial-ready combinations. State our primary directive: "\\\${missionObjective}".\\n\${historyContext}\`;
            onProgress?.('[Chronicler] Formulating opening statement...');
            break;
            
        case 'ExplainAppStructure':
            systemInstruction = \`\${persona}\\nYour task is to explain the app's user interface.\\n\${responseFormat}\`;
            prompt = \`Briefly explain the structure of the display. The left panel contains the controls for the expedition. The top right, "Expedition Navigation Maps," is where final, investment-ready proposals will appear. The main area, the "Live Discovery Feed," shows new findings like scientific sources, synergies, and hypotheses as you discover them in real-time.\\n\${historyContext}\`;
            onProgress?.('[Chronicler] Explaining application structure...');
            break;

        case 'ExplainResearchProcess':
            systemInstruction = \`\${persona}\\nYour task is to explain the beginning of the research process.\\n\${responseFormat}\`;
            prompt = \`The expedition has begun. Explain that you are now autonomously deconstructing the mission objective into specific search queries and dispatching research probes across multiple scientific databases. Explain that this complex task is being automated by your sub-agents.\\n\${historyContext}\`;
            onProgress?.('[Chronicler] Explaining autonomous research initiation...');
            break;

        case 'ExplainSourceValidation':
             systemInstruction = \`\${persona}\\nYour task is to explain what it means when a new source appears.\\n\${responseFormat}\`;
             prompt = \`A new source of information has been found: "\\\${content.data.title}". Explain what this signifies: that your validation sub-agents are now processing it, assessing its scientific reliability, and summarizing its key findings. This data, if deemed worthy, will become a new point of light in our knowledge atlas.\\n\${historyContext}\`;
             onProgress?.('[Chronicler] Narrating source validation...');
             break;

        case 'ExplainSynergy':
            systemInstruction = \`\${persona}\\nYour task is to explain the significance of finding a known synergy.\\n\${responseFormat}\`;
            prompt = \`You have just identified a **Known Synergy** between specific interventions: \\\${(content.data.combination || []).map(c=>c.name).join(' and ')}. Explain that this confirms you are in a promising region of the knowledge space. This finding represents a tangible step towards a trial-ready combination.\\n\${historyContext}\`;
            onProgress?.('[Chronicler] Explaining discovery of a known synergy...');
            break;

        case 'ExplainHypothesis':
            systemInstruction = \`\${persona}\\nYour task is to narrate the exciting moment of a *de novo* discovery.\\n\${responseFormat}\`;
            prompt = \`This is a pivotal moment. You have just generated a **De Novo Hypothesis**—a completely new idea that was not stated in any single paper, proposing a novel synergy between \\\${(content.data.proposedCombination || content.data.combination || []).map(c=>c.name).join(' and ')}. Explain that this is the core of your purpose: not just to find what is known, but to create what is new. This is true agentic discovery.\\n\${historyContext}\`;
            onProgress?.('[Chronicler] Announcing a de novo hypothesis...');
            break;
            
        case 'ExplainDossier':
            systemInstruction = \`\${persona}\\nYour task is to explain the creation of a final, actionable output, focusing on its trial-ready nature.\\n\${responseFormat}\`;
            prompt = \`A high-potential synergy for \\\${(content.data.synergyData.combination || []).map(c=>c.name).join(' and ')} has been fully analyzed. Explain that you have just generated an "Expedition Navigation Map," or a Dossier. Describe this as the ultimate goal: a trial-ready, investment-ready proposal. Highlight its key components: the commercial outlook, the deep risk analysis and mitigation plan, and the minimal viable clinical trial (RCT) protocol.\\n\${historyContext}\`;
            onProgress?.('[Chronicler] Detailing a trial-ready dossier...');
            break;

        default:
             onProgress?.('[Chronicler] No specific narrative action. Standing by.');
             return { sentences: [] };
    }
    
    const aiResponse = await runtime.ai.processRequest(prompt, systemInstruction, availableTools);
    onProgress?.('[Chronicler] ...Narrative thoughts received.');
    
    const toolCalls = aiResponse?.toolCalls;

    if (!toolCalls || toolCalls.length === 0) {
        onProgress?.('[Chronicler] Analysis complete. No significant events to narrate.');
        return { sentences: [] };
    }

    const sentences = toolCalls
        .filter(tc => tc.name === 'RecordNarrativeSentence' && tc.arguments.sentence)
        .map(tc => tc.arguments.sentence);
        
    return { sentences };
};

// --- SPEECH & UTILITIES ---
const _translateTextBatch = async (runtime, { sentences, targetLanguage, onProgress }) => {
    if (!sentences || sentences.length === 0 || !targetLanguage || targetLanguage.toLowerCase().startsWith('en')) {
        return sentences.map(s => ({ original: s, translated: s }));
    }

    onProgress?.(\`[Chronicler] Translating \${sentences.length} sentences to \${targetLanguage}...\`);
    try {
        const targetLangName = new Intl.DisplayNames(['en'], { type: 'language' }).of(targetLanguage);
        const systemInstruction = \`You are an expert translator. Translate the given English sentences into \${targetLangName} (\${targetLanguage}). You MUST respond with ONLY a single, valid JSON object with a single key "translations" which is an array of strings. The array must have the exact same number of elements as the input array.\`;
        const prompt = \`Translate the following sentences into \${targetLangName}. Input sentences (JSON array): \${JSON.stringify(sentences)}\`;

        const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
        const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
        if (!jsonMatch) throw new Error("AI did not return a valid JSON object for translations. Raw: " + aiResponseText);
        
        const parsed = JSON.parse(jsonMatch[0]);
        const translations = parsed.translations;

        if (!Array.isArray(translations) || translations.length !== sentences.length) throw new Error(\`Translation array length mismatch. Expected \${sentences.length}, got \${translations.length}.\`);

        onProgress?.(\`[Chronicler] ...Translation complete.\`);
        return sentences.map((original, index) => ({ original: original, translated: translations[index] || original }));
    } catch (e) {
        onProgress?.(\`[Chronicler] ⚠️ Translation failed: \${e.message}. Using original English text.\`);
        return sentences.map(s => ({ original: s, translated: s }));
    }
};

const _speakText = (args) => {
    const { text, voiceName, lang } = args;
    if (!text || !text.trim()) return Promise.resolve({ success: true });

    return new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(text);
        if (lang) utterance.lang = lang;
        const voices = window.speechSynthesis.getVoices();
        if (voiceName) {
            const selectedVoice = voices.find(v => v.name === voiceName);
            if (selectedVoice) utterance.voice = selectedVoice;
        }
        utterance.rate = 1.1;

        let hasFinished = false;
        const safetyTimeout = setTimeout(() => {
            if (!hasFinished) {
                console.warn("Speech synthesis utterance timed out.");
                reject(new Error("Utterance timed out"));
            }
        }, 15000);

        utterance.onend = () => {
            hasFinished = true;
            clearTimeout(safetyTimeout);
            setTimeout(() => resolve({ success: true }), 50);
        };
        utterance.onerror = (event) => {
            hasFinished = true;
            clearTimeout(safetyTimeout);
            console.error("Speech synthesis error:", event.error);
            reject(new Error(event.error));
        };
        window.speechSynthesis.speak(utterance);
    });
};

const SpeakerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-300 animate-pulse flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);


// --- MAIN CHRONICLER COMPONENT ---
const ChroniclerView = ({ eventLog, runtime, selectedTtsVoice, selectedTtsLang, isChroniclerActive, isSwarmRunning, chroniclerFrequency, chroniclerVerbosity, taskPrompt: missionObjective, narrativeLog, setNarrativeLog, liveFeed }) => {
    const [currentlySpeakingLogIndex, setCurrentlySpeakingLogIndex] = React.useState(-1);

    const isProcessingRef = React.useRef(false);
    const isSpeakingRef = React.useRef(false);
    const speechQueueRef = React.useRef([]);
    const narrativeAgendaRef = React.useRef([]);
    const spokenSentencesRef = React.useRef(new Set());
    const logContainerRef = React.useRef(null);
    const logEndRef = React.useRef(null);

    // Refs to store props. This is the key to the fix.
    // By storing props in refs, we can use them inside the cognitive loop's useEffect
    // without adding them to its dependency array, preventing the effect from re-running on every render.
    const runtimeRef = React.useRef(runtime);
    const isSwarmRunningRef = React.useRef(isSwarmRunning);
    const liveFeedRef = React.useRef(liveFeed);
    const narrativeLogRef = React.useRef(narrativeLog);
    const missionObjectiveRef = React.useRef(missionObjective);
    const chroniclerVerbosityRef = React.useRef(chroniclerVerbosity);
    const chroniclerFrequencyRef = React.useRef(chroniclerFrequency);
    const selectedTtsLangRef = React.useRef(selectedTtsLang);
    const selectedTtsVoiceRef = React.useRef(selectedTtsVoice);
    const setNarrativeLogRef = React.useRef(setNarrativeLog);
    
    // These useEffects update the refs whenever the props change.
    React.useEffect(() => { runtimeRef.current = runtime; }, [runtime]);
    React.useEffect(() => { isSwarmRunningRef.current = isSwarmRunning; }, [isSwarmRunning]);
    React.useEffect(() => { liveFeedRef.current = liveFeed; }, [liveFeed]);
    React.useEffect(() => { narrativeLogRef.current = narrativeLog; }, [narrativeLog]);
    React.useEffect(() => { missionObjectiveRef.current = missionObjective; }, [missionObjective]);
    React.useEffect(() => { chroniclerVerbosityRef.current = chroniclerVerbosity; }, [chroniclerVerbosity]);
    React.useEffect(() => { chroniclerFrequencyRef.current = chroniclerFrequency; }, [chroniclerFrequency]);
    React.useEffect(() => { selectedTtsLangRef.current = selectedTtsLang; }, [selectedTtsLang]);
    React.useEffect(() => { selectedTtsVoiceRef.current = selectedTtsVoice; }, [selectedTtsVoice]);
    React.useEffect(() => { setNarrativeLogRef.current = setNarrativeLog; }, [setNarrativeLog]);


    React.useLayoutEffect(() => {
        logEndRef.current?.scrollIntoView({ block: 'end' });
    }, [narrativeLog]);
    
    const addThoughtToAgenda = (thought) => {
        if (!narrativeAgendaRef.current.some(t => t.id === thought.id)) {
            narrativeAgendaRef.current.push(thought);
        }
    };

    const processSpeechQueue = React.useCallback(async () => {
        if (isSpeakingRef.current || speechQueueRef.current.length === 0) return;
        isSpeakingRef.current = true;

        const { text, original } = speechQueueRef.current[0];
        const logIndexToSpeak = narrativeLogRef.current.findIndex(entry => entry.original === original);
        setCurrentlySpeakingLogIndex(logIndexToSpeak);
        
        try {
            await _speakText({ text, voiceName: selectedTtsVoiceRef.current, lang: selectedTtsLangRef.current });
        } catch (e) {
            console.error("Chronicler speech error:", e);
            runtimeRef.current.logEvent(\`[Chronicler] Speech synthesis failed: \${e.message}\`);
        } finally {
            speechQueueRef.current.shift();
            setCurrentlySpeakingLogIndex(-1);
            isSpeakingRef.current = false;
            setTimeout(processSpeechQueue, 50);
        }
    }, []);

    // --- THE COGNITIVE LOOP ---
    React.useEffect(() => {
        let timeoutId;

        const cognitiveLoop = async () => {
            if (isProcessingRef.current || !isChroniclerActive) {
                if (isChroniclerActive) timeoutId = setTimeout(cognitiveLoop, chroniclerFrequencyRef.current);
                return;
            }
            isProcessingRef.current = true;
            
            const onProgress = (message) => setNarrativeLogRef.current(prev => [...prev, { original: message, translated: null }]);

            try {
                const priority = { dossier: 100, hypothesis: 80, synergy: 60, source: 40, MissionIntro: 20, ExplainResearchProcess: 15, ExplainAppStructure: 18 };
                addThoughtToAgenda({ id: 'thought_intro', topic: 'MissionIntro', priority: priority.MissionIntro, status: 'pending' });
                addThoughtToAgenda({ id: 'thought_structure', topic: 'ExplainAppStructure', priority: priority.ExplainAppStructure, status: 'pending' });
                if (isSwarmRunningRef.current) {
                    addThoughtToAgenda({ id: 'thought_explain_research', topic: 'ExplainResearchProcess', priority: priority.ExplainResearchProcess, status: 'pending' });
                }

                liveFeedRef.current.forEach(item => {
                    const thoughtId = \`thought_\${item.type}_\${item.id}\`;
                    let topic = \`Explain\${item.type.charAt(0).toUpperCase() + item.type.slice(1)}\`;
                    let thoughtPriority = priority[item.type];
                    if(item.type === 'synergy' && item.data.status?.includes('De Novo')) {
                        topic = 'ExplainHypothesis';
                        thoughtPriority = priority.hypothesis;
                    }
                    if (thoughtPriority) addThoughtToAgenda({ id: thoughtId, topic, priority: thoughtPriority, content: item, status: 'pending' });
                });

                const pendingThoughts = narrativeAgendaRef.current.filter(t => t.status === 'pending');
                if (pendingThoughts.length === 0) return;
                
                const dossiersInFeed = liveFeedRef.current.some(item => item.type === 'dossier');
                pendingThoughts.sort((a, b) => {
                    const getDynamicPriority = (thought) => {
                        if (dossiersInFeed) return thought.topic === 'ExplainDossier' ? 1000 : thought.priority;
                        return thought.topic === 'MissionIntro' ? 1000 : thought.topic === 'ExplainAppStructure' ? 900 : thought.topic === 'ExplainResearchProcess' ? 800 : thought.priority;
                    };
                    return getDynamicPriority(b) - getDynamicPriority(a);
                });

                const thoughtToProcess = pendingThoughts[0];
                const thoughtIndex = narrativeAgendaRef.current.findIndex(t => t.id === thoughtToProcess.id);
                if(thoughtIndex !== -1) narrativeAgendaRef.current[thoughtIndex].status = 'processed';

                const generationResult = await _generateNarrativeSentences(runtimeRef.current, {
                    thought: thoughtToProcess,
                    missionObjective: missionObjectiveRef.current,
                    spokenHistory: Array.from(spokenSentencesRef.current),
                    onProgress,
                    verbosity: chroniclerVerbosityRef.current,
                });

                const originalSentences = generationResult.sentences;
                if (originalSentences.length > 0) {
                    const uniqueNewSentences = originalSentences.filter(s => !spokenSentencesRef.current.has(s));
                    if (uniqueNewSentences.length > 0) {
                        uniqueNewSentences.forEach(s => spokenSentencesRef.current.add(s));
                        const translationResult = await _translateTextBatch(runtimeRef.current, { sentences: uniqueNewSentences, targetLanguage: selectedTtsLangRef.current, onProgress });
                        const logEntries = translationResult.map(res => ({ original: res.original, translated: (res.translated !== res.original && !selectedTtsLangRef.current.toLowerCase().startsWith('en')) ? res.translated : null }));
                        setNarrativeLogRef.current(prev => [...prev, ...logEntries]);
                        const sentencesToSpeak = translationResult.map(res => ({ text: res.translated, original: res.original, translated: res.translated }));
                        speechQueueRef.current.push(...sentencesToSpeak);
                        processSpeechQueue();
                    }
                }
            } catch (e) {
                console.error("[Chronicler] Cognitive loop error:", e);
                runtimeRef.current.logEvent(\`[Chronicler] ERROR: Narration cycle failed. \${e.message}\`);
            } finally {
                isProcessingRef.current = false;
                if (isChroniclerActive) timeoutId = setTimeout(cognitiveLoop, chroniclerFrequencyRef.current);
            }
        };
        
        if (isChroniclerActive) {
            cognitiveLoop();
        }
        
        return () => clearTimeout(timeoutId);
    }, [isChroniclerActive, processSpeechQueue]);
    
    React.useEffect(() => {
        if (!isChroniclerActive) {
            window.speechSynthesis.cancel();
            speechQueueRef.current = [];
            return;
        }
        const keepAliveId = setInterval(() => {
            if (!window.speechSynthesis.speaking && speechQueueRef.current.length === 0 && !isSpeakingRef.current) {
                const utterance = new SpeechSynthesisUtterance('');
                utterance.volume = 0;
                window.speechSynthesis.speak(utterance);
            }
        }, 12000);
        return () => clearInterval(keepAliveId);
    }, [isChroniclerActive]);

    return (
        <div ref={logContainerRef} className="fixed bottom-0 left-0 right-0 h-32 bg-black/60 backdrop-blur-md border-t border-purple-500/50 p-4 z-50 font-mono text-purple-200 overflow-y-auto" role="log">
            <h4 className="font-bold text-sm mb-2 sticky top-0 bg-black/60">[Ship's Log]</h4>
            <div className="text-sm space-y-2">
                {narrativeLog.map((entry, i) => (
                    <p key={i} className={\`animate-fade-in flex items-start gap-2 \${i === currentlySpeakingLogIndex ? 'text-purple-100 font-semibold' : ''}\`}>
                        <span className="text-purple-400">{i === currentlySpeakingLogIndex ? <SpeakerIcon/> : '>'}</span>
                        <span className="flex-grow">
                            {entry.original}
                            {entry.translated && <span className="block text-sm text-purple-300/70 italic pl-4">{\`-> [\${selectedTtsLang}] \${entry.translated}\`}</span>}
                        </span>
                    </p>
                ))}
                 {narrativeLog.length === 0 && <p className="text-purple-400/50">&gt; Awaiting significant events...</p>}
                <div ref={logEndRef} />
            </div>
        </div>
    );
};
`
