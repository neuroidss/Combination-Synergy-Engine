
import type { ToolCreatorPayload } from '../types';

export const ANALYSIS_TOOLS: ToolCreatorPayload[] = [
    {
        name: 'Chunk and Embed Scientific Articles',
        description: 'Processes the full text of validated scientific articles, breaking them into smaller, semantically meaningful chunks and converting each chunk into a vector embedding. This creates a "Semantic Knowledge Space" for conceptual search.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To transform a corpus of text documents into a machine-readable vector database, enabling similarity searches based on meaning rather than keywords.',
        parameters: [
            { name: 'validatedSources', type: 'array', description: 'An array of validated source objects, which must include a `textContent` field.', required: true },
        ],
        implementationCode: `
    const { validatedSources } = args;
    if (!validatedSources || validatedSources.length === 0) {
        return { success: true, vectorDB: [] };
    }

    const allChunks = [];
    const minChunkSize = 200; // characters
    const maxChunkSize = 800; // characters

    for (const source of validatedSources) {
        if (!source.textContent) continue;

        const paragraphs = source.textContent.split(/\\n\\s*\\n/);
        for (const para of paragraphs) {
            if (para.length < minChunkSize) continue;
            
            // If paragraph is too long, split it into sentences
            if (para.length > maxChunkSize) {
                const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
                let currentChunk = '';
                for (const sentence of sentences) {
                    if (currentChunk.length + sentence.length > maxChunkSize) {
                        allChunks.push({ text: currentChunk.trim(), sourceUri: source.url });
                        currentChunk = '';
                    }
                    currentChunk += sentence + ' ';
                }
                if (currentChunk.trim().length > minChunkSize) {
                    allChunks.push({ text: currentChunk.trim(), sourceUri: source.url });
                }
            } else {
                allChunks.push({ text: para.trim(), sourceUri: source.url });
            }
        }
    }

    if (allChunks.length === 0) {
        runtime.logEvent('[Embedder] No suitable text chunks found in sources for embedding.');
        return { success: true, vectorDB: [] };
    }
    
    runtime.logEvent(\`[Embedder] Created \${allChunks.length} text chunks. Now generating embeddings...\`);

    // Batch embedding for efficiency
    const chunkTexts = allChunks.map(c => c.text);
    const embeddings = await runtime.ai.generateEmbeddings(chunkTexts);

    const vectorDB = allChunks.map((chunk, index) => ({
        ...chunk,
        embedding: embeddings[index],
    }));

    runtime.logEvent(\`[Embedder] ✅ Successfully created vector database with \${vectorDB.length} entries.\`);
    return { success: true, vectorDB };
    `
    },
    {
        name: 'Hypothesis Generator via Conceptual Search',
        description: 'Performs a semantic search over a vector database of scientific text to find text chunks related to a conceptual query. It then uses an AI to synthesize a novel, de novo hypothesis from these disparate chunks and records it.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To generate completely new scientific hypotheses by finding non-obvious connections between pieces of information that may not be co-located in any single document.',
        parameters: [
            { name: 'conceptualQuery', type: 'string', description: 'The high-level conceptual question to investigate (e.g., "Find interventions that boost autophagy without affecting mTOR").', required: true },
            { name: 'vectorDB', type: 'array', description: 'The vector database created by the "Chunk and Embed" tool.', required: true },
        ],
        implementationCode: `
    const { conceptualQuery, vectorDB } = args;

    if (!vectorDB || vectorDB.length === 0) {
        throw new Error("Vector database is empty or not provided.");
    }

    const cosineSimilarity = (vecA, vecB) => {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
        let dotProduct = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
        }
        return dotProduct;
    };

    runtime.logEvent(\`[Hypothesizer] Searching for concepts related to: "\${conceptualQuery}"\`);
    const [queryEmbedding] = await runtime.ai.generateEmbeddings([conceptualQuery]);

    const scoredChunks = vectorDB.map(chunk => ({
        ...chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
    })).sort((a, b) => b.score - a.score);

    const topK = 10;
    const similarityThreshold = 0.5;
    const relevantChunks = scoredChunks.filter(c => c.score > similarityThreshold).slice(0, topK);

    if (relevantChunks.length < 3) {
        runtime.logEvent(\`[Hypothesizer] Found only \${relevantChunks.length} relevant chunks. Not enough to form a strong hypothesis. Skipping.\`);
        return { success: true, synergy: null };
    }
    
    runtime.logEvent(\`[Hypothesizer] Found \${relevantChunks.length} relevant text chunks. Synthesizing hypothesis...\`);

    const contextForSynthesis = relevantChunks.map((c, i) => \`EVIDENCE \${i+1} (Source: \${c.sourceUri}, Similarity: \${c.score.toFixed(3)}):\\n"\${c.text}"\`).join('\\n\\n');

    const systemInstruction = \`You are an expert bioinformatics researcher with a talent for synthesizing novel hypotheses from disparate data.
Your task is to analyze the provided text fragments from multiple scientific papers and formulate a NEW synergistic therapeutic hypothesis that addresses the user's conceptual query.
Then, you MUST call the 'RecordSynergy' tool to record your finding.

**CRITICAL INSTRUCTIONS for the tool call:**
1.  **combination**: Propose a specific combination of interventions (drugs, behaviors, etc.).
2.  **status**: This MUST be set to "Hypothesized (De Novo)".
3.  **summary**: Clearly explain your novel hypothesis and the scientific rationale based on the provided evidence.
4.  **potentialRisks**: Extrapolate potential risks based on the mechanisms discussed in the evidence.

Your entire response MUST be a single 'RecordSynergy' tool call. Do not add any other text.\`;
    
    const prompt = \`Conceptual Query: "\${conceptualQuery}"\\n\\nRelevant Evidence from Literature:\\n\${contextForSynthesis}\`;
    
    const recordSynergyTool = runtime.tools.list().find(t => t.name === 'RecordSynergy');
    if (!recordSynergyTool) throw new Error("Core tool 'RecordSynergy' not found.");

    const aiResponse = await runtime.ai.processRequest(prompt, systemInstruction, [recordSynergyTool]);
    
    const toolCall = aiResponse?.toolCalls?.[0];
    if (!toolCall || toolCall.name !== 'RecordSynergy') {
        let errorMsg = "Hypothesis synthesis AI failed to call 'RecordSynergy' tool.";
        if (aiResponse && aiResponse.text) errorMsg += \` AI Response: \${aiResponse.text}\`;
        throw new Error(errorMsg);
    }
    
    // The RecordSynergy tool will log the data. We return its result.
    const result = await runtime.tools.run('RecordSynergy', toolCall.arguments);
    runtime.logEvent(\`[Hypothesizer] ✅ Successfully generated and recorded new de novo hypothesis.\`);
    return result;
    `
    },
    {
        name: 'Identify Meta-Analyses',
        description: 'Analyzes a list of validated scientific sources to classify them as either meta-analyses/reviews or primary studies by calling the appropriate recording tool for each source.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To identify high-level summary articles (meta-analyses, systematic reviews) which can serve as a foundation for further "cutting-edge" research by classifying each source individually via tool calls.',
        parameters: [
            { name: 'validatedSources', type: 'array', description: 'The array of validated source objects to classify.', required: true },
        ],
        implementationCode: `
        const { validatedSources } = args;
        if (!validatedSources || validatedSources.length === 0) {
            return { success: true, metaAnalyses: [], primaryStudies: [] };
        }

        runtime.logEvent(\`[Classifier] Starting classification for \${validatedSources.length} sources one-by-one...\`);
        const metaAnalyses = [];
        const primaryStudies = [];
        const failedSources = [];

        const recordMetaTool = runtime.tools.list().find(t => t.name === 'RecordMetaAnalysis');
        const recordPrimaryTool = runtime.tools.list().find(t => t.name === 'RecordPrimaryStudy');
        if (!recordMetaTool || !recordPrimaryTool) throw new Error("Core classification recorder tools not found.");

        const systemInstruction = \`You are a binary classification expert. Your task is to classify a scientific article as either a "Meta-Analysis/Review" or a "Primary Study".
- "Meta-Analysis/Review" summarizes existing research (e.g., titles with "review", "meta-analysis", "systematic review").
- "Primary Study" presents new data from a specific experiment.
- You MUST respond with ONLY a single, valid JSON object in the following format:
{ "classification": "Meta-Analysis/Review" } OR { "classification": "Primary Study" }
Do not add any other text or markdown.\`;

        for (const source of validatedSources) {
            try {
                const sourceContext = \`<SOURCE>\\n<TITLE>\${source.title}</TITLE>\\n<SUMMARY>\${source.summary}</SUMMARY>\\n</SOURCE>\`;
                const prompt = \`Classify the following article:\\n\\n\${sourceContext}\`;
                
                const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("No JSON object found in response.");
                
                const parsed = JSON.parse(jsonMatch[0]);
                const classification = parsed.classification;

                if (classification === 'Meta-Analysis/Review') {
                    const result = await runtime.tools.run('RecordMetaAnalysis', { source });
                    metaAnalyses.push(result.metaAnalysis);
                } else if (classification === 'Primary Study') {
                    const result = await runtime.tools.run('RecordPrimaryStudy', { source });
                    primaryStudies.push(result.primaryStudy);
                } else {
                    throw new Error(\`Unexpected classification value: \${classification}\`);
                }
            } catch (e) {
                runtime.logEvent(\`[Classifier] ⚠️ Error classifying source "\${source.title.substring(0, 40)}...": \${e.message}. Defaulting to Primary Study.\`);
                // Fallback: Assume it's a primary study if classification fails
                const result = await runtime.tools.run('RecordPrimaryStudy', { source });
                primaryStudies.push(result.primaryStudy);
                failedSources.push(source);
            }
            await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
        }

        runtime.logEvent(\`[Classifier] ✅ Classified sources: \${metaAnalyses.length} meta-analyses, \${primaryStudies.length} primary studies. (\${failedSources.length} failed classification and defaulted).\`);
        return { success: true, metaAnalyses, primaryStudies };
    `
    },
    {
        name: 'Analyze Single Source for Synergies',
        description: 'Analyzes a single validated scientific source to identify potential synergistic combinations. It then performs a multi-layered scoring analysis, including Mechanism of Action (MoA) complementarity and alignment with biological aging theories, to calculate a final "Trial Priority Score".',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To perform focused, granular scientific analysis on one source at a time, including multi-faceted scoring, enabling a streaming research workflow that prioritizes the most promising interventions.',
        parameters: [
            { name: 'sourceToAnalyze', type: 'object', description: 'The single validated source object to be analyzed.', required: true },
            { name: 'researchObjective', type: 'string', description: 'The original research objective to focus the analysis.', required: true },
            { name: 'metaAnalyses', type: 'array', description: 'Optional array of sources identified as meta-analyses, to provide context.', required: false },
        ],
        implementationCode: `
        const { sourceToAnalyze: source, researchObjective, metaAnalyses = [] } = args;
        if (!source || !source.title) {
            return { success: true, synergies: [] };
        }
        
        const foundSynergies = [];

        try {
            const sourceContext = \`<SOURCE>\\n<TITLE>\${source.title}</TITLE>\\n<RELIABILITY>\${source.reliabilityScore}</RELIABILITY>\\n<SUMMARY>\${source.summary}</SUMMARY>\\n</SOURCE>\`;

            let systemInstruction = \`You are an expert bioinformatics researcher tasked with **extracting any and all potential combinations of interventions** from a scientific article. Your goal is to maximize recall; subsequent steps will filter for quality.

**Intervention Categories:**
- **Drug**: Molecules, supplements, organic compounds.
- **Device**: Hardware, inorganic tools, mechanical/electronic devices.
- **Behavior**: Lifestyle changes, habits, diets, exercise.

**Your Task:**
Read the provided source and identify **every mention** of two or more interventions being used together, discussed in combination, or proposed as a combined therapy. Look for keywords like "combination", "co-administration", "adjunctive", "and", "with", "plus".

For **each distinct combination** you find, you MUST call the 'RecordSynergy' tool. You are expected to call this tool multiple times if multiple combinations are found. This is a core requirement.

**For each \\\`RecordSynergy\\\` tool call:**
1.  **Combination**: Identify the interventions by name AND type. This MUST be an array of objects. Example: \\\`[{"name": "Metformin", "type": "drug"}, {"name": "Exercise", "type": "behavior"}]\\\`.
2.  **Interaction Type**: Determine if the source describes the interaction as 'Synergistic' (effect is greater than sum of parts), 'Additive' (effects sum up), or 'Antagonistic' (effects cancel out). If the nature isn't specified, default to 'Additive'.
3.  **Status**: Determine if the source presents this as a 'Known' combination (already studied) or a 'Hypothesized' one (a proposal for future study). If unsure, default to 'Hypothesized'.
4.  **Rationale**: Provide a scientific rationale based *directly* on the text in the source.
5.  **Risks**: CRITICALLY ASSESS and clearly state any potential risks or contraindications mentioned in the source. If none are mentioned, state "None mentioned in source".

**CRITICAL RULES:**
1. If you find no combinations, do not call any tools and respond with an empty text message.
2. If you find one or more combinations, your entire response MUST consist of only tool calls. Do not add any text before, between, or after the tool calls. For example, if you find three combinations, your response must be three separate calls to the 'RecordSynergy' tool.\`;

            let analysisPrompt = 'Based on the research objective "' + researchObjective + '" and the following source, identify all potential synergies and call the \\'RecordSynergy\\' tool for each one.\\n\\n';
            if (metaAnalyses.length > 0) {
                analysisPrompt += 'FOUNDATIONAL META-ANALYSES (for context only):\\n' + JSON.stringify(metaAnalyses.map(s => s.summary)) + '\\n\\n';
            }
            analysisPrompt += 'SOURCE TO ANALYZE:\\n' + sourceContext;

            const recordSynergyTool = runtime.tools.list().find(t => t.name === 'RecordSynergy');
            if (!recordSynergyTool) throw new Error("Core tool 'RecordSynergy' not found.");

            const aiResponse = await runtime.ai.processRequest(analysisPrompt, systemInstruction, [recordSynergyTool]);

            if (aiResponse && aiResponse.toolCalls) {
                const allSourcesForContext = [...metaAnalyses, source];
                for (const toolCall of aiResponse.toolCalls) {
                    if (toolCall.name === 'RecordSynergy') {
                        const synergyData = toolCall.arguments;

                        // FIX: Make combination parsing robust. Handle if AI returns a string.
                        let combination = synergyData.combination;
                        if (typeof combination === 'string') {
                            try {
                                combination = JSON.parse(combination);
                            } catch (e) {
                                runtime.logEvent(\`[Synergy Analysis] ⚠️ WARNING: Could not parse 'combination' string from AI. Skipping. Data: \${synergyData.combination}\`);
                                continue;
                            }
                        }

                        if (!Array.isArray(combination) || combination.length === 0 || combination.some(c => typeof c !== 'object' || !c.name || !c.type)) {
                            runtime.logEvent(\`[Synergy Analysis] ⚠️ WARNING: AI returned a malformed 'combination' structure for source "\${source.title.substring(0, 50)}...". Skipping this synergy. Data: \${JSON.stringify(synergyData.combination)}\`);
                            continue;
                        }
                        
                        // Use the potentially corrected combination for scoring
                        const synergyToScore = { ...synergyData, combination };

                        // Call the centralized scoring tool
                        const scoringResult = await runtime.tools.run('Score Single Synergy', {
                            synergyToScore: synergyToScore,
                            backgroundSources: allSourcesForContext
                        });
                        
                        // Record the final synergy with all the scores and the source link
                        if (scoringResult.updatedSynergy) {
                             const finalSynergyData = { 
                                ...scoringResult.updatedSynergy, 
                                sourceUri: source.url, 
                                sourceTitle: source.title 
                            };
                            const executionResult = await runtime.tools.run('RecordSynergy', finalSynergyData);
                            if (executionResult.synergy) {
                                foundSynergies.push(executionResult.synergy);
                            }
                        }
                    }
                }
                 runtime.logEvent(\`[Synergy Analysis] ✅ Processed source: \${source.title.substring(0,50)}... Found \${(aiResponse.toolCalls || []).length} synergies.\`);
            } else {
                 runtime.logEvent(\`[Synergy Analysis] ⚪️ No synergies found in source: \${source.title.substring(0,50)}...\`);
            }
        } catch (e) {
             runtime.logEvent(\`[Synergy Analysis] ❌ ERROR processing source \${source.title.substring(0,50)}...: \${e.message}\`);
             return { success: false, error: e.message, synergies: [] };
        }
        
        return {
            success: true,
            synergies: foundSynergies,
        };
    `
    },
    {
        name: 'Score Single Synergy',
        description: 'Performs a multi-layered scoring analysis on a single synergistic combination, including Mechanism of Action (MoA) complementarity and alignment with biological aging theories, to calculate a final "Trial Priority Score".',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To provide a reusable, focused function for scoring or re-scoring a single synergy based on the latest available scientific context.',
        parameters: [
            { name: 'synergyToScore', type: 'object', description: 'The synergy object to be scored. Must contain at least a "combination" array and a "summary".', required: true },
            { name: 'backgroundSources', type: 'array', description: 'An array of all validated source objects to provide context for the scoring.', required: true },
        ],
        implementationCode: `
            const { synergyToScore, backgroundSources } = args;
            const getComboString = (combination) => {
                if (!Array.isArray(combination)) return 'Unknown Combination';
                if (typeof combination[0] === 'string') return combination.join(' + ');
                if (typeof combination[0] === 'object' && combination[0].name) return combination.map(c => c.name).join(' + ');
                return 'Unknown Combination';
            };
            const comboString = getComboString(synergyToScore.combination);
            runtime.logEvent(\`[Scoring] Starting detailed scoring for: \${comboString}\`);

            // --- Step 1: Get MoA Complementarity Score ---
            const moaScoringSystemInstruction = \`You are an expert pharmacologist. Analyze the provided synergy information and its scientific context. Score the Mechanism of Action (MoA) complementarity on a scale of 0-100.
            You MUST respond with ONLY a single, valid JSON object in the following format:
            {
              "score": 85,
              "justification": "Component A targets the mTOR pathway, while Component B enhances autophagy via AMPK activation. This is highly complementary."
            }\`;
            
            const moaScoringPrompt = \`Analyze the following synergy and provide an MoA complementarity score based on the background literature.\\n\\nSynergy: \${JSON.stringify(synergyToScore)}\\n\\nBackground Summaries: \${JSON.stringify(backgroundSources.map(s => s.summary))}\`;
            
            let moaScore = 0;
            let moaJustification = 'N/A';
            
            try {
                const scoringResponseText = await runtime.ai.generateText(moaScoringPrompt, moaScoringSystemInstruction);
                const jsonMatch = scoringResponseText.match(/\\{[\\s\\S]*\\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    moaScore = parsed.score || 0;
                    moaJustification = parsed.justification || 'N/A';
                }
            } catch(e) {
                runtime.logEvent(\`[MoA Score] ⚠️ Could not determine MoA score for \${comboString}. Defaulting to 0. Error: \${e.message}\`);
            }

            // --- Step 2: Get Theory Alignment & Trial Priority Score ---
            const AGING_THEORIES_CONTEXT = \`
    - Stochastic Damage: Accumulating random molecular damage.
    - Programmed Hyperfunction: Harmful continuation of developmental programs.
    - Information Entropy: Loss of epigenetic information.
    - Cellular Society Collapse: Disruption by "bad actor" cells like senescent cells.
            \`;

            const theoryScoringSystemInstruction = \`You are an expert longevity scientist and VC. Analyze a therapeutic synergy to evaluate its clinical trial potential.
    Calculate a final "Trial Priority Score" based on all available data.
    You MUST respond with ONLY a single, valid JSON object in the following format:
    {
      "trialPriorityScore": 88,
      "theoryAlignmentScores": { "stochastic": 90, "hyperfunction": 75, "information": 50, "social": 95 },
      "scoringJustification": "The combination strongly addresses stochastic damage and cellular society collapse..."
    }\`;

            const theoryScoringPrompt = \`Evaluate the following therapeutic synergy for clinical trial potential.
    AGING THEORIES CONTEXT: \${AGING_THEORIES_CONTEXT}
    SYNERGY TO EVALUATE: \${JSON.stringify(synergyToScore)}
    MoA Score Justification: \${moaJustification}
    BACKGROUND LITERATURE: \${JSON.stringify(backgroundSources.map(s => s.summary))}
    Based on all this information, provide the trial priority score and theory alignment scores as a JSON object.\`;

            let trialPriorityScore = 0;
            let theoryAlignmentScores = {};
            
            try {
                const theoryResponseText = await runtime.ai.generateText(theoryScoringPrompt, theoryScoringSystemInstruction);
                const jsonMatch = theoryResponseText.match(/\\{[\\s\\S]*\\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    trialPriorityScore = parsed.trialPriorityScore || 0;
                    theoryAlignmentScores = parsed.theoryAlignmentScores || {};
                }
            } catch (e) {
                runtime.logEvent(\`[Trial Score] ⚠️ Could not determine trial priority score for \${comboString}. Defaulting to 0. Error: \${e.message}\`);
            }
            
            const updatedSynergy = { 
                ...synergyToScore, 
                moaComplementarityScore: moaScore, 
                moaJustification: moaJustification,
                trialPriorityScore,
                theoryAlignmentScores
            };
            
            runtime.logEvent(\`[Scoring] ✅ Finished scoring for \${comboString}. Trial Priority: \${trialPriorityScore}, MoA: \${moaScore}.\`);
            
            return { success: true, updatedSynergy };
        `
    },
    {
        name: 'Generate Proposal for Single Synergy',
        description: 'Generates a full, investment-ready trial dossier and a critical review for a single promising synergistic combination.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To encapsulate the complex, multi-step process of proposal generation and critique into a single, callable tool for a streaming workflow.',
        parameters: [
            { name: 'synergy', type: 'object', description: 'The synergy object to generate a proposal for. Must include combination, summary, etc.', required: true },
            { name: 'backgroundSources', type: 'array', description: 'The full list of validated scientific sources to use as background context for the proposal.', required: true },
        ],
        implementationCode: `
        const { synergy, backgroundSources } = args;
        const comboString = synergy.combination.map(c => c.name).join(' + ');
        runtime.logEvent(\`[Proposal] Generating dossier for: \${comboString}\`);

        const dossierTool = runtime.tools.list().find(t => t.name === 'RecordTrialDossier');
        if (!dossierTool) throw new Error("Core tool 'RecordTrialDossier' not found.");

        const dossierGenPrompt = \`You are a senior biotech investment analyst. Create a comprehensive investment dossier for the synergistic combination provided.
Your analysis MUST be grounded in the BACKGROUND LITERATURE.
You MUST call the 'RecordTrialDossier' tool with all the required information.

**CRITICAL INSTRUCTIONS for Risk & Mitigation Section:**
1.  **Risk Analysis:** You must provide a structured 'riskAnalysis' object.
    -   **scientificRisk (0-100):** How likely is the core scientific hypothesis to be wrong?
    -   **commercialRisk (0-100):** How significant are market, IP, or competitive risks?
    -   **safetyRisk (0-100):** What is the risk of unforeseen toxicity or adverse effects?
    -   **overallRiskScore (0-100):** Your blended assessment of all risks.
    -   **riskSummary (string):** A brief text summary of the primary risks.
2.  **Mitigation (Risk Insurance):** You must define a clear 'mitigationPlan' and 'estimatedCostUSD'.
    -   **mitigationPlan:** Propose concrete next steps to de-risk the project (e.g., "Conduct 12-month mouse longevity study and advanced toxicology screens."). This is the "insurance policy".
    -   **estimatedCostUSD:** Estimate the cost of this plan in USD. This is the "insurance premium".

SYNERGY TO PROPOSE: \${JSON.stringify(synergy)}
BACKGROUND LITERATURE: \${JSON.stringify(backgroundSources.map(s => s.summary))}\`;
        
        const dossierSystemInstruction = "You are an expert system that generates a detailed investment dossier, including a structured risk analysis and mitigation plan, then calls the 'RecordTrialDossier' tool with the results.";
        
        let generatedDossier = null;
        try {
            const dossierAiResponse = await runtime.ai.processRequest(dossierGenPrompt, dossierSystemInstruction, [dossierTool]);
            if (dossierAiResponse && dossierAiResponse.toolCalls && dossierAiResponse.toolCalls.length > 0) {
                const toolCall = dossierAiResponse.toolCalls[0];
                if (toolCall.name === 'RecordTrialDossier') {
                    const dossierResult = await runtime.tools.run(toolCall.name, toolCall.arguments);
                    if (dossierResult.dossier) {
                        generatedDossier = dossierResult.dossier;
                        runtime.logEvent(\`[Proposal] ...successfully wrote dossier for \${comboString}.\`);
                    }
                }
            } else {
                 throw new Error("AI did not generate a dossier tool call.");
            }
        } catch(e) {
             runtime.logEvent(\`[Proposal] ❌ Dossier generation failed for \${comboString}. Error: \${e.message}\`);
             return { success: false, error: 'Dossier generation failed.' };
        }

        if (!generatedDossier) {
            return { success: true, message: 'Dossier was not generated by the AI.' };
        }
        
        // Step 2: Critique Generated Dossier
        runtime.logEvent(\`[Proposal] Subjecting \${comboString} proposal to critical review...\`);
        let critiqueResult = null;
        try {
            critiqueResult = await runtime.tools.run('Critique Investment Proposal', { dossier: generatedDossier });
        } catch (e) { 
            runtime.logEvent(\`[Proposal] ⚠️ Critique failed for \${comboString}. Error: \${e.message}\`); 
        }

        return { success: true, message: 'Proposal generation and critique complete.', dossier: generatedDossier, critique: critiqueResult?.critique };
    `
    },
    {
        name: 'Critique Investment Proposal',
        description: 'Acts as a skeptical peer reviewer. Takes a generated investment dossier, searches for contradictory evidence and understated risks, and produces a structured critique.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To increase the scientific rigor of generated proposals by subjecting them to an adversarial review process, identifying potential flaws before they are presented.',
        parameters: [
            { name: 'dossier', type: 'object', description: 'The full dossier object to be critiqued. Must include combination, scientificRationale, and risks.', required: true },
        ],
        implementationCode: `
        const { dossier } = args;
        if (!dossier || !dossier.combination || !dossier.scientificRationale) {
            throw new Error("A valid dossier object with at least a 'combination' and 'scientificRationale' is required for critique.");
        }
        const comboString = dossier.combination.map(c => c.name).join(' + ');
        runtime.logEvent('[Critique] Starting critical analysis for: ' + comboString);

        const queries = [
            comboString + ' risks side effects contraindications',
            '"' + comboString + '" failed trial',
            'problems with combining ' + dossier.combination.map(c => c.name).join(' and '),
            'evidence against ' + dossier.scientificRationale.substring(0, 150)
        ];
        
        runtime.logEvent('[Critique] Searching for counter-evidence...');
        const searchResult = await runtime.tools.run('Federated Scientific Search', { query: queries.join('; '), maxResultsPerSource: 3 });
        const searchResults = searchResult.searchResults || [];

        let context = 'CRITIQUE THE FOLLOWING INVESTMENT PROPOSAL:\\n' + JSON.stringify(dossier, null, 2);
        if (searchResults.length > 0) {
            const searchContext = searchResults.map(r => '<EVIDENCE>\\n<TITLE>' + r.title + '</TITLE>\\n<SNIPPET>' + r.snippet + '</SNIPPET>\\n<URL>' + r.link + '</URL>\\n</EVIDENCE>').join('\\n\\n');
            context += '\\n\\nPOTENTIAL CONTRADICTORY EVIDENCE FOUND:\\n' + searchContext;
        } else {
            context += '\\n\\nNo direct contradictory evidence was found in a preliminary search.';
        }

        const systemInstruction = \`You are a highly skeptical and meticulous scientific peer reviewer. Your job is to find flaws in investment proposals.
-   Analyze the provided dossier and any search evidence.
-   Your tone should be critical, professional, and evidence-based.
-   Focus on: 1) Understated risks. 2) Weaknesses in the scientific rationale. 3) Contradictory evidence. 4) Feasibility.
-   You MUST respond by calling the 'RecordCritique' tool with your complete analysis.\`;

        const recordCritiqueTool = runtime.tools.list().find(t => t.name === 'RecordCritique');
        if (!recordCritiqueTool) throw new Error("Core tool 'RecordCritique' not found.");
        
        // Add the combination to the arguments the AI needs to pass to the tool
        recordCritiqueTool.parameters.find(p => p.name === 'combination').description = 'The combination being critiqued. You MUST pass the original combination: ' + JSON.stringify(dossier.combination);

        runtime.logEvent('[Critique] Generating critique for ' + comboString + '...');
        const aiResponse = await runtime.ai.processRequest(context, systemInstruction, [recordCritiqueTool]);
        
        const critiqueCall = aiResponse?.toolCalls?.[0];
        if (!critiqueCall || critiqueCall.name !== 'RecordCritique') {
            runtime.logEvent('[Critique] ❌ AI did not call the RecordCritique tool as instructed. Response: ' + JSON.stringify(aiResponse));
            throw new Error("AI did not generate the expected critique tool call.");
        }
        
        // The critique tool will log the data. We just need to return its structured result.
        const critiqueResult = await runtime.tools.run(critiqueCall.name, critiqueCall.arguments);
        
        return { success: true, message: 'Critique generated for ' + comboString, critique: critiqueResult.critique };
    `
    },
    {
        name: 'Rank Synergies by Promise',
        description: 'Ranks a list of identified synergies based on their pre-calculated "Trial Priority Score" to identify the most promising combinations for investment.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To efficiently prioritize the most valuable synergistic combinations from a large pool of candidates, enabling focused proposal generation.',
        parameters: [
            { name: 'synergies', type: 'array', description: 'The full array of synergy objects discovered during research, which must include a `trialPriorityScore`.', required: true },
            { name: 'topN', type: 'number', description: 'The number of top-ranked synergies to return.', required: true },
        ],
        implementationCode: `
            const { synergies, topN } = args;
            if (!synergies || synergies.length === 0) {
                return { success: true, rankedSynergies: [] };
            }

            // Sort the synergies array in place, in descending order of trialPriorityScore
            const sortedSynergies = [...synergies].sort((a, b) => {
                const scoreA = a.trialPriorityScore || 0;
                const scoreB = b.trialPriorityScore || 0;
                return scoreB - scoreA;
            });

            const rankedSynergies = sortedSynergies.slice(0, topN);

            runtime.logEvent(\`[Ranking] ✅ Successfully ranked \${synergies.length} synergies by score. Top contender: \${rankedSynergies[0]?.combination.map(c=>c.name).join(' + ')} (Score: \${rankedSynergies[0]?.trialPriorityScore})\`);
            
            return { success: true, rankedSynergies };
        `
    },
];
