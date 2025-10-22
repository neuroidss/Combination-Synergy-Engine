
import type { ToolCreatorPayload } from '../types';

export const CORE_ANALYSIS_TOOLS: ToolCreatorPayload[] = [
    {
        name: 'AssessSourceImpact',
        description: 'A "Sentinel Agent" tool. Analyzes a new scientific article to determine its potential impact on existing knowledge. Classifies the impact as LOW, MEDIUM, or HIGH.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To act as a filter for the Sentinel Agent, allowing it to focus re-evaluation efforts only on new research that is significant enough to potentially alter previous conclusions.',
        parameters: [
            { name: 'source', type: 'object', description: 'The new source object to assess, including title and summary.', required: true },
            { name: 'existingKeywords', type: 'array', description: 'An array of keywords from existing synergies (e.g., ["Metformin", "mTOR", "AMPK"]) to check for relevance.', required: true },
        ],
        implementationCode: `
            const { source, existingKeywords } = args;
            const systemInstruction = \`You are a senior scientific editor. Your task is to assess the importance of a new scientific paper.
Look for keywords that indicate high impact, such as: 'systematic review', 'meta-analysis', 'contradicts previous findings', 'revises mechanism', 'novel side effect', 'clinical trial results'.
You MUST respond with ONLY a single, valid JSON object. Do not add any text or explanations. The format must be:
{
  "impact": "LOW_IMPACT" | "MEDIUM_IMPACT" | "HIGH_IMPACT",
  "reason": "A brief justification for your assessment."
}\`;
            
            const prompt = \`Assess the impact of this new article based on its title and summary, especially in relation to the keywords: \${existingKeywords.join(', ')}.\\n\\nTITLE: \${source.title}\\nSUMMARY: \${source.summary}\`;
            
            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("No valid JSON response for source impact assessment.");
                const parsed = JSON.parse(jsonMatch[0]);
                runtime.logEvent(\`[Sentinel] Assessed '\${source.title.substring(0,40)}...' as \${parsed.impact}.\`);
                return { success: true, ...parsed };
            } catch (e) {
                throw new Error(\`Failed to parse impact assessment: \${e.message}\`);
            }
        `
    },
    {
        name: 'ExtractKnownAndHypotheticalSynergies',
        description: 'Analyzes a scientific article to extract KNOWN synergies mentioned in the text and generate HYPOTHETICAL synergies based on unstated combinations of interventions. Returns a structured list of these potential synergies.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To separate the complex AI-based extraction of synergies from their subsequent scoring and recording, making the workflow more modular and robust.',
        parameters: [
            { name: 'sourceToAnalyze', type: 'object', description: 'The single validated source object to be analyzed.', required: true },
            { name: 'researchObjective', type: 'string', description: 'The original research objective to focus the analysis.', required: true },
        ],
        implementationCode: `
        const { sourceToAnalyze: source, researchObjective } = args;
        const sourceContext = \`<SOURCE>\\n<TITLE>\${source.title}</TITLE>\\n<RELIABILITY>\${source.reliabilityScore}</RELIABILITY>\\n<SUMMARY>\${source.summary}</SUMMARY>\\n</SOURCE>\`;

        const systemInstruction = \`You are an expert bioinformatics researcher. Your task is to analyze a scientific article to extract both KNOWN and HYPOTHETICAL synergies.

**Analysis Steps:**
1.  **Extract KNOWN Synergies:** Identify every combination of two or more interventions that are explicitly discussed as being used together in the article.
2.  **Generate HYPOTHETICAL Synergies:** List all individual interventions mentioned. If a general class is mentioned (e.g., 'autophagy inducer'), you MUST select a common, representative example from that class (e.g., 'Rapamycin', 'Metformin') to use in your combinations. Then, identify "knowledge gaps" by finding pairs or triplets that are NOT explicitly discussed as a combination. For each promising unstated combination, formulate a novel hypothesis.

**Response Format:**
- You MUST respond with ONLY a single, valid JSON object.
- The JSON object must contain a single key "synergies", which is an array of synergy objects.
- A "combination" MUST consist of two or more interventions. Never output a combination with only one item.
- Each synergy object must have the following structure:
{
  "combination": [{"name": "Intervention A", "type": "drug"}, {"name": "Intervention B", "type": "behavior"}],
  "status": "Known" or "Hypothesized (De Novo)",
  "synergyType": "Synergistic", "Additive", or "Antagonistic",
  "summary": "For KNOWN, summarize the finding from the paper. For HYPOTHETICAL, provide a plausible scientific rationale.",
  "potentialRisks": "Describe potential risks of the combination."
}
- Do not add any text, explanations, or markdown formatting before or after the JSON object.\`;

        const prompt = \`Based on the research objective "\${researchObjective}" and the following source, identify all potential synergies (both known and hypothetical) and return them as a JSON object.\\n\\nSOURCE TO ANALYZE:\\n\${sourceContext}\`;

        const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
        try {
            const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
            if (!jsonMatch) throw new Error("AI did not return a valid JSON object. Raw response: " + aiResponseText);
            const parsedResult = JSON.parse(jsonMatch[0]);

            if (!parsedResult.synergies || !Array.isArray(parsedResult.synergies)) {
                 throw new Error("AI response did not contain a 'synergies' array.");
            }
            
            // Filter out malformed single-item "synergies" from the AI output.
            const validSynergies = parsedResult.synergies.filter(s => s.combination && Array.isArray(s.combination) && s.combination.length >= 2);
            const removedCount = parsedResult.synergies.length - validSynergies.length;
            if (removedCount > 0) {
                runtime.logEvent(\`[Synergy Extractor] ⚠️ Filtered out \${removedCount} malformed single-item combinations from AI output.\`);
            }

            runtime.logEvent(\`[Synergy Extractor] ✅ Extracted \${validSynergies.length} potential synergies from source.\`);
            return { success: true, synergies: validSynergies };
        } catch(e) {
            runtime.logEvent(\`[Synergy Extractor] ❌ Error parsing synergies from AI: \${e.message}\`);
            throw new Error('Failed to parse synergies from AI: ' + e.message + ' Raw response: ' + aiResponseText);
        }
    `
    },
    {
        name: 'Assess Organ-Specific Aging Impact',
        description: "Analyzes a synergy's mechanism of action to predict its potential impact on organ-specific epigenetic clocks (e.g., brain, liver, blood, skin).",
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: "To move beyond a general 'biological age' and provide targeted predictions about which tissues a longevity intervention will rejuvenate, making hypotheses more specific and testable.",
        parameters: [
            { name: 'synergySummary', type: 'string', description: "The scientific rationale or abstract for the synergistic intervention.", "required": true }
        ],
        implementationCode: `
            const { synergySummary } = args;
            const systemInstruction = \`You are an expert in geroscience and epigenetic clocks. Based on the scientific mechanism of a therapy, predict its likely impact on the biological age of specific organs.
    Impact values can be: 'High Positive', 'Moderate Positive', 'Low Positive', 'Negligible', 'Low Negative', 'Moderate Negative', 'High Negative'.
    You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
    {
      "brain_impact": "High Positive",
      "liver_impact": "Moderate Positive",
      "blood_impact": "Low Positive",
      "skin_impact": "Negligible",
      "justification": "The intervention targets neuro-inflammation, strongly affecting brain clocks. Its systemic metabolic effects give it a moderate impact on the liver."
    }\`;
            const prompt = \`Therapy Rationale: "\${synergySummary}"\\n\\nBased on this, evaluate the impact on brain, liver, blood, and skin aging.\`;
            
            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("No valid JSON response from AI. Raw response: " + aiResponseText);
                const parsedResult = JSON.parse(jsonMatch[0]);
                runtime.logEvent(\`[Organ Impact] Assessed organ-specific impact.\`);
                return { success: true, organImpacts: parsedResult };
            } catch(e) {
                throw new Error('Failed to parse organ impact from AI: ' + e.message + ' Raw response: ' + aiResponseText);
            }
        `
    },
    {
        name: "Deconstruct Hypothesis to Experiment Plan",
        description: "Takes a scientific hypothesis and breaks it down into a concrete, step-by-step in vitro experiment plan, listing the necessary assays and measurements.",
        category: "Functional",
        executionEnvironment: "Client",
        purpose: "To translate an abstract idea into a tangible list of scientific tasks required for its initial validation.",
        parameters: [
            { name: "hypotheticalAbstract", type: "string", description: "The abstract of the hypothesis to be tested.", required: true }
        ],
        implementationCode: `
            const { hypotheticalAbstract } = args;
            const systemInstruction = \`You are a principal investigator designing a pilot experiment. Based on the hypothesis in the abstract, define the simplest possible in vitro experiment to get a 'go/no-go' signal.
You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
{
  "cell_model": "Human primary fibroblasts (HDFs)",
  "interventions": ["Compound X (10uM)", "Compound Y (5uM)", "Combination (X+Y)"],
  "key_measurements": [
    "Cell Viability Assay (MTT)",
    "Senescence Staining (SA-β-gal)",
    "qPCR for SIRT1 and p53 genes",
    "Mitochondrial Respiration Assay (Seahorse)"
  ],
  "justification": "This plan directly tests the hypothesis's claims about senescence and metabolism in a standard human cell model."
}\`;
            const prompt = \`Hypothesis: "\${hypotheticalAbstract}"\\n\\nDesign the experimental plan as a JSON object.\`;
    
            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("No valid JSON response from AI for experiment plan. Raw response: " + aiResponseText);
                const parsedResult = JSON.parse(jsonMatch[0]);
                runtime.logEvent('[Experiment Planner] ✅ Deconstructed hypothesis into concrete plan.');
                return { success: true, experimentPlan: parsedResult };
            } catch(e) {
                throw new Error('Failed to parse experiment plan from AI: ' + e.message + ' Raw response: ' + aiResponseText);
            }
        `
    },
    {
        name: "Virtual Cell Validator",
        description: "For a given synergistic intervention, this tool simulates a molecular-level analysis, as if using a 'Virtual Cell'. It generates a detailed, step-by-step mechanistic explanation of how the synergy achieves its effect, referencing specific genes, proteins, and pathways.",
        category: "Functional",
        executionEnvironment: "Client",
        purpose: "To bridge the gap between high-level functional outcomes (e.g., 'reduced inflammation') and the underlying molecular biology, adding deep scientific validation to each generated hypothesis.",
        parameters: [
            { name: "synergyCombination", type: "array", description: "The array of intervention names (e.g., ['Rapamycin', 'Metformin']).", required: true },
            { name: "observedEffect", type: "string", description: "The high-level observed or hypothesized effect (e.g., 'Enhanced autophagy and reduced cellular senescence').", required: true }
        ],
        implementationCode: `
            const { synergyCombination, observedEffect } = args;

            const systemInstruction = \`You are a senior computational biologist with access to a perfect 'Virtual Cell' simulator. Your task is to explain HOW a given drug combination causes a specific biological effect at the molecular level.
- Be specific. Name the key proteins, genes, and signaling pathways involved.
- Describe the step-by-step chain of events.
- Your explanation must be plausible and grounded in known biological principles.
You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
{
  "mechanistic_explanation": "1. Drug A enters the cell and inhibits protein X (e.g., mTORC1). \\\\n2. This inhibition leads to the dephosphorylation of protein Y (e.g., ULK1). \\\\n3. Simultaneously, Drug B activates enzyme Z (e.g., AMPK), which also phosphorylates ULK1 at a different site. \\\\n4. This dual-action on ULK1 hyper-activates the autophagy initiation complex, leading to a synergistic increase in autophagosome formation and enhanced clearance of senescent mitochondria."
}\`;

            const prompt = \`Combination: \${synergyCombination.join(' + ')}\\nObserved Effect: \${observedEffect}\\n\\nProvide the detailed, step-by-step molecular explanation for this synergistic effect.\`;

            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("Virtual Cell Validator AI did not return a valid JSON object. Raw response: " + aiResponseText);
                const parsed = JSON.parse(jsonMatch[0]);
                
                runtime.logEvent(\`[Virtual Cell] ✅ Mechanistic explanation generated for \${synergyCombination.join(' + ')}.\`);
                return { success: true, explanation: parsed.mechanistic_explanation };

            } catch (e) {
                throw new Error(\`Failed to generate mechanistic explanation: \${e.message}\`);
            }
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
- You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
{ "classification": "Meta-Analysis/Review" } OR { "classification": "Primary Study" }\`;

        for (const source of validatedSources) {
            try {
                const sourceContext = \`<SOURCE>\\n<TITLE>\${source.title}</TITLE>\\n<SUMMARY>\${source.summary}</SUMMARY>\\n</SOURCE>\`;
                const prompt = \`Classify the following article:\\n\\n\${sourceContext}\`;
                
                const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("No JSON object found in response. Raw response: " + aiResponseText);
                
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
        description: 'Acts as a workflow to fully analyze a single scientific source. It first extracts all known and hypothetical synergies, then iterates through each one to score it, estimate its cost, and record the final, enriched result.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To perform focused, granular scientific analysis on one source at a time by orchestrating a sequence of specialized tools, enabling a streaming research workflow.',
        parameters: [
            { name: 'sourceToAnalyze', type: 'object', description: 'The single validated source object to be analyzed.', required: true },
            { name: 'researchObjective', type: 'string', description: 'The original research objective to focus the analysis.', required: true },
            { name: 'metaAnalyses', type: 'array', description: 'Optional array of sources identified as meta-analyses, to provide context.', required: false },
        ],
        implementationCode: `
        const { sourceToAnalyze: source, researchObjective, metaAnalyses = [] } = args;
        const foundSynergies = [];
        runtime.logEvent(\`[Synergy Workflow] Starting analysis for: \${source.title.substring(0,50)}...\`);

        try {
            // Step 1: Extract all potential synergies using the dedicated tool.
            const extractionResult = await runtime.tools.run('ExtractKnownAndHypotheticalSynergies', {
                sourceToAnalyze: source,
                researchObjective,
            });

            const potentialSynergies = extractionResult.synergies || [];

            if (potentialSynergies.length === 0) {
                runtime.logEvent(\`[Synergy Workflow] ⚪️ No synergies found in source: \${source.title.substring(0,50)}...\`);
                return { success: true, synergies: [] };
            }

            runtime.logEvent(\`[Synergy Workflow] Extracted \${potentialSynergies.length} synergies. Now scoring and recording each one...\`);
            const allSourcesForContext = [...metaAnalyses, source];

            // Step 2: Loop through each extracted synergy and enrich it with scores and costs.
            for (const synergyToScore of potentialSynergies) {
                try {
                    // Defensively check the combination structure
                    if (!Array.isArray(synergyToScore.combination) || synergyToScore.combination.length < 2 || synergyToScore.combination.some(c => !c.name || !c.type)) {
                        runtime.logEvent(\`[Synergy Workflow] ⚠️ Skipping malformed synergy from extractor: \${JSON.stringify(synergyToScore.combination)}\`);
                        continue;
                    }
                
                    // Step 2a: Get cost
                    const costResult = await runtime.tools.run('Estimate Synergy Validation Cost', { combination: synergyToScore.combination });
                    
                    // Step 2b: Get scientific scores
                    const scoringResult = await runtime.tools.run('Score Single Synergy', {
                        synergyToScore: synergyToScore,
                        backgroundSources: allSourcesForContext
                    });
                    
                    // Step 2c: Get organ impact
                    const organImpactResult = await runtime.tools.run('Assess Organ-Specific Aging Impact', { synergySummary: scoringResult.updatedSynergy.summary });
                    
                    // Step 2d: Assemble and record the final, enriched synergy object
                    if (scoringResult.updatedSynergy) {
                         const finalSynergyData = { 
                            ...scoringResult.updatedSynergy, 
                            organImpacts: organImpactResult.organImpacts,
                            sourceUri: source.url || source.uri, 
                            sourceTitle: source.title,
                            estimatedCost: costResult.estimatedCost,
                            costBreakdown: costResult.costBreakdown,
                        };
                        const executionResult = await runtime.tools.run('RecordSynergy', finalSynergyData);
                        if (executionResult.synergy) {
                            foundSynergies.push(executionResult.synergy);
                        }
                    }
                } catch (innerError) {
                    runtime.logEvent(\`[Synergy Workflow] ❌ Error processing a single synergy: \${innerError.message}\`);
                    // Continue to the next synergy
                }
            }

        } catch (e) {
             runtime.logEvent(\`[Synergy Workflow] ❌ CRITICAL ERROR during synergy analysis for \${source.title.substring(0,50)}...: \${e.message}\`);
             // Re-throwing so the main workflow can catch it.
             throw e;
        }
        
        runtime.logEvent(\`[Synergy Workflow] ✅ Finished analysis for source. Recorded \${foundSynergies.length} synergies.\`);
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
            const indexedSourceContext = backgroundSources.map((s, i) => \`[Source \${i + 1}] \${s.summary}\`).join('\\n\\n');

            const moaScoringSystemInstruction = \`You are an expert pharmacologist. Analyze the provided synergy information and its scientific context. Score the Mechanism of Action (MoA) complementarity on a scale of 0-100.
            CRITICAL: Your justification MUST cite the sources you used by number. Consolidate citations at the end of sentences or paragraphs, and do not repeat the same citation for a single fact. For example: "This is highly complementary... [1, 3, 4]." or "Component A targets mTOR [1]. Component B enhances autophagy [2]. The combination is synergistic [1, 2]."
            You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
            {
              "score": 85,
              "justification": "Component A targets the mTOR pathway, while Component B enhances autophagy via AMPK activation, creating a highly complementary effect [1, 2]."
            }
            \`;
            
            const moaScoringPrompt = \`Analyze the following synergy and provide an MoA complementarity score based on the background literature.\\n\\nSynergy: \${JSON.stringify(synergyToScore)}\\n\\nBackground Literature:\\n\${indexedSourceContext}\`;
            
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
    CRITICAL: Your justification MUST cite the sources you used by number. Consolidate citations at the end of sentences or paragraphs, and do not repeat the same citation for a single fact. For example: "The combination addresses stochastic damage [2, 4] and cellular collapse [6]."
    You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
    {
      "trialPriorityScore": 88,
      "theoryAlignmentScores": { "stochastic": 90, "hyperfunction": 75, "information": 50, "social": 95 },
      "scoringJustification": "The combination strongly addresses stochastic damage by enhancing DNA repair [2] and also impacts cellular society collapse by clearing senescent cells [4, 6]."
    }\`;

            const theoryScoringPrompt = \`Evaluate the following therapeutic synergy for clinical trial potential.
    AGING THEORIES CONTEXT: \${AGING_THEORIES_CONTEXT}
    SYNERGY TO EVALUATE: \${JSON.stringify(synergyToScore)}
    MoA Score Justification: \${moaJustification}
    BACKGROUND LITERATURE:\\n\${indexedSourceContext}
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
];
