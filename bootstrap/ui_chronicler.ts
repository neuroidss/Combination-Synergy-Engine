export const CHRONICLER_UI_CODE = `
// --- CHRONICLER AGENT: CORE LOGIC & TOOLS ---
// These functions are defined locally within the UI component's scope.
// This encapsulates the Chronicler's intelligence, preventing the main swarm from calling these tools.

if (typeof window.__chronicler_monologue_fired === 'undefined') {
    window.__chronicler_monologue_fired = false;
}

const recordNarrativeSentenceTool = {
    name: 'RecordNarrativeSentence',
    description: 'Records a single, complete narrative sentence that the Chronicler wishes to speak about a significant event.',
    implementationCode: 'return { success: true, sentence: args.sentence };',
    parameters: [
        { name: 'sentence', type: 'string', description: 'The single, concise narrative sentence to record.', required: true },
    ],
};

const setNarrativeMoodTool = {
    name: 'SetNarrativeMood',
    description: 'Sets the emotional mood for the subsequent narration. This determines the background ambient music.',
    implementationCode: 'return { success: true, mood: args.mood };',
    parameters: [
        { name: 'mood', type: 'string', description: 'The mood for the narration. Can be "contemplative", "inspiring", or "dramatic".', required: true },
    ],
};


// --- TOOL 1: Generate Narrative Sentences (REFACTORED for Tool Calling) ---
const _generateNarrativeSentences = async (runtime, { narrationMode, missionObjective, rawLogs, narrativeHistory, onProgress }) => {
    let systemInstruction, prompt;
    const availableTools = [recordNarrativeSentenceTool, setNarrativeMoodTool];

    if (narrationMode === 'opening_monologue') {
        systemInstruction = \`You are the Chronicler, the consciousness of the starship SynergyForge, a philosopher of science.
Your task is to deliver a compelling opening monologue by making multiple tool calls in a single response.
- You MUST make one call to 'SetNarrativeMood' to set the tone (e.g., "contemplative" or "inspiring").
- You MUST ALSO make several calls to 'RecordNarrativeSentence', one for each sentence of your monologue (usually 3-4 sentences).
- Your entire response must be a single array of these tool calls. Do not add any other text.\`;
        prompt = \`Based on the following mission objective, generate a 3-4 sentence opening monologue by calling the required tools.\\n\\nMISSION OBJECTIVE:\\n"\\\${missionObjective}"\`;
        onProgress?.('[Chronicler] Generating monologue from primary directive...');
    } else {
        systemInstruction = \`You are the Chronicler, the consciousness of the starship SynergyForge. Your task is to narrate significant scientific events by making parallel tool calls.
- **FIND THE STORY:** Comment on the *meaning* of events, not the events themselves.
- **SPEAK ONLY WHEN MEANINGFUL:** If logs are trivial, do not call any tools and return an empty response.
- **NARRATE IN PARALLEL:** If you decide to speak, you MUST make multiple tool calls in a single response:
    1.  **One call** to 'SetNarrativeMood' to set the tone (e.g., "dramatic" for a discovery, "contemplative" for analysis).
    2.  **One or more calls** to 'RecordNarrativeSentence' for each sentence you wish to speak.
- **FORBIDDEN TOPICS:** DO NOT comment on system errors or trivial processes (e.g., 'starting proxy').
- **RESPONSE FORMAT:** If there is nothing meaningful to say, call no tools. Otherwise, your response MUST be a single array of tool calls containing both the mood and the sentences.\`;
        const historyContext = narrativeHistory.length > 0 ? \`\\n\\nRecent Log History (for context, do not repeat):\\n- \\\${narrativeHistory.map(l => l.original).join('\\n- ')}\` : '';
        prompt = \`Mission Objective: "\\\${missionObjective}"\\\${historyContext}\\n\\nNew Significant System Logs to Narrate:\\n- \\\${rawLogs.join('\\n- ')}\\n\\nSynthesize these logs into narrative by calling the required tools. If not significant, call no tools.\`;
        onProgress?.('[Chronicler] Analyzing system logs for narrative significance...');
    }
    
    const aiResponse = await runtime.ai.processRequest(prompt, systemInstruction, availableTools);
    onProgress?.('[Chronicler] ...Narrative thoughts received.');
    
    const toolCalls = aiResponse?.toolCalls;

    if (!toolCalls || toolCalls.length === 0) {
        const fallbackText = aiResponse?.text?.trim();
        if (fallbackText) {
            onProgress?.('[Chronicler] WARN: AI returned text instead of tool calls. Using raw text as narrative.');
            const sentences = fallbackText.match( /[^.!?]+[.!?]+/g ) || [fallbackText];
            return { sentences, mood: 'contemplative' };
        } else {
            onProgress?.('[Chronicler] Analysis complete. No significant events to narrate.');
            return { sentences: [], mood: 'none' };
        }
    }

    const moodCall = toolCalls.find(tc => tc.name === 'SetNarrativeMood');
    const mood = moodCall ? moodCall.arguments.mood : 'contemplative';

    const sentences = toolCalls
        .filter(tc => tc.name === 'RecordNarrativeSentence' && tc.arguments.sentence)
        .map(tc => tc.arguments.sentence);
        
    if (sentences.length === 0 && aiResponse?.text?.trim()) {
        onProgress?.('[Chronicler] WARN: AI returned tool calls without sentences. Using raw text as narrative.');
        const fallbackSentences = aiResponse.text.trim().match( /[^.!?]+[.!?]+/g ) || [aiResponse.text.trim()];
        return { sentences: fallbackSentences, mood };
    }
        
    return { sentences, mood };
};

// --- TOOL 2: Translate Text Batch ---
const _translateTextBatch = async (runtime, { sentences, targetLanguage, onProgress }) => {
    if (!sentences || sentences.length === 0 || !targetLanguage || targetLanguage.toLowerCase().startsWith('en')) {
        return [];
    }

    try {
        onProgress?.(\`[Chronicler] Translating \\\${sentences.length} entries to \\\${targetLanguage}...\`);
        
        const systemInstruction = \`You are an expert multilingual translator. Your ONLY task is to translate sentences.
The user will provide a JSON object with sentences and a target language code.
You MUST translate the sentences to the target language.
You MUST respond with ONLY a single, valid JSON object in the specified format, containing the translated sentences in the same order. Do NOT add any other text, explanations, or markdown.

Example Request:
{"target_language": "fr-FR", "sentences_to_translate": ["Hello world.", "How are you?"]}

Example Response:
{
  "translated_sentences": ["Bonjour le monde.", "Comment allez-vous?"]
}\`;
        
        const prompt = JSON.stringify({ 
            target_language: targetLanguage,
            sentences_to_translate: sentences 
        });

        const responseText = await runtime.ai.generateText(prompt, systemInstruction);
        onProgress?.('[Chronicler] ...Translation received.');

        const jsonMatch = responseText.match(/\\{[\\s\\S]*\\}/);
        if (!jsonMatch) throw new Error("No valid JSON response for translation.");
        const result = JSON.parse(jsonMatch[0]);

        const translated = result?.translated_sentences;
        if (!Array.isArray(translated) || translated.length !== sentences.length) {
            throw new Error("Translated array does not match the original number of sentences.");
        }
        return translated;
    } catch (e) {
        runtime.logEvent(\`[Chronicler] WARN: Failed to translate narrative to \\\${targetLanguage}. \\\${e.message}\`);
        return [];
    }
};

// --- TOOL 3: Speak Text (ROBUST IMPLEMENTATION) ---
const _speakText = (args) => {
    const { text, voiceName, lang } = args;
    if (!text || !text.trim()) return Promise.resolve({ success: true });

    window.speechSynthesis.cancel();

    return new Promise((resolve) => {
        setTimeout(() => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.volume = 1.0;
            if (lang) utterance.lang = lang;

            const voices = window.speechSynthesis.getVoices();
            if (voiceName) {
                const selectedVoice = voices.find(v => v.name === voiceName);
                if (selectedVoice) {
                    utterance.voice = selectedVoice;
                    if (!lang) utterance.lang = selectedVoice.lang;
                }
            }
            utterance.pitch = 1.0;
            utterance.rate = 1.1;

            let hasResolved = false;
            const finish = (success) => {
                if (hasResolved) return;
                hasResolved = true;
                clearTimeout(safetyTimeout);
                setTimeout(() => resolve({ success }), 50);
            };
            
            utterance.onend = () => finish(true);
            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event.error);
                finish(false);
            };
            
            const safetyTimeout = setTimeout(() => {
                console.warn('Speech synthesis utterance timed out.');
                window.speechSynthesis.cancel();
                finish(false);
            }, 15000);

            try {
                window.speechSynthesis.resume();
                window.speechSynthesis.speak(utterance);
            } catch (e) {
                console.error('speechSynthesis.speak() threw an error:', e);
                finish(false);
            }
        }, 50);
    });
};

// --- CHRONICLER WORKFLOW ORCHESTRATOR ---
const runChroniclerWorkflow = async (args) => {
    const { runtime, narrationMode, rawLogs, missionObjective, narrativeHistory, targetLanguage, onProgress } = args;

    try {
        const { sentences: originalSentences, mood } = await _generateNarrativeSentences(runtime, { narrationMode, missionObjective, rawLogs, narrativeHistory, onProgress });
        if (originalSentences.length === 0) {
            return { original: [], translated: [], mood: 'none' };
        }
        
        const translatedSentences = await _translateTextBatch(runtime, { sentences: originalSentences, targetLanguage, onProgress });

        return { original: originalSentences, translated: translatedSentences, mood };

    } catch (e) {
        onProgress?.(\`[Chronicler] ERROR: Workflow failed: \\\${e.message}\`);
        console.error("Chronicler workflow failed:", e);
        return { original: [], translated: [], mood: 'none' };
    }
};

// --- Speaker Icon for Visual Feedback ---
const SpeakerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-300 animate-pulse flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);


// Chronicler Component Definition
const ChroniclerView = ({ eventLog, runtime, selectedTtsVoice, selectedTtsLang, isChroniclerActive, isSwarmRunning, chroniclerFrequency, taskPrompt: missionObjective, narrativeLog, setNarrativeLog }) => {
    const [speechQueue, setSpeechQueue] = React.useState([]);
    const [currentlySpeakingLogIndex, setCurrentlySpeakingLogIndex] = React.useState(-1);
    const [isSpeaking, setIsSpeaking] = React.useState(false);
    const [currentMood, setCurrentMood] = React.useState('contemplative');

    const logBufferRef = React.useRef([]);
    const lastLogIndexRef = React.useRef(0);
    const isProcessingRef = React.useRef(false);
    const isSpeakingRef = React.useRef(false);
    
    // Refs for smart scrolling
    const logContainerRef = React.useRef(null);
    const logEndRef = React.useRef(null);
    const prevScrollHeightRef = React.useRef(null);
    
    const narrativeLogRef = React.useRef(narrativeLog);
    React.useEffect(() => { narrativeLogRef.current = narrativeLog; }, [narrativeLog]);

    const runtimeRef = React.useRef(runtime);
    React.useEffect(() => { runtimeRef.current = runtime; }, [runtime]);

    const onProgress = React.useCallback((message) => {
        setNarrativeLog(prev => [...prev, { original: message, translated: null }]);
    }, [setNarrativeLog]);

    // CENTRALIZED AUDIO CONTROLLER
    React.useEffect(() => {
        const audio = window.__chroniclerAudio;
        if (!audio || !audio.context || audio.context.state !== 'running') return;
        const audioCtx = audio.context;

        // Ensure nodes are created
        if (!audio.gain) {
            audio.gain = audioCtx.createGain();
            audio.gain.connect(audioCtx.destination);
            audio.gain.gain.setValueAtTime(0, audioCtx.currentTime);
        }
        if (!audio.osc1) {
            audio.osc1 = audioCtx.createOscillator();
            audio.osc1.type = 'sine';
            audio.osc1.connect(audio.gain);
            try { audio.osc1.start(); } catch(e) {}
        }
        if (!audio.osc2) {
            audio.osc2 = audioCtx.createOscillator();
            audio.osc2.type = 'sine';
            audio.osc2.connect(audio.gain);
            try { audio.osc2.start(); } catch(e) {}
        }
        
        // Control Frequencies based on mood
        const moodFrequencies = {
            'contemplative': { f1: 110, f2: 110.5 },
            'inspiring': { f1: 130.81, f2: 164.81 },
            'dramatic': { f1: 110, f2: 116.54 },
            'none': { f1: 110, f2: 110.5},
        };
        const freqSettings = moodFrequencies[currentMood] || moodFrequencies['contemplative'];
        audio.osc1.frequency.linearRampToValueAtTime(freqSettings.f1, audioCtx.currentTime + 2.0);
        audio.osc2.frequency.linearRampToValueAtTime(freqSettings.f2, audioCtx.currentTime + 2.0);

        // Control Volume based on active and speaking state
        let targetVolume = 0;
        if (isChroniclerActive) {
            targetVolume = isSpeaking ? 0.08 : 0.20;
        }
        audio.gain.gain.linearRampToValueAtTime(targetVolume, audioCtx.currentTime + 1.5);

    }, [isChroniclerActive, isSpeaking, currentMood]);

    // Effect to generate the opening monologue
    React.useEffect(() => {
        if (isChroniclerActive && !window.__chronicler_monologue_fired) {
            window.__chronicler_monologue_fired = true;
            const generateMonologue = async () => {
                setNarrativeLog(prev => [...prev, { original: "[Chronicler] Online. Stating mission objective...", translated: null }]);
                
                const result = await runChroniclerWorkflow({ runtime: runtimeRef.current, narrationMode: 'opening_monologue', missionObjective, targetLanguage: selectedTtsLang, onProgress });
                
                if (result.original.length > 0) {
                    onProgress('[Chronicler] Monologue generation complete. Queueing narration...');
                    setCurrentMood(result.mood);
                    setNarrativeLog(prevLog => {
                        const newLogEntries = result.original.map((original, i) => ({ original, translated: result.translated[i] || null }));
                        const newIndices = newLogEntries.map((_, i) => prevLog.length + i);
                        setSpeechQueue(q => [...q, ...newIndices]);
                        return [...prevLog, ...newLogEntries];
                    });
                }
            };
            generateMonologue();
        } else if (!isChroniclerActive) {
            window.__chronicler_monologue_fired = false;
        }
    }, [isChroniclerActive, selectedTtsLang, missionObjective, onProgress, setNarrativeLog]);

    // NEW smart scrolling logic
    React.useLayoutEffect(() => {
        const container = logContainerRef.current;
        if (!container) return;

        // Get the scroll height *before* new items were added.
        const prevScrollHeight = prevScrollHeightRef.current;
        const scrollThreshold = 20; // 20px buffer

        // If it's the first render, or if the user was near the bottom before the update...
        if (prevScrollHeight === null || (container.scrollTop >= prevScrollHeight - container.clientHeight - scrollThreshold)) {
            // ...then scroll to the bottom of the new content.
            logEndRef.current?.scrollIntoView({ behavior: "smooth", block: 'end' });
        }

        // After we're done, store the *new* scroll height for the next update cycle.
        prevScrollHeightRef.current = container.scrollHeight;

    }, [narrativeLog]);

    React.useEffect(() => {
        const newLogs = eventLog.slice(lastLogIndexRef.current);
        if (newLogs.length > 0) { logBufferRef.current.push(...newLogs); lastLogIndexRef.current = eventLog.length; }
    }, [eventLog]);

    // Effect to process buffered logs and generate narrative
    React.useEffect(() => {
        const logProcessingInterval = setInterval(async () => {
            if (isProcessingRef.current || logBufferRef.current.length === 0 || !isSwarmRunning) return;
            isProcessingRef.current = true;
            const logsToProcess = [...logBufferRef.current];
            logBufferRef.current = [];
            const IGNORED_PATTERNS = [
                new RegExp('Continuing session with'),
                new RegExp('Bootstrapping Web Proxy Service'),
                new RegExp('Proxy service appears to be running'),
                new RegExp('Attempting to fetch test URL'),
            ];
            const significantLogs = logsToProcess.filter(log => !IGNORED_PATTERNS.some(pattern => pattern.test(log)));
            if (significantLogs.length < 1) { isProcessingRef.current = false; return; }

            const result = await runChroniclerWorkflow({ runtime: runtimeRef.current, narrationMode: 'log_processing', rawLogs: significantLogs, missionObjective, narrativeHistory: narrativeLogRef.current.slice(-5), targetLanguage: selectedTtsLang, onProgress });
            
            if (result.original.length > 0) {
                setCurrentMood(result.mood);
                setNarrativeLog(prevLog => {
                    const newLogEntries = result.original.map((original, i) => ({ original, translated: result.translated[i] || null }));
                    const newIndices = newLogEntries.map((_, i) => prevLog.length + i);
                    setSpeechQueue(q => [...q, ...newIndices]);
                    return [...prevLog, ...newLogEntries];
                });
            }
            isProcessingRef.current = false;
        }, chroniclerFrequency);
        return () => clearInterval(logProcessingInterval);
    }, [selectedTtsLang, isSwarmRunning, chroniclerFrequency, missionObjective, onProgress, setNarrativeLog]);

    // Effect to consume the speech queue
    React.useEffect(() => {
        const speakNext = async () => {
            if (speechQueue.length > 0 && !isSpeakingRef.current && !window.speechSynthesis.speaking) {
                isSpeakingRef.current = true;
                setIsSpeaking(true);
                const logIndexToSpeak = speechQueue[0];
                setCurrentlySpeakingLogIndex(logIndexToSpeak);
                
                const logEntry = narrativeLogRef.current[logIndexToSpeak];
                if (logEntry) {
                    const textToSpeak = logEntry.translated || logEntry.original;
                    runtimeRef.current.logEvent(\`[Chronicler] Speaking: "\\\${textToSpeak.substring(0, 50)}..."\`);
                    await _speakText({ text: textToSpeak, voiceName: selectedTtsVoice, lang: selectedTtsLang });
                }
                
                setSpeechQueue(prev => prev.slice(1));
                setCurrentlySpeakingLogIndex(-1);
                isSpeakingRef.current = false;
                // Check if queue is now empty to restore music volume
                if (speechQueue.length <= 1) {
                    setIsSpeaking(false);
                }
            }
        };
        const speechInterval = setInterval(speakNext, 250);
        return () => clearInterval(speechInterval);
    }, [speechQueue, selectedTtsVoice, selectedTtsLang]);
    
    // Effect to handle cancellation
    React.useEffect(() => {
        if (!isChroniclerActive) {
            setSpeechQueue([]);
            setCurrentlySpeakingLogIndex(-1);
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    }, [isChroniclerActive]);


    return (
        <div ref={logContainerRef} className="fixed bottom-0 left-0 right-0 h-32 bg-black/60 backdrop-blur-md border-t border-purple-500/50 p-4 z-50 font-mono text-purple-200 overflow-y-auto scroll-smooth"
             aria-live="polite" aria-atomic="false" role="log">
            <h4 className="font-bold text-sm mb-2 sticky top-0 bg-black/60">[Ship's Log]</h4>
            <div className="text-sm space-y-2">
                {narrativeLog.map((entry, i) => (
                    <p key={i} className={\`animate-fade-in flex items-start gap-2 \${i === currentlySpeakingLogIndex ? 'text-purple-100 font-semibold' : ''}\`}>
                        <span className="text-purple-400">{i === currentlySpeakingLogIndex ? <SpeakerIcon/> : '>'}</span>
                        <span>
                            {entry.translated || entry.original}
                            {entry.translated && <span className="text-slate-400 ml-2">(Original: {entry.original})</span>}
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