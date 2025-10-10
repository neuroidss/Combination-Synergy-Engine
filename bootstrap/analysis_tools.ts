
import type { ToolCreatorPayload } from '../types';

export const ANALYSIS_TOOLS: ToolCreatorPayload[] = [
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
        description: 'Analyzes a single validated scientific source to identify potential synergistic, additive, or antagonistic combinations.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To perform focused, granular scientific analysis on one source at a time, enabling a streaming research workflow.',
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

            let systemInstruction = \`You are an expert bioinformatics researcher. Your task is to analyze a scientific article to find combinations of longevity interventions.
For each combination you identify in this single source, you MUST call the 'RecordSynergy' tool. You can call this tool multiple times.
For each combination, you must:
1.  Identify the nature of the interaction: 'Synergistic', 'Additive', or 'Antagonistic'.
2.  Determine if the synergy is 'Known' or 'Hypothesized'.
3.  Provide a scientific rationale based on the source.
4.  CRITICALLY ASSESS and clearly state any potential risks or contraindications mentioned.
If no synergies are found, do not call any tools and respond with an empty text response. Otherwise, respond only with tool calls.\`;

            let analysisPrompt = 'Based on the research objective "' + researchObjective + '" and the following source, identify all potential synergies and call the \\'RecordSynergy\\' tool for each one.\\n\\n';
            if (metaAnalyses.length > 0) {
                analysisPrompt += 'FOUNDATIONAL META-ANALYSES (for context only):\\n' + JSON.stringify(metaAnalyses.map(s => s.summary)) + '\\n\\n';
            }
            analysisPrompt += 'SOURCE TO ANALYZE:\\n' + sourceContext;

            const recordSynergyTool = runtime.tools.list().find(t => t.name === 'RecordSynergy');
            if (!recordSynergyTool) throw new Error("Core tool 'RecordSynergy' not found.");

            const aiResponse = await runtime.ai.processRequest(analysisPrompt, systemInstruction, [recordSynergyTool]);

            if (aiResponse && aiResponse.toolCalls) {
                for (const toolCall of aiResponse.toolCalls) {
                    if (toolCall.name === 'RecordSynergy') {
                        const executionResult = await runtime.tools.run(toolCall.name, toolCall.arguments);
                        if (executionResult.synergy) {
                            foundSynergies.push(executionResult.synergy);
                        }
                    }
                }
                 runtime.logEvent(\`[Synergy Analysis] ✅ Processed source: \${source.title.substring(0,50)}... Found \${aiResponse.toolCalls.length} synergies.\`);
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
        const comboString = synergy.combination.join(' + ');
        runtime.logEvent(\`[Proposal] Generating dossier for: \${comboString}\`);

        const dossierTool = runtime.tools.list().find(t => t.name === 'RecordTrialDossier');
        if (!dossierTool) throw new Error("Core tool 'RecordTrialDossier' not found.");

        const dossierGenPrompt = \`You are a senior business analyst. Create a comprehensive investment dossier for the following synergistic combination. Use the provided background literature to create plausible, detailed sections for the dossier.
You MUST call the 'RecordTrialDossier' tool with the complete information for the proposal.

SYNERGY TO PROPOSE: \${JSON.stringify(synergy)}
BACKGROUND LITERATURE: \${JSON.stringify(backgroundSources.map(s => s.summary))}\`;
        
        const dossierSystemInstruction = "You are a helpful assistant that generates a detailed investment dossier and calls the 'RecordTrialDossier' tool with the results.";
        
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
        const comboString = dossier.combination.join(' + ');
        runtime.logEvent('[Critique] Starting critical analysis for: ' + comboString);

        const queries = [
            comboString + ' risks side effects contraindications',
            '"' + comboString + '" failed trial',
            'problems with combining ' + dossier.combination.join(' and '),
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
];
