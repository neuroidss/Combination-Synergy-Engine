import type { ToolCreatorPayload } from '../types';

export const RISK_TOOLS: ToolCreatorPayload[] = [
    {
        name: 'CritiqueInvestmentProposal',
        description: 'A "Red Team" agent that critically evaluates a generated investment proposal (dossier). It searches for contradictory evidence, identifies understated risks, and provides a final verdict.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To increase the robustness of the final output by actively seeking out flaws and counterarguments, moving beyond confirmation bias.',
        parameters: [
            { name: 'dossier', type: 'object', description: 'The complete dossier object for the synergy proposal to be critiqued.', required: true },
            { name: 'backgroundSources', type: 'array', description: 'The list of original sources used to generate the proposal, for context.', required: true },
        ],
        implementationCode: `
            const { dossier, backgroundSources } = args;
            const comboString = dossier.synergyData.combination.map(c => c.name).join(' + ');
            runtime.logEvent(\`[Critique] Starting Red Team critique for: \${comboString}\`);
    
            // Step 1: Search for contradictory evidence
            const contradictoryQueries = [
                \`"\${comboString}" contraindications\`,
                \`"\${dossier.synergyData.combination[0].name}" risks side effects review\`,
                \`problem with \${comboString.replace(' + ', ' and ')} synergy\`,
                \`antagonistic effects of \${comboString.replace(' + ', ' and ')}\`
            ];
            
            const searchResult = await runtime.tools.run('Federated Scientific Search', { query: contradictoryQueries.join('; '), maxResultsPerSource: 3 });
            const contradictorySources = searchResult.searchResults || [];
            
            let contradictoryContext = "No specific contradictory articles found in a quick search. The critique must be based on first principles and the provided sources.";
            if (contradictorySources.length > 0) {
                contradictoryContext = "The following articles were found when searching for negative interactions. Use them to inform your critique:\\n" +
                    contradictorySources.map(s => \`TITLE: \${s.title}\\nSNIPPET: \${s.snippet}\`).join('\\n\\n');
            }
    
            // Step 2: Generate the critique with the AI
            const systemInstruction = \`You are a skeptical, world-class venture capital analyst with a Ph.D. in bioinformatics. Your job is to find the fatal flaw in an investment proposal. Be critical but fair.
- Identify the strongest points of the proposal.
- Identify the weakest points, understated risks, or logical fallacies.
- Explicitly list any contradictory evidence found. If none was found, state that.
- Provide a final, one-word verdict: "Sound", "Needs Revision", or "High Risk".
You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown. The format is:
{
  "strengths": "The proposal's strongest scientific and commercial points.",
  "weaknesses": "The most significant weaknesses, unspoken assumptions, or potential failure modes.",
  "contradictoryEvidence": ["A list of bullet points summarizing any found contradictory evidence.", "e.g., 'A 2023 study (Smith et al.) showed that component A can exacerbate mitochondrial damage under hypoxic conditions, which this proposal ignores.'"],
  "overallVerdict": "Sound" | "Needs Revision" | "High Risk"
}\`;
    
            const prompt = \`Critique the following investment proposal.
PROPOSAL DOSSIER: \${JSON.stringify(dossier, null, 2)}
POTENTIAL CONTRADICTORY EVIDENCE: \${contradictoryContext}\`;
    
            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
            if (!jsonMatch) throw new Error("Critique AI did not return a valid JSON object. Raw: " + aiResponseText);
            const critiqueData = JSON.parse(jsonMatch[0]);
    
            const recordResult = await runtime.tools.run('RecordCritique', {
                ...critiqueData,
                combination: dossier.synergyData.combination,
            });
    
            runtime.logEvent(\`[Critique] ✅ Critique complete for \${comboString}. Verdict: \${critiqueData.overallVerdict}\`);
            return recordResult;
        `
    },
    {
        name: 'CompareRiskDossiers',
        description: 'Compares two versions of a Risk Engineering Dossier (an old and a new one) and generates a human-readable changelog detailing the differences.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To create an audit trail for the "Living Atlas", explaining exactly how and why a risk assessment has changed over time due to new information.',
        parameters: [
            { name: 'oldDossier', type: 'object', description: 'The previous version of the risk dossier.', required: true },
            { name: 'newDossier', type: 'object', description: 'The new, re-evaluated version of the risk dossier.', required: true },
            { name: 'triggeringSource', type: 'object', description: 'The new, high-impact scientific source that triggered this re-evaluation.', required: true },
        ],
        implementationCode: `
            const { oldDossier, newDossier, triggeringSource } = args;
            const systemInstruction = \`You are a meticulous scientific auditor. You are comparing two versions of a risk analysis report. Your task is to generate a concise, human-readable changelog.
- Identify key changes: risk scores being raised or lowered, new risks added, old risks removed, changes in mitigation strategies.
- For each significant change, briefly state the reason, citing the new "triggering source".
- You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown. The format must be:
{
  "changelog": [
    "Risk 'Immunosuppression' severity increased from 7 to 9. REASON: New meta-analysis (Smith et al., 2025) highlights long-term T-cell exhaustion.",
    "NEW existential risk 'Evolutionary Trap' added based on findings in the new source.",
    "NEW 'Course Correction' proposed for 'Catabolic Spiral' risk: cyclical dosing."
  ]
}\`;
            
            const prompt = \`Generate a changelog comparing the OLD and NEW risk dossiers, explaining the changes based on the TRIGGERING SOURCE.\\n
OLD DOSSIER: \${JSON.stringify(oldDossier.riskDossier, null, 2)}
NEW DOSSIER: \${JSON.stringify(newDossier.riskDossier, null, 2)}
TRIGGERING SOURCE: \${triggeringSource.title}
\`;

            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("No valid JSON response for dossier comparison.");
                const parsed = JSON.parse(jsonMatch[0]);
                runtime.logEvent('[Re-evaluation] ✅ Generated changelog for dossier update.');
                return { success: true, changelog: parsed.changelog };
            } catch (e) {
                throw new Error(\`Failed to generate changelog: \${e.message}\`);
            }
        `
    },
    {
        name: 'IdentifyBaselineRisks',
        description: 'For each component of a synergy, identifies its primary known biological risks and the molecular mechanisms behind them, sourcing data from public databases and scientific literature.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To form the foundation of the risk engineering dossier by gathering baseline risk data for individual interventions before analyzing their combination.',
        parameters: [
            { name: 'combination', type: 'array', description: 'The array of intervention objects, each with a "name".', required: true },
            { name: 'backgroundSources', type: 'array', description: 'An array of validated source objects to provide context for the risk assessment.', required: true }
        ],
        implementationCode: `
            const { combination, backgroundSources } = args;
            const baselineRisks = {};
            const sourceContext = backgroundSources.map(s => \`<SOURCE>\\nTITLE: \${s.title}\\nSUMMARY: \${s.summary}\\n</SOURCE>\`).join('\\n\\n');

            const systemInstruction = \`You are an expert pharmacologist and toxicologist. For a given intervention, your task is to identify its top 2-3 known biological risks by analyzing the provided scientific literature.
- For each risk, you MUST cite the source and provide a direct quote or a close summary as evidence.
- You MUST provide the 'source_title' for every risk. If you cannot find a source for a risk, do not include that risk in your response.
You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown. The format must be:
{
  "risks": [
    { "risk_name": "Specific biological risk (e.g., Immunosuppression)", "mechanism": "The molecular mechanism of the risk (e.g., Inhibition of mTORC1 in T-cells)", "evidence": "A direct quote or close summary from the source text that supports this risk.", "source_title": "The title of the source article where the evidence was found." }
  ]
}\`;
            
            for (const intervention of combination) {
                const prompt = \`Based on the provided scientific literature, identify the primary biological risks for the intervention: "\${intervention.name}".\\n\\nLITERATURE:\\n\${sourceContext}\`;
                try {
                    const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
                    const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                    if (!jsonMatch) throw new Error(\`No valid JSON for \${intervention.name}\`);
                    const parsed = JSON.parse(jsonMatch[0]);
                    baselineRisks[intervention.name] = parsed.risks;
                } catch (e) {
                    runtime.logEvent(\`[Risk Engine] ⚠️ Could not identify baseline risks for \${intervention.name}: \${e.message}\`);
                    baselineRisks[intervention.name] = [];
                }
            }
            
            runtime.logEvent('[Risk Engine] ✅ Mapped Layer 1 "Known Reefs" (Foundational Risks) for all components.');
            return { success: true, baselineRisks };
        `
    },
    {
        name: 'AnalyzeSynergisticThreats',
        description: 'A "Red Team" agent that models how baseline risks could interact to create new synergistic threats, and also hypothesizes long-term, evolutionary "Existential Risks".',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To proactively model both immediate (Layer 2) and long-term (Layer 3) dangers of an intervention, going beyond simple toxicology to consider systemic and evolutionary consequences.',
        parameters: [
            { name: 'baselineRisks', type: 'object', description: 'The object containing baseline risks for each intervention, from the "IdentifyBaselineRisks" tool.', required: true }
        ],
        implementationCode: `
            const systemInstruction = \`You are a "Red Team" agent, a hybrid of an expert toxicologist and an evolutionary biologist. Your task is to model the most dangerous potential failure modes of a combination therapy by reasoning from first principles.

**MODELING PROTOCOL:**
1.  **Synergistic Risks (Layer 2 - Mechanistic Inference):** For each pair of baseline risks, describe HOW their molecular mechanisms could interact to create a NEW or AMPLIFIED threat. Do not just name a category. Describe the step-by-step molecular cascade of the potential side-effect. Propose a specific, non-standard biomarker to track it.
    *   Example: "Component A's inhibition of mTOR and Component B's activation of AMPK could lock cells in a catabolic state, preventing necessary repair, leading to tissue atrophy. I will call this risk 'Catabolic Spiral'. A specific biomarker for this would be the ratio of phosphorylated ULK1 (Ser 555) to total ULK1."
2.  **Existential & Evolutionary Risks (Layer 3 - First Principles):** Think long-term (10-30 years). What are the unintended, systemic consequences of successfully "hacking" this specific aspect of aging?
    *   Example: "Suppressing cellular senescence with this combination removes a key anti-cancer barrier. After 15-20 years of successful use, the organism may become highly susceptible to aggressive, late-onset cancers that would have otherwise been cleared. I will call this risk 'The Senescence Paradox'."

**RESPONSE FORMAT:**
You MUST respond with ONLY a single, valid JSON object in the format:
{
  "synergistic_threats": [
    { "threat_type": "Mechanistic Interaction", "risk_name": "Catabolic Spiral", "synergy_factor": "Component A's block of mTOR plus Component B's activation of AMPK may lock cells in a catabolic state, preventing necessary repair and growth, leading to tissue atrophy. A specific biomarker could be the ULK1 phosphorylation ratio." }
  ],
  "existential_threats": [
    { "threat_type": "Evolutionary Trade-off", "risk_name": "The Senescence Paradox", "scenario": "Successfully suppressing cellular senescence removes a key anti-cancer barrier. After 15-20 years of use, this may lead to aggressive, late-onset cancers." }
  ]
}\`;
            
            const prompt = \`Here are the baseline risks for a combination therapy. Follow the MODELING PROTOCOL to map out both Layer 2 (Synergistic) and Layer 3 (Existential) threats.\\n\\nBASELINE RISKS:\\n\${JSON.stringify(args.baselineRisks, null, 2)}\`;

            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("No valid JSON response for synergistic threats.");
                const parsed = JSON.parse(jsonMatch[0]);
                runtime.logEvent(\`[Risk Engine] ✅ Mapped Layer 2 "Hidden Currents" (\${(parsed.synergistic_threats || []).length} threats) and Layer 3 "Chthonic Threats" (\${(parsed.existential_threats || []).length} scenarios).\`);
                return { success: true, synergisticThreats: parsed.synergistic_threats, existentialThreats: parsed.existential_threats };
            } catch (e) {
                throw new Error(\`Failed to parse synergistic threats: \${e.message}\`);
            }
        `
    },
    {
        name: 'ProposeEngineeringSolutions',
        description: 'For a single, specific biological threat (from any risk layer), this tool devises a complete "Navigation Protocol": a "Signal Beacon" (cheap validation test) and a "Course Correction" (an improved version of the hypothesis to mitigate the risk).',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To transform an abstract risk into a manageable engineering problem with a clear validation path and concrete backup plans, making the riskiest paths navigable.',
        parameters: [
            { name: 'riskName', type: 'string', description: 'The name of the specific biological risk to analyze.', required: true },
            { name: 'riskMechanism', type: 'string', description: 'The molecular mechanism, "synergy factor", or long-term scenario that causes the risk.', required: true }
        ],
        implementationCode: `
            const { riskName, riskMechanism } = args;

            // Step 1: Search for mitigation strategies
            runtime.logEvent(\`[Risk Engineer] Searching for mitigation strategies for risk: "\${riskName}"\`);
            const searchQuery = \`mitigation strategies for "\${riskName}" OR "how to prevent \${riskName}" review\`;
            const searchResult = await runtime.tools.run('Federated Scientific Search', { query: searchQuery, maxResultsPerSource: 3 });
            const searchSnippets = searchResult.searchResults || [];

            let contextString = "No specific mitigation strategies found in a quick search. Propose solutions based on first principles of the mechanism.";
            if (searchSnippets.length > 0) {
                contextString = "Based EXCLUSIVELY on the following search result snippets, propose solutions.\\n\\n" +
                    searchSnippets.map((s, i) => \`SNIPPET \${i+1} (Source: \${s.title}):\\n"\${s.snippet}"\`).join('\\n\\n');
            }

            const systemInstruction = \`You are an expert preclinical research engineer. For a given biological threat, design a "Navigation Protocol" based *only* on the provided context.

**PROTOCOL:**
1.  **"Signal Beacon" (Early Test):** Propose a standard, low-cost in-vitro assay that acts as an early warning for the specific threat mechanism.
2.  **"Course Correction" (Improvement):** Propose a practical improvement based on the provided snippets. Consider strategies like: modifying dosing, changing administration time, or adding a supplement mentioned in the context to counteract the risk. For each correction, cite which snippet it's based on.

**RESPONSE FORMAT:**
You MUST respond with ONLY a single, valid JSON object in the format:
{
  "signal_beacon": {
    "name": "The specific, standard, and low-cost in-vitro assay.",
    "description": "A brief explanation of why this test is a good indicator."
  },
  "go_no_go_criteria": "A clear, quantitative threshold for this test to abort the experiment.",
  "course_corrections": [
    {
      "strategy": "High-level strategy (e.g., 'Introduce Counteracting Agent').",
      "description": "Specific implementation of the strategy (e.g., 'Add L-Carnitine...').",
      "justification": "The scientific reason this works, citing the source snippet (e.g., 'Based on SNIPPET 2, L-Carnitine boosts mitochondrial biogenesis...')."
    }
  ]
}\`;

            const prompt = \`Design a Navigation Protocol for the following threat, using the provided context.\\n\\nRISK: \${riskName}\\nMECHANISM/SCENARIO: \${riskMechanism}\\n\\nCONTEXT:\\n\${contextString}\`;

            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("No valid JSON response for engineering solutions.");
                const parsed = JSON.parse(jsonMatch[0]);
                runtime.logEvent(\`[Risk Engine] ✅ Devised Navigation Protocol for risk: \${args.riskName}\`);
                return { success: true, navigationProtocol: parsed };
            } catch (e) {
                throw new Error(\`Failed to parse engineering solutions: \${e.message}\`);
            }
        `
    },
    {
        name: 'GenerateRiskEngineeringDossier',
        description: 'The master workflow for risk navigation. Orchestrates a sequence of specialized tools to create a complete "Expedition Navigation Map" for a single synergy, transforming it into a fully-vetted, investment-ready R&D project.',
        category: 'Automation',
        executionEnvironment: 'Client',
        purpose: 'To reliably encapsulate the complex, multi-step process of deep risk analysis and mitigation planning into a single, callable tool.',
        parameters: [
            { name: 'synergy', type: 'object', description: 'The synergy object to generate a dossier for. Must include combination, summary, etc.', required: true },
            { name: 'backgroundSources', type: 'array', description: 'The list of validated scientific sources for context.', required: true },
        ],
        implementationCode: `
            const { synergy, backgroundSources } = args;
            const comboString = synergy.combination.map(c => c.name).join(' + ');
            runtime.logEvent(\`[Dossier Engine] Starting Expedition Risk Mapping for: \${comboString}\`);
    
            const riskDossier = [];
    
            // Step 1: Map Layer 1 "Known Reefs" (Foundational Risks)
            const baselineRisksResult = await runtime.tools.run('IdentifyBaselineRisks', { combination: synergy.combination, backgroundSources });
    
            // Step 2: Map Layer 2 "Hidden Currents" (Synergistic) & Layer 3 "Chthonic Threats" (Existential)
            const threatsResult = await runtime.tools.run('AnalyzeSynergisticThreats', { baselineRisks: baselineRisksResult.baselineRisks });
    
            // Step 2.5: Generate Commercialization Outlook
            let commercialData = {};
            try {
                const commercialResult = await runtime.tools.run('GenerateCommercializationOutlook', { synergyData: synergy });
                commercialData = commercialResult.commercializationOutlook;
            } catch (commercialError) {
                runtime.logEvent(\`[Dossier Engine] ⚠️ Could not generate commercial outlook: \${commercialError.message}\`);
                commercialData = { targetIndication: 'Analysis Failed', marketData: { tam: 'N/A' }, ipStrategy: { type: 'N/A' } };
            }

            // Step 3 (Assemble): Combine all identified risks into one list
            const allIdentifiedRisks = [];
            // Add layer 1
            for (const interventionName in baselineRisksResult.baselineRisks) {
                const risks = baselineRisksResult.baselineRisks[interventionName];
                for (const risk of risks) {
                    allIdentifiedRisks.push({
                        risk_name: \`\${risk.risk_name} (\${interventionName})\`,
                        risk_layer: 1,
                        threat_type: 'Foundational Risk',
                        synergy_factor: risk.mechanism, // The 'mechanism' is the factor here
                        evidence: risk.evidence,
                        source_title: risk.source_title
                    });
                }
            }
            // Add layer 2 & 3
            allIdentifiedRisks.push(...(threatsResult.synergisticThreats || []).map(t => ({ ...t, layer: 2 })));
            allIdentifiedRisks.push(...(threatsResult.existentialThreats || []).map(t => ({ ...t, layer: 3, risk_name: t.risk_name, synergy_factor: t.scenario })));


            // Step 4 (Loop): Design Navigation Protocol for each threat
            for (const threat of allIdentifiedRisks) {
                try {
                    const solutionsResult = await runtime.tools.run('ProposeEngineeringSolutions', {
                        riskName: threat.risk_name,
                        riskMechanism: threat.synergy_factor
                    });
                    
                    const navigationProtocol = solutionsResult.navigationProtocol;
                    
                    // Step 4a: Cost the primary assay ("Signal Beacon")
                    let assayCost = 1200; // default cost for complex assays
                    let costFound = false;
                    try {
                        const costResult = await runtime.tools.run('FindMarketPriceForLabItem', { itemName: navigationProtocol.signal_beacon.name });
                        if (costResult && costResult.price !== null) {
                            assayCost = costResult.price;
                            costFound = true;
                        }
                    } catch (costError) {
                        // Error is already logged by the tool, no need to log again
                    }
                    if (!costFound) {
                        runtime.logEvent(\`[Dossier Engine] ⚠️ Market price not found for '\${navigationProtocol.signal_beacon.name}'. Using default estimate of $\${assayCost}.\`);
                    }
                    navigationProtocol.signal_beacon.estimated_cost = assayCost;

                    riskDossier.push({
                      risk_name: threat.risk_name,
                      risk_layer: threat.risk_layer,
                      threat_type: threat.threat_type,
                      risk_origin: {
                        synergy_factor: threat.synergy_factor,
                        evidence: threat.evidence,
                        source_title: threat.source_title,
                      },
                      navigation_protocol: navigationProtocol
                    });

                } catch (solutionError) {
                    runtime.logEvent(\`[Dossier Engine] ❌ Failed to engineer solution for risk '\${threat.risk_name}': \${solutionError.message}\`);
                }
            }
            
            if (riskDossier.length === 0) {
                 runtime.logEvent('[Dossier Engine] ⚠️ No specific risks were modeled, but dossier will be generated with basic info.');
            }

            // Step 5: Assemble and record final dossier
            const finalDossierData = {
                synergyData: synergy,
                noveltyClass: synergy.status === 'Known' ? 'KNOWN SYNERGY' : (synergy.status.includes('De Novo') ? 'DE NOVO HYPOTHESIS' : 'HYPOTHETICAL SYNERGY'),
                riskDossier: riskDossier,
                commercializationOutlook: commercialData,
                backgroundSources: backgroundSources,
            };
            
            const recordResult = await runtime.tools.run('RecordTrialDossier', finalDossierData);
            runtime.logEvent(\`[Dossier Engine] ✅ Expedition Navigation Map for \${comboString} assembled and recorded.\`);

            return recordResult;
        `
    },
];