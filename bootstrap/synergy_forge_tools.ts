import type { ToolCreatorPayload } from '../types';

export const SYNERGY_FORGE_FUNCTIONAL_TOOLS: ToolCreatorPayload[] = [
    {
        name: 'Federated Scientific Search',
        description: 'Searches multiple scientific databases (PubMed, Google Patents, bioRxiv) for primary research articles related to a query. This is the mandatory first step of any research task.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To gather a high-quality, broad list of potential scientific literature from trusted sources, which will then be rigorously verified.',
        parameters: [
            { name: 'query', type: 'string', description: 'The research topic to investigate (e.g., "synergistic effects of metformin and rapamycin on aging").', required: true },
            { name: 'maxResultsPerSource', type: 'number', description: 'The maximum number of results to return from each data source (default: 5).', required: false },
        ],
        implementationCode: `
            const { query, maxResultsPerSource = 5 } = args;
            runtime.logEvent(\`[Search] Starting federated search for: "\${query}"\`);

            const searchPromises = [
                runtime.search.pubmed(query, maxResultsPerSource),
                runtime.search.biorxiv(query, maxResultsPerSource),
                runtime.search.patents(query, maxResultsPerSource),
            ];

            const resultsBySource = await Promise.allSettled(searchPromises);
            
            const allResults = [];
            resultsBySource.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    allResults.push(...result.value);
                }
            });

            const uniqueResults = Array.from(new Map(allResults.map(item => [item.link, item])).values());
            
            runtime.logEvent(\`[Search] Federated search complete. Found \${uniqueResults.length} unique potential sources.\`);

            return {
                success: true,
                message: \`Found \${uniqueResults.length} potential articles.\`,
                searchResults: uniqueResults,
            };
        `,
    },
    {
        name: 'Enrich and Validate Sources',
        description: 'Takes a list of search results, enriches them by fetching their content, then sends the batch to an AI for final validation, summarization, and reliability scoring. This is the mandatory second step.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To programmatically verify a batch of search results link to valid scientific articles and to extract summaries from the confirmed sources using a single, efficient AI call.',
        parameters: [
            { name: 'searchResults', type: 'array', description: 'An array of search result objects, each containing a "title" and a "link".', required: true },
        ],
        implementationCode: `
            const { searchResults } = args;
            if (!Array.isArray(searchResults) || searchResults.length === 0) {
                return { success: true, validatedSources: [] };
            }
            
            runtime.logEvent(\`[Validator] Starting enrichment for \${searchResults.length} sources...\`);
            const enrichmentPromises = searchResults.map(res => runtime.search.enrichSource(res));
            const enrichedResults = await Promise.all(enrichmentPromises);
            runtime.logEvent(\`[Validator] Enrichment complete. Sending \${enrichedResults.length} sources to AI for final validation.\`);

            const validationContext = enrichedResults.map((res, i) => 
                \`<PRIMARY_SOURCE \${i + 1}>\\n<TITLE>\${res.title}</TITLE>\\n<URL>\${res.link}</URL>\\n<SNIPPET>\\n\${res.snippet}\\n</SNIPPET>\\n</PRIMARY_SOURCE>\`
            ).join('\\n\\n');

            const systemInstruction = \`You are an expert research analyst. Your task is to analyze a list of primary scientific sources and for each one:
1.  Summarize its core scientific claims.
2.  Assess its reliability with a score from 0.0 to 1.0. Base this on the source type (peer-reviewed > preprint > patent) and content.
Your output MUST be a single JSON object with a key "sources", which is an array of objects, each with "uri", "title", "summary", "reliability", and "reliabilityJustification".\`
            
            const validationPrompt = \`Based on the research query, please assess and summarize the following primary scientific sources.\\n\\n\${validationContext}\`;

            const aiResponseText = await runtime.ai.generateText(validationPrompt, systemInstruction);
            
            let validationJson;
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("No JSON object found in the AI's validation response.");
                validationJson = JSON.parse(jsonMatch[0]);
            } catch (e) {
                runtime.logEvent(\`[Validator] ❌ Error parsing batch validation JSON. AI Response: \${aiResponseText}\`);
                throw new Error(\`Failed to parse the AI's batch validation response. Details: \${e.message}\`);
            }

            if (!validationJson.sources || !Array.isArray(validationJson.sources)) {
                throw new Error("AI response did not contain a valid 'sources' array.");
            }
            
            const validatedSources = validationJson.sources.map(s => ({
                url: s.uri,
                title: s.title,
                isScientific: true,
                summary: s.summary,
                reliabilityScore: s.reliability,
                justification: s.reliabilityJustification,
            }));

            runtime.logEvent(\`[Validator] ✅ Batch validation complete. AI validated \${validatedSources.length} sources.\`);

            return {
                success: true,
                message: \`Batch validation complete. \${validatedSources.length} sources were validated.\`,
                validatedSources: validatedSources,
            };
        `,
    },
    {
        name: 'RecordSynergy',
        description: 'Records the details of a single synergistic intervention identified from the literature.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To log a single identified synergy, which the agent calls iteratively. This avoids generating and parsing a large, complex JSON array.',
        parameters: [
            { name: 'combination', type: 'array', description: 'An array of strings representing the interventions in the synergy (e.g., ["Metformin", "Rapamycin"]).', required: true },
            { name: 'status', type: 'string', description: 'The status of the synergy, either "Known" or "Hypothesized".', required: true },
            { name: 'synergyType', type: 'string', description: 'The type of interaction, e.g., "Synergistic", "Additive", "Antagonistic".', required: true },
            { name: 'summary', type: 'string', description: 'A brief explanation of the synergistic interaction and the rationale behind it.', required: true },
        ],
        implementationCode: `
            const { combination, status, synergyType, summary } = args;
            runtime.logEvent(\`[Synergy Analysis] Recording synergy: \${combination.join(' + ')}\`);
            
            return {
                success: true,
                synergy: {
                    combination,
                    status,
                    synergyType,
                    summary,
                }
            };
        `
    },
    {
        name: 'RecordSynergyGameParameters',
        description: 'Records the mapping of a single synergy to the specific parameters of the Organoid Odyssey simulator.',
        category: 'Functional',
        executionEnvironment: 'Client',

        purpose: 'To log the game parameters for a single synergy, accepting a structured object directly from the agent.',
        parameters: [
             { name: 'synergyCombination', type: 'array', description: 'The array of intervention names that identifies the synergy (e.g., ["Metformin", "Rapamycin"]).', required: true },
             { name: 'gameParameters', type: 'object', description: 'A JSON object containing the specific game parameters. Keys include: senolytic_clearance, autophagy_boost, antioxidant_capacity_boost, dna_repair_rate_boost, epigenetic_reset_value, synaptic_density_boost, toxicity_impact.', required: true },
        ],
        implementationCode: `
            const { synergyCombination, gameParameters } = args;
            runtime.logEvent(\`[Game Data] Recording parameters for: \${synergyCombination.join(' + ')}\`);

            if (typeof gameParameters !== 'object' || gameParameters === null) {
                throw new Error("'gameParameters' must be a valid object.");
            }

            return {
                success: true,
                synergyCombination,
                gameParameters,
            };
        `
    },
    {
        name: 'RecordTrialDossier',
        description: 'Records a complete, trial-ready dossier for a specific combination, intended for business and investment review.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To capture the structured output of the "Business Analyst" agent, turning research findings into an actionable investment proposal.',
        parameters: [
            { name: 'combination', type: 'array', description: 'The array of intervention names.', required: true },
            { name: 'executiveSummary', type: 'string', description: 'A high-level summary for investors.', required: true },
            { name: 'scientificRationale', type: 'string', description: 'Detailed explanation of the biological mechanism and synergy.', required: true },
            { name: 'inSilicoValidation', type: 'string', description: 'The results from the SynergyForge simulation, presented as evidence. E.g., "Predicted healthspan increase of 45% (p<0.001, n=1000) across 3 of 4 aging models."', required: true },
            { name: 'marketAndIP', type: 'string', description: 'Analysis of the market opportunity and potential for intellectual property.', required: true },
            { name: 'roadmap', type: 'string', description: 'Proposed next steps, e.g., preclinical animal studies.', required: true },
            { name: 'risks', type: 'string', description: 'An analysis of known risks and potential side effects.', required: true },
        ],
        implementationCode: `
            const { ...dossierData } = args;
            runtime.logEvent(\`[Dossier] Recording investment proposal for: \${dossierData.combination.join(' + ')}\`);

            if (!dossierData.combination || dossierData.combination.length === 0) {
                throw new Error("A combination of interventions is required for a dossier.");
            }

            return {
                success: true,
                dossier: dossierData,
            };
        `
    },
];
