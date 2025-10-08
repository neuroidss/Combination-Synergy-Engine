import type { ToolCreatorPayload } from '../types';

export const SYNERGY_FORGE_FUNCTIONAL_TOOLS: ToolCreatorPayload[] = [
    {
        name: 'Initial Literature Search',
        description: 'Performs a web search to find primary scientific sources for a given research query. Returns a raw list of potential sources for further validation.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To gather a broad list of potential scientific literature for the first stage of research.',
        parameters: [
            { name: 'query', type: 'string', description: 'The research topic to investigate (e.g., "synergistic effects of metformin and rapamycin on aging").', required: true },
        ],
        implementationCode: `
            const { query } = args;
            runtime.logEvent(\`[Search] Starting literature search for: "\${query}"\`);

            const searchResult = await runtime.ai.search(\`Find primary scientific literature and studies for: "\${query}"\`);
            
            runtime.logEvent(\`[Search] Found \${searchResult.sources.length} potential sources.\`);

            if (searchResult.sources.length === 0) {
                return { success: true, message: "No primary sources found.", potentialSources: [] };
            }

            return {
                success: true,
                message: \`Found \${searchResult.sources.length} potential sources.\`,
                potentialSources: searchResult.sources.map(s => ({ title: s.title, url: s.uri })),
            }
        `,
    },
    {
        name: 'RecordValidatedSource',
        description: 'Records the validation status, reliability, and summary of a single scientific source. This tool is called after the agent has analyzed a source.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To log the structured output of the validation and summarization step for a single source, avoiding fragile JSON parsing.',
        parameters: [
            { name: 'source', type: 'object', description: 'The original source object being validated, including its "url" and "title".', required: true },
            { name: 'isScientific', type: 'boolean', description: 'True if the source is a primary scientific article, false otherwise.', required: true },
            { name: 'justification', type: 'string', description: 'A brief justification for the isScientific classification.', required: true },
            { name: 'reliabilityScore', type: 'number', description: 'A score from 0.0 to 1.0 indicating the source\'s reliability.', required: true },
            { name: 'summary', type: 'string', description: 'A concise summary of the source\'s key findings if it is scientific, otherwise an empty string.', required: true },
        ],
        implementationCode: `
            const { source, isScientific, justification, reliabilityScore, summary } = args;
            if (!source || !source.url) throw new Error("A valid source object with a URL is required.");
            runtime.logEvent(\`[Validation] Recording result for: \${source.title || source.url}\`);
            
            // This tool's purpose is simply to return the structured data it was given.
            // The AI agent does the analysis and calls this tool with the results.
            return {
                success: true,
                validatedSource: {
                    ...source,
                    isScientific,
                    justification,
                    reliabilityScore,
                    summary,
                }
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
