import type { ToolCreatorPayload } from '../types';

export const WORKFLOW_TOOLS: ToolCreatorPayload[] = [
    {
        name: "UpdatePricingModel",
        description: "A meta-workflow that updates the 'FindMarketPriceForLabItem' tool. It searches for new lab supply vendors, then rewrites the tool's code to include these new vendors as fallback search options, making the price search more robust.",
        category: "Automation",
        executionEnvironment: "Client",
        purpose: "To allow the system to adapt its own price-finding logic as online vendors change, ensuring long-term viability of dynamic cost estimation.",
        parameters: [],
        implementationCode: `
            runtime.logEvent('[Pricing Model Updater] 🚀 Starting self-update of price-finding logic...');
    
            // 1. Search for new vendors
            const searchResults = await runtime.search.web("top lab chemical supply companies online store", 3);
            const newVendorsText = searchResults.map(r => r.snippet).join(' ');
    
            // 2. Ask AI to extract domains
            const extractionPrompt = \`From the text below, extract a list of company domain names (like 'thermofisher.com', 'vwr.com'). Respond with a JSON object: {"vendors": ["domain1.com", "domain2.com"]}\\n\\nTEXT: \${newVendorsText}\`;
            const aiResponse = await runtime.ai.generateText(extractionPrompt, "You are a data extraction bot.");
            const jsonMatch = aiResponse.match(/\\{[\\s\\S]*\\}/);
            const newVendors = jsonMatch ? JSON.parse(jsonMatch[0]).vendors : [];
    
            if (newVendors.length === 0) {
                runtime.logEvent('[Pricing Model Updater] No new vendors found. Update aborted.');
                return { success: false, message: "No new vendors found." };
            }
            
            runtime.logEvent(\`[Pricing Model Updater] Found potential new vendors: \${newVendors.join(', ')}. Synthesizing new tool code...\`);
    
            // 3. Get old code and create a prompt to update it
            const oldTool = runtime.tools.list().find(t => t.name === 'FindMarketPriceForLabItem');
            if (!oldTool) throw new Error("Original 'FindMarketPriceForLabItem' tool not found.");
    
            const systemPrompt = "You are an expert AI system architect. Rewrite the JavaScript implementationCode for a tool based on new requirements. Then, call the 'Tool Creator' to save the updated tool. Respond ONLY with the tool call.";
            const creationPrompt = \`## TASK ##
    Rewrite the implementationCode for the 'FindMarketPriceForLabItem' tool.
    The new code must be more robust. It should:
    1. Search across multiple vendor sites: \${JSON.stringify(['sigmaaldrich.com', 'fisherscientific.com', ...newVendors])}.
    2. Iterate through the top 5 search results to find the first valid vendor link.
    3. When calling the 'Read Webpage Content' tool, it MUST pass a hardcoded 'proxyUrl' parameter with the value 'http://localhost:3002'.
    
    ## OLD CODE ##
    \`\`\`javascript
    \${oldTool.implementationCode}
    \`\`\`
    
    ## YOUR INSTRUCTIONS ##
    Generate the full, new implementationCode that incorporates all the new requirements. Then call the 'Tool Creator' tool to overwrite the old tool with your new code.\`;
    
            const toolCreatorTool = runtime.tools.list().find(t => t.name === 'Tool Creator');
            const updateResponse = await runtime.ai.processRequest(creationPrompt, systemPrompt, [toolCreatorTool]);
            const toolCall = updateResponse?.toolCalls?.[0];
    
            if (toolCall && toolCall.name === 'Tool Creator') {
                const finalArgs = {
                    ...toolCall.arguments,
                    name: 'FindMarketPriceForLabItem', // Force overwrite of the correct tool
                };
                await runtime.tools.run('Tool Creator', finalArgs);
                runtime.logEvent('[Pricing Model Updater] ✅ Successfully updated and replaced the "FindMarketPriceForLabItem" tool!');
                return { success: true, message: "Price-finding model updated." };
            } else {
                throw new Error("AI failed to generate the updated tool code.");
            }
        `
    },
    {
        name: "UpdateScoringModels",
        description: "A meta-workflow that updates the system's own scientific and financial scoring models. It searches for the latest scientific reviews and market data, synthesizes new scoring logic, and uses the 'Tool Creator' to overwrite the existing scoring tools with updated versions.",
        category: "Automation",
        executionEnvironment: "Client",
        purpose: "To ensure the agent's decision-making for prioritizing research stays current with the evolving scientific consensus and market conditions, enabling the system to self-improve.",
        parameters: [], 
        implementationCode: `
            runtime.logEvent('[Model Updater] 🚀 Starting self-update of scoring models...');
    
            // 1. Gather current data for the scientific model
            const scientificQueries = [
                "longevity interventions clinical trial risk factors review",
                "synergistic drug combinations mechanism of action review 2024 2025",
                "hallmarks of aging most promising therapeutic targets"
            ];
            const searchResult = await runtime.tools.run('Federated Scientific Search', { query: scientificQueries.join('; '), maxResultsPerSource: 3 });
            const sources = searchResult.searchResults || [];
            
            if (sources.length < 3) {
                throw new Error("Could not find enough recent review articles to update the scientific model.");
            }
    
            runtime.logEvent(\`[Model Updater] Found \${sources.length} sources for model synthesis. Reading content...\`);
    
            let contextText = "";
            for (const source of sources) {
                try {
                    const enriched = await runtime.tools.run('Find and Validate Single Source', { searchResult: source, researchObjective: "Update scientific scoring models for longevity interventions" });
                    if (enriched.validatedSource.textContent) {
                        contextText += \`\\n\\n--- SOURCE: \${enriched.validatedSource.title} ---\\n\${enriched.validatedSource.summary}\`;
                    }
                } catch (e) {
                    runtime.logEvent(\`[Model Updater] WARN: Failed to read source: \${e.message}\`);
                }
            }
    
            if (contextText.length < 500) {
                throw new Error("Not enough content from sources to build a new model.");
            }
    
            // 2. Synthesize and overwrite the scientific scoring tool
            runtime.logEvent('[Model Updater] 🧠 Synthesizing new scientific scoring logic...');
    
            const oldScoringTool = runtime.tools.list().find(t => t.name === 'Score Single Synergy');
            if (!oldScoringTool) throw new Error("Could not find the original 'Score Single Synergy' tool to update.");
    
            const systemPrompt = \`You are an expert bio-gerontologist and system architect. Your task is to update an AI agent's internal scoring tool based on the latest scientific literature.
    - You will be given the OLD source code of the tool and NEW scientific context.
    - You must generate the FULL, NEW source code for the tool.
    - The new logic should reflect the insights from the new context (e.g., if new risks are mentioned, lower the scores; if a new pathway is promising, increase the scores).
    - Finally, you MUST call the 'Tool Creator' tool to overwrite the old tool with your new implementation.\`;
    
            const creationPrompt = \`## LATEST SCIENTIFIC CONTEXT ##
    \${contextText.substring(0, 15000)}
    
    ## OLD TOOL SOURCE CODE (Score Single Synergy) ##
    // Purpose: \${oldScoringTool.purpose}
    const OLD_CODE = \`\${oldScoringTool.implementationCode}\`;
    
    ## YOUR TASK ##
    Based on the LATEST CONTEXT, rewrite the implementationCode for the 'Score Single Synergy' tool. 
    - Keep the function signature and return format the same.
    - Modify the internal logic, especially inside the AI prompts, to reflect the new scientific understanding.
    - Then, call the 'Tool Creator' tool with the new code to save your changes.\`;
    
            try {
                const toolCreatorTool = runtime.tools.list().find(t => t.name === 'Tool Creator');
                const aiResponse = await runtime.ai.processRequest(creationPrompt, systemPrompt, [toolCreatorTool]);
                const toolCall = aiResponse?.toolCalls?.[0];
    
                if (toolCall && toolCall.name === 'Tool Creator') {
                    // Ensure the AI doesn't change critical fields
                    const finalArgs = {
                        ...toolCall.arguments,
                        name: 'Score Single Synergy', // Prevent AI from renaming the tool
                        category: 'Functional',
                        executionEnvironment: 'Client',
                    };
                    await runtime.tools.run('Tool Creator', finalArgs);
                    runtime.logEvent('[Model Updater] ✅ Successfully updated and replaced the "Score Single Synergy" tool.');
                } else {
                     throw new Error("AI failed to generate a call to 'Tool Creator'.");
                }
            } catch (e) {
                 runtime.logEvent(\`[Model Updater] ❌ Failed to update scientific model: \${e.message}\`);
            }
            
            // (Optional) A similar logic block could be added here to update the 'Price Experiment Plan' tool
    
            return { success: true, message: "Scoring model update process completed." };
        `
    },
    {
        name: 'Mass Hypothesis Generation and Ranking',
        description: 'A venture-focused workflow that iterates through all research vacancies, generates a novel hypothesis for each, estimates its validation cost, and records it.',
        category: 'Automation',
        executionEnvironment: 'Client',
        purpose: 'To transform the research map into a high-throughput engine for creating a portfolio of cost-analyzed, testable, and investment-ready R&D projects.',
        parameters: [
            { name: 'mapData', type: 'array', description: 'The full map data from the UI, containing all sources with coordinates and embeddings.', required: true },
            { name: 'vacancies', type: 'array', description: 'The full list of vacancy objects from the UI.', required: true },
        ],
        implementationCode: `
            const { mapData, vacancies } = args;

            if (!vacancies || vacancies.length === 0) {
                runtime.logEvent('[Venture Workflow] No vacancies found on the map. Nothing to generate.');
                return { success: true, message: "No vacancies to process." };
            }

            runtime.logEvent(\`[Venture Workflow] Starting mass hypothesis generation for \${vacancies.length} vacancies...\`);
            let generatedCount = 0;

            for (const [index, vacancy] of vacancies.entries()) {
                runtime.logEvent(\`[Venture Workflow] -> Processing vacancy \${index + 1}/\${vacancies.length}...\`);
                try {
                    // 1. Generate the core hypothesis
                    const interpretationResult = await runtime.tools.run('InterpretVacancy', { vacancy, mapData });
                    const { hypotheticalAbstract, proposedCombination, coreMechanism, neighbors } = interpretationResult;

                    // 2. Deconstruct hypothesis into a concrete experiment plan
                    const planResult = await runtime.tools.run('Deconstruct Hypothesis to Experiment Plan', { hypotheticalAbstract });
                    const { experimentPlan } = planResult;
                    
                    // 3. Price the generated experiment plan
                    const costResult = await runtime.tools.run('Price Experiment Plan', { experimentPlan });
                    const { estimatedCost, costBreakdown } = costResult;

                    // 4. Assess organ-specific impact
                    const organImpactResult = await runtime.tools.run('Assess Organ-Specific Aging Impact', { synergySummary: hypotheticalAbstract });
                    const { organImpacts } = organImpactResult;
                    
                    // 5. Create the full hypothesis object
                    const fullHypothesis = {
                        hypotheticalAbstract,
                        proposedCombination,
                        coreMechanism,
                        neighbors,
                        estimatedCost,
                        requiredAssays: experimentPlan.key_measurements,
                        experimentPlan,
                        costBreakdown,
                        organImpacts,
                        trialPriorityScore: 50, // Assign a default score
                    };

                    await runtime.tools.run('RecordSynergy', {
                       combination: fullHypothesis.proposedCombination,
                       status: "Hypothesized (De Novo)",
                       summary: fullHypothesis.hypotheticalAbstract,
                       potentialRisks: "Not yet analyzed.",
                       synergyType: "Synergistic",
                       // Attach all other analyzed data
                       ...fullHypothesis,
                    });


                    generatedCount++;
                } catch (e) {
                    runtime.logEvent(\`[Venture Workflow] -> ❌ Failed to process vacancy \${index + 1}: \${e.message}\`);
                }
                await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
            }

            const finalMessage = \`Venture workflow complete. Successfully generated and analyzed \${generatedCount} of \${vacancies.length} hypotheses.\`;
            runtime.logEvent(\`[Venture Workflow] ✅ \${finalMessage}\`);
            return { success: true, message: finalMessage };
        `
    },
    {
        name: 'AdaptFetchStrategy',
        description: 'A self-healing workflow that activates when web fetching fails. It discovers new CORS proxy builders using an AI, then updates the runtime with these new strategies to overcome blockades.',
        category: 'Automation',
        executionEnvironment: 'Client',
        purpose: 'To provide a robust, autonomous recovery mechanism for network-related failures during research, enabling the agent to adapt and learn on the fly.',
        parameters: [],
        implementationCode: `
            runtime.logEvent('[Adapt] Initiating fetch adaptation strategy...');
            try {
                // Step 1: Discover new proxy builder functions using AI
                const discoveryResult = await runtime.tools.run('DiscoverProxyBuilders', {});
                const newBuilderStrings = discoveryResult.newBuilderStrings;

                if (!newBuilderStrings || newBuilderStrings.length === 0) {
                    throw new Error("Discovery tool failed to return new proxy builder strings.");
                }

                // Step 2: Update the runtime's proxy list with the new discoveries
                const updateResult = await runtime.search.updateProxyList(newBuilderStrings);
                runtime.logEvent(\`[Adapt] ✅ Adaptation complete. \${updateResult.message}\`);
                return { success: true, message: 'Fetch strategy adapted successfully.' };
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                runtime.logEvent(\`[Adapt] ❌ Adaptation strategy failed: \${errorMessage}\`);
                throw new Error(\`AdaptFetchStrategy failed: \${errorMessage}\`);
            }
        `
    },
    {
        name: 'Execute Full Research and Proposal Workflow',
        description: 'Executes the complete, end-to-end workflow from scientific literature search to generating a ranked portfolio of investment-ready dossiers.',
        category: 'Automation',
        executionEnvironment: 'Client',
        purpose: 'To provide a single, powerful command for the agent to perform its entire core function autonomously, resulting in a final ranked list of investment proposals.',
        parameters: [
            { name: 'researchObjective', type: 'string', description: 'The user\'s high-level research objective (e.g., "Find novel synergistic treatments for Alzheimer\'s disease").', required: true },
        ],
        implementationCode: `
        const { researchObjective } = args;
        runtime.logEvent('[Workflow] Starting new dynamic research workflow...');

        // -- INTELLIGENT CONTINUATION: Get existing knowledge --
        const existingSources = runtime.getState().allSources || [];
        const existingSourceUris = new Set(existingSources.map(s => s.uri || s.url));
        runtime.logEvent(\`[Workflow] Continuing session with \${existingSourceUris.size} already validated sources.\`);


        // Step 1: Refine Search Queries
        runtime.logEvent('[Workflow] Step 1: Refining search queries...');
        const refineResult = await runtime.tools.run('Refine Search Queries', { researchObjective });
        const refinedQueryString = refineResult.queries.join('; ');

        // Step 2: Deep Federated Search
        runtime.logEvent('[Workflow] Step 2: Performing deep search for *new* literature...');
        let proxyUrl = null;
        if (runtime.isServerConnected()) {
            try {
                const proxyBootstrapResult = await runtime.tools.run('Test Web Proxy Service', {});
                proxyUrl = proxyBootstrapResult.proxyUrl;
            } catch (e) {
                runtime.logEvent(\`[Workflow] WARN: Could not start or test local proxy service: \${e.message}\`);
            }
        }
        
        const searchResult = await runtime.tools.run('Federated Scientific Search', { query: refinedQueryString, maxResultsPerSource: 20, proxyUrl });
        let initialSearchResults = searchResult.searchResults || [];
        
        // -- INTELLIGENT CONTINUATION: Filter out already processed sources --
        const newSearchResults = initialSearchResults.filter(result => {
            const canonicalUrl = runtime.search.buildCanonicalUrl(result.link);
            return canonicalUrl && !existingSourceUris.has(canonicalUrl);
        });
        
        runtime.logEvent(\`[Workflow] Search found \${initialSearchResults.length} total results. \${newSearchResults.length} are new and will be processed.\`);

        if (newSearchResults.length === 0 && initialSearchResults.length > 0) {
            runtime.logEvent('[Workflow] No new articles found matching the query. Analysis will proceed with existing data.');
        }

        if (newSearchResults.length === 0 && initialSearchResults.length === 0) {
            runtime.logEvent('[Workflow] Initial search failed. Engaging diagnostic retry...');
            const retrySearchResult = await runtime.tools.run('Diagnose and Retry Search', { originalQuery: refinedQueryString, researchObjective, reasonForFailure: 'The initial refined queries returned zero results.', proxyUrl });
            const retryResults = retrySearchResult.searchResults || [];
            
            // Also filter the retry results
            const newRetryResults = retryResults.filter(result => {
                const canonicalUrl = runtime.search.buildCanonicalUrl(result.link);
                return canonicalUrl && !existingSourceUris.has(canonicalUrl);
            });
            
            if (newRetryResults.length === 0) {
                 throw new Error("Workflow failed at Step 2: Search returned no new results, even after retry.");
            }
            initialSearchResults = newRetryResults; // Use the deduplicated retry results
        } else {
            initialSearchResults = newSearchResults; // Use the deduplicated initial results
        }


        // Step 3: Rank New Search Results
        runtime.logEvent(\`[Workflow] Step 3: Ranking \${initialSearchResults.length} new sources...\`);
        const rankResult = await runtime.tools.run('Rank Search Results', { searchResults: initialSearchResults, researchObjective });
        const rankedSearchResults = rankResult.rankedResults;
        
        // Step 4: Iterative Processing of New Sources
        runtime.logEvent(\`[Workflow] Step 4: Starting iterative analysis of \${rankedSearchResults.length} new sources...\`);
        const newlyValidatedSources = [];
        const allFoundSynergies = [];
        let dossiersGenerated = 0;

        for (const [index, searchItem] of rankedSearchResults.entries()) {
            runtime.logEvent(\`[Workflow] Processing \${index + 1}/\${rankedSearchResults.length}: \${searchItem.title}\`);
            
            try {
                const validationResult = await runtime.tools.run('Find and Validate Single Source', { searchResult: searchItem, researchObjective, proxyUrl });
                const validatedSource = validationResult.validatedSource;
                
                if (!validatedSource || validatedSource.reliabilityScore < 0.5) {
                    runtime.logEvent(\`[Workflow] -> Source deemed unreliable or failed validation. Skipping.\`);
                    continue;
                }
                newlyValidatedSources.push(validatedSource);

                const analysisResult = await runtime.tools.run('Analyze Single Source for Synergies', { 
                    sourceToAnalyze: validatedSource, 
                    researchObjective, 
                    metaAnalyses: [...existingSources, ...newlyValidatedSources].filter(s => s.isMeta)
                });

                const newSynergies = analysisResult.synergies || [];
                if (newSynergies.length > 0) {
                    allFoundSynergies.push(...newSynergies);
                    
                    newSynergies.sort((a,b) => (b.trialPriorityScore || 0) - (a.trialPriorityScore || 0));
                    const bestSynergyFromSource = newSynergies[0];

                    if (bestSynergyFromSource.trialPriorityScore > 85 && dossiersGenerated < 5) { // High threshold and limit dossiers
                        runtime.logEvent(\`[Workflow] -> ⭐ Exceptional synergy found! Generating dossier immediately...\`);
                        await runtime.tools.run('Generate Proposal for Single Synergy', { 
                            synergy: bestSynergyFromSource, 
                            backgroundSources: [...existingSources, ...newlyValidatedSources]
                        });
                        dossiersGenerated++;
                    }
                }
            } catch (e) {
                runtime.logEvent(\`[Workflow] -> ❌ Error processing source: \${e.message}\`);
            }
        }
        
        const totalValidatedSources = existingSources.length + newlyValidatedSources.length;
        if (totalValidatedSources === 0) {
            throw new Error("Workflow failed: No reliable sources could be validated from the search results.");
        }
        if (allFoundSynergies.length === 0 && newlyValidatedSources.length > 0) {
             runtime.logEvent("[Workflow] ⚠️ WARNING: Analysis of new sources complete, but no new synergies were found.");
        }

        const finalSummary = \`Workflow completed. Processed \${rankedSearchResults.length} new sources, validated \${newlyValidatedSources.length}, and found \${allFoundSynergies.length} new potential synergies. Total knowledge base now contains \${totalValidatedSources} sources.\`;
        runtime.logEvent(\`[Workflow] ✅ \${finalSummary}\`);
        return { success: true, message: "Workflow finished successfully.", summary: finalSummary };
    `
    },
    {
        name: 'Generate Hypotheses for Top Vacancies',
        description: 'An internal workflow to opportunistically generate and analyze hypotheses for the most promising vacancies on the map.',
        category: 'Automation',
        executionEnvironment: 'Client',
        purpose: 'To provide early, high-value results during a long research task by focusing on personalized vacancies as soon as enough data is available.',
        parameters: [
            { name: 'researchObjective', type: 'string', description: 'The original research objective.', required: true },
            { name: 'validatedSources', type: 'array', description: 'The current list of validated sources to build the map from.', required: true },
        ],
        implementationCode: `
            const { researchObjective, validatedSources } = args;

            // 1. Build a temporary map from the current sources
            const embedResult = await runtime.tools.run('Embed All Sources', { sources: validatedSources });
            const mapResult = await runtime.tools.run('Generate 2D Map Coordinates', { embeddedSources: embedResult.embeddedSources });
            const mapData = mapResult.mapData;

            if (!mapData || mapData.length === 0) {
                runtime.logEvent('[Opportunistic] Could not generate a map from the provided sources. Aborting.');
                return;
            }

            // 2. Identify vacancies on this temporary map
            const tempVacancies = [];
            const mapSize = 500;
            const gridSize = 20;
            const cellSize = mapSize / gridSize;
            const grid = Array(gridSize).fill(0).map(() => Array(gridSize).fill(0));
            for (const point of mapData) {
                const gridX = Math.floor(point.x / cellSize);
                const gridY = Math.floor(point.y / cellSize);
                if (grid[gridX] && grid[gridX][gridY] !== undefined) grid[gridX][gridY]++;
            }
            for (let i = 0; i < gridSize; i++) {
                for (let j = 0; j < gridSize; j++) {
                    if (grid[i][j] <= 1) { // Using threshold 1 for early map
                        tempVacancies.push({ id: \`v-\${i}-\${j}\`, x: (i + 0.5) * cellSize, y: (j + 0.5) * cellSize, radius: cellSize * 0.7 });
                    }
                }
            }
            
            // 3. Find the most promising vacancies (e.g., personalized)
            // Note: This simplified version just takes the first few. A real implementation would call personalization tools.
            const topVacancies = tempVacancies.slice(0, 3); // Generate for top 3 found vacancies
            
            runtime.logEvent(\`[Opportunistic] Found \${topVacancies.length} promising vacancies to analyze...\`);

            // 4. Run the full analysis pipeline for each top vacancy
            for (const vacancy of topVacancies) {
                 try {
                    const interpretationResult = await runtime.tools.run('InterpretVacancy', { vacancy, mapData });
                    const { hypotheticalAbstract, proposedCombination, coreMechanism, neighbors } = interpretationResult;
                    const planResult = await runtime.tools.run('Deconstruct Hypothesis to Experiment Plan', { hypotheticalAbstract });
                    const costResult = await runtime.tools.run('Price Experiment Plan', { experimentPlan: planResult.experimentPlan });
                    const organImpactResult = await runtime.tools.run('Assess Organ-Specific Aging Impact', { synergySummary: hypotheticalAbstract });
                    
                    await runtime.tools.run('RecordSynergy', {
                        combination: proposedCombination,
                        status: "Hypothesized (De Novo)",
                        summary: hypotheticalAbstract,
                        potentialRisks: "Not yet analyzed.",
                        synergyType: "Synergistic",
                        // Attach analyzed data
                        estimatedCost: costResult.estimatedCost,
                        costBreakdown: costResult.costBreakdown,
                        organImpacts: organImpactResult.organImpacts,
                        trialPriorityScore: 50,
                    });

                } catch (e) {
                    runtime.logEvent(\`[Opportunistic] ⚠️ Failed to process a vacancy: \${e.message}\`);
                }
            }
            return { success: true, message: \`Opportunistic generation completed for \${topVacancies.length} vacancies.\` };
        `
    },
    {
        name: 'Bootstrap Web Proxy Service',
        description: 'Creates and launches a dedicated local microservice (MCP) for reliably fetching web content, bypassing client-side CORS issues.',
        category: 'Automation',
        executionEnvironment: 'Client',
        purpose: 'To establish a robust, server-side web browsing capability as a foundational microservice for research agents.',
        parameters: [],
        implementationCode: `
        const serviceId = 'web_proxy_service';
        const scriptPath = 'web_proxy_service.ts';
        const port = 3002;
        const proxyUrl = \`http://localhost:\${port}\`;

        runtime.logEvent(\`[MCP] Bootstrapping Web Proxy Service (\${serviceId})...\`);

        if (!runtime.isServerConnected()) {
            runtime.logEvent('[MCP] Server not connected. Cannot bootstrap proxy service. This workflow step will be skipped.');
            return { success: false, message: 'Server not connected; could not start proxy.' };
        }

        // Check if process is already running
        try {
            const processesResult = await runtime.tools.run('List Managed Processes', {});
            const isRunning = processesResult.processes.some(p => p.processId === serviceId && p.isRunning);
            if (isRunning) {
                return { success: true, message: \`Web Proxy Service is already running.\`, proxyUrl };
            }
        } catch (e) {
            runtime.logEvent(\`[MCP] WARN: Could not check for existing processes: \${e.message}. Assuming not running and proceeding.\`);
        }
       
        const serverCode = \`
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = \` + port + \`;

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
    'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko'
];

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.post('/browse', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).send('URL is required.');
    }
    console.log('[Web Proxy] Fetching URL: ' + url);
    try {
        const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        const response = await fetch(url, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'User-Agent': userAgent,
                'Sec-Ch-Ua': '"Not/A)Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'cross-site',
                'Upgrade-Insecure-Requests': '1',
            }
        });
        
        const body = await response.text();
        const contentType = response.headers.get('content-type') || 'text/plain';
        
        res.setHeader('Content-Type', contentType);
        res.status(response.status).send(body);

    } catch (e) {
        const error = e as Error;
        console.error('[Web Proxy] Failed to browse URL ' + url + ': ' + error.message);
        res.status(500).json({ error: 'Failed to retrieve or process content from URL. Reason: ' + error.message });
    }
});

app.listen(PORT, () => {
    console.log('[Web Proxy] Service listening on http://localhost:' + PORT);
});
\`;

        // Use Server File Writer to create the script
        await runtime.tools.run('Server File Writer', {
            filePath: scriptPath,
            content: serverCode,
            baseDir: 'scripts',
        });
        runtime.logEvent(\`[MCP] Web proxy script written to \${scriptPath}.\`);

        // Use Start Node Process to launch the service
        await runtime.tools.run('Start Node Process', {
            processId: serviceId,
            scriptPath: scriptPath,
        });
        runtime.logEvent(\`[MCP] Web Proxy Service started.\`);

        return { success: true, message: 'Web Proxy Service bootstrapped successfully.', proxyUrl };
    `
    },
     {
        name: 'Test Web Proxy Service',
        description: 'Starts and verifies the local web proxy microservice by fetching a known, simple test URL to confirm it is working correctly.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To provide a simple diagnostic for ensuring the application\'s core networking component is functional before running complex research tasks.',
        parameters: [
            { name: 'testUrl', type: 'string', description: 'Optional. The URL to fetch for the test. Defaults to a known simple site.', required: false },
        ],
        implementationCode: `
            const { testUrl = 'https://info.cern.ch/' } = args; // The first website, simple and reliable.
            runtime.logEvent('[Proxy Test] Starting test...');

            // Step 1: Bootstrap the proxy
            runtime.logEvent('[Proxy Test] Bootstrapping proxy service...');
            const bootstrapResult = await runtime.tools.run('Bootstrap Web Proxy Service', {});
            if (!bootstrapResult || !bootstrapResult.proxyUrl) {
                throw new Error("Failed to bootstrap the web proxy service. Cannot continue test.");
            }
            const proxyUrl = bootstrapResult.proxyUrl;
            runtime.logEvent(\`[Proxy Test] Proxy service appears to be running at: \${proxyUrl}\`);

            // Step 2: Test fetching a URL
            runtime.logEvent(\`[Proxy Test] Attempting to fetch test URL: \${testUrl}\`);
            const readResult = await runtime.tools.run('Read Webpage Content', { url: testUrl, proxyUrl: proxyUrl });

            if (!readResult || !readResult.textContent) {
                throw new Error("Successfully started proxy, but failed to fetch content from the test URL.");
            }

            const contentSnippet = readResult.textContent.substring(0, 200).replace(/\\s+/g, ' ');
            runtime.logEvent(\`[Proxy Test] ✅ Successfully fetched content snippet: "\${contentSnippet}..."\`);

            return {
                success: true,
                message: \`Proxy service test PASSED. Successfully fetched content from \${testUrl}.\`,
                proxyUrl: proxyUrl,
                contentSnippet: contentSnippet,
            };
        `
    },
];