import type { ToolCreatorPayload } from '../types';

export const WORKFLOW_TOOLS: ToolCreatorPayload[] = [
    {
        name: 'GenerateCommercializationOutlook',
        description: 'Executes a full commercial analysis for a synergy, covering target indication, market size, and IP strategy.',
        category: 'Automation',
        executionEnvironment: 'Client',
        purpose: 'To orchestrate multiple analysis tools to build a comprehensive, investment-focused commercial outlook for a scientific hypothesis.',
        parameters: [
            { name: 'synergyData', type: 'object', description: 'The full synergy object, including combination, summary, and MoA justification.', required: true }
        ],
        implementationCode: `
            const { synergyData } = args;
            runtime.logEvent('[Commercial] Starting commercialization outlook analysis...');

            // 1. Find best indication
            const indicationsResult = await runtime.tools.run('FindPotentialIndications', { 
                synergySummary: synergyData.summary,
                combination: synergyData.combination 
            });
            const targetIndication = indicationsResult.indications[0]; // Pick the top one
            runtime.logEvent(\`[Commercial] Identified Target Indication: \${targetIndication.indication}\`);

            // 2. Get market data for that indication
            const marketDataResult = await runtime.tools.run('AnalyzeMarketData', { indication: targetIndication.indication });
            runtime.logEvent(\`[Commercial] Market Size (TAM): \${marketDataResult.marketData.tam}\`);

            // 3. NEW STEP: Get competitor data
            const competitorsResult = await runtime.tools.run('AnalyzeCompetitors', { indication: targetIndication.indication });
            runtime.logEvent(\`[Commercial] Identified Competitors: \${(competitorsResult.competitors || []).join(', ')}\`);

            // Add competitors to market data
            const marketDataWithCompetitors = {
                ...marketDataResult.marketData,
                competitors: competitorsResult.competitors || [],
            };

            // 4. Propose IP strategy
            const ipStrategyResult = await runtime.tools.run('ProposeIntellectualPropertyStrategy', { 
                components: synergyData.combination,
                indication: targetIndication.indication
            });
            runtime.logEvent(\`[Commercial] Proposed IP Strategy: \${ipStrategyResult.strategies[0].type}\`);

            // 5. Determine Regulatory Pathway
            const regulatoryPrompt = \`A therapeutic combines these components: \${synergyData.combination.map(c=>c.name).join(', ')} to treat '\${targetIndication.indication}'. What is the most likely US FDA regulatory pathway (e.g., 505(b)(2) NDA, IND, Medical Food)? Respond with JSON: {"pathway": "...", "justification": "..."}\`;
            const regulatorySystemInstruction = "You are a regulatory affairs expert. Respond ONLY with a valid JSON object.";
            const regulatoryResponseText = await runtime.ai.generateText(regulatoryPrompt, regulatorySystemInstruction);
            const regulatoryJsonMatch = regulatoryResponseText.match(/\\{[\\s\\S]*\\}/);
            const regulatoryData = regulatoryJsonMatch ? JSON.parse(regulatoryJsonMatch[0]) : { pathway: "Unknown", justification: "AI failed to determine pathway." };
            runtime.logEvent(\`[Commercial] Determined Regulatory Pathway: \${regulatoryData.pathway}\`);

            // 6. Assemble and return the final outlook object
            const finalOutlook = {
                targetIndication: targetIndication.indication,
                indicationJustification: targetIndication.justification,
                marketData: marketDataWithCompetitors,
                ipStrategy: ipStrategyResult.strategies[0],
                regulatoryPathway: regulatoryData,
            };

            return { success: true, commercializationOutlook: finalOutlook };
        `
    },
    {
        name: "SentinelAgentPeriodicCheck",
        description: "A background workflow that acts as a 'Sentinel'. It periodically searches for new, high-impact scientific literature related to already discovered synergies and triggers a re-evaluation if necessary.",
        category: "Automation",
        executionEnvironment: "Client",
        purpose: "To ensure the 'Living Atlas' of knowledge remains up-to-date by proactively monitoring for new scientific findings that could alter previous conclusions.",
        parameters: [
             { name: 'allDossiers', type: 'array', description: 'The complete list of all currently stored dossiers.', required: true },
             { name: 'allSources', type: 'array', description: 'The complete list of all validated sources.', required: true },
        ],
        implementationCode: `
            const { allDossiers, allSources } = args;
            runtime.logEvent('[Sentinel] 🛡️ Awakening... Scanning for new, high-impact research.');

            if (!allDossiers || allDossiers.length === 0) {
                runtime.logEvent('[Sentinel] No existing dossiers to monitor. Sleeping.');
                return { success: true, message: "No dossiers to monitor." };
            }

            // 1. Gather keywords from existing high-value synergies
            const keywords = new Set();
            allDossiers.forEach(d => {
                (d.data.synergyData.combination || []).forEach(c => keywords.add(c.name));
            });
            const keywordArray = Array.from(keywords);
            
            if (keywordArray.length === 0) {
                 runtime.logEvent('[Sentinel] No keywords to search for. Sleeping.');
                 return { success: true, message: "No keywords." };
            }

            // 2. Search for new literature published this year
            const currentYear = new Date().getFullYear();
            const searchQuery = keywordArray.slice(0, 5).join(' OR '); // Limit query length
            const searchResult = await runtime.tools.run('Federated Scientific Search', { 
                query: searchQuery, 
                maxResultsPerSource: 5, 
                sinceYear: currentYear 
            });

            const newSources = searchResult.searchResults || [];
            const existingSourceUris = new Set(allSources.map(s => s.uri));
            const trulyNewSources = newSources.filter(s => !existingSourceUris.has(s.link));

            if (trulyNewSources.length === 0) {
                runtime.logEvent('[Sentinel] No new relevant articles found. Atlas is current.');
                return { success: true, message: "No new articles found." };
            }
            runtime.logEvent(\`[Sentinel] Found \${trulyNewSources.length} potentially new articles. Assessing impact...\`);
            
            // 3. Assess impact and trigger re-evaluation
            let reevaluationsTriggered = 0;
            for (const newSource of trulyNewSources) {
                const validatedSource = await runtime.tools.run('Find and Validate Single Source', { searchResult: newSource, researchObjective: "Assess impact on longevity knowledge base" });
                
                const impactResult = await runtime.tools.run('AssessSourceImpact', { source: validatedSource.validatedSource, existingKeywords: keywordArray });

                if (impactResult.impact === 'HIGH_IMPACT') {
                    runtime.logEvent(\`[Sentinel] 🔥 HIGH IMPACT source found: "\${validatedSource.validatedSource.title}". Triggering re-evaluation for related dossiers.\`);
                    // Find dossiers related to this new source
                    const relatedDossiers = allDossiers.filter(d => 
                        keywordArray.some(k => validatedSource.validatedSource.summary.toLowerCase().includes(k.toLowerCase()))
                    );

                    for (const dossier of relatedDossiers) {
                        await runtime.tools.run('ExecuteReevaluationProtocol', {
                            staleDossier: dossier,
                            triggeringSource: validatedSource.validatedSource,
                            allSources: allSources
                        });
                        reevaluationsTriggered++;
                    }
                }
            }

            const finalMessage = \`Sentinel scan complete. Found \${trulyNewSources.length} new sources, triggered \${reevaluationsTriggered} re-evaluations.\`;
            runtime.logEvent(\`[Sentinel] ✅ \${finalMessage}\`);
            return { success: true, message: finalMessage };
        `
    },
     {
        name: "ExecuteReevaluationProtocol",
        description: "The core re-evaluation workflow. Takes a 'stale' dossier and a new 'triggering' source, re-runs the full risk analysis, compares the new result with the old, and records the updated, versioned dossier with a changelog.",
        category: "Automation",
        executionEnvironment: "Client",
        purpose: "To maintain the integrity and accuracy of the 'Living Atlas' by systematically updating knowledge based on new, high-impact evidence.",
        parameters: [
            { name: 'staleDossier', type: 'object', description: 'The old dossier object that needs re-evaluation.', required: true },
            { name: 'triggeringSource', type: 'object', description: 'The new, high-impact source that prompted this re-evaluation.', required: true },
            { name: 'allSources', type: 'array', description: 'The complete list of all validated sources to provide full context.', required: true },
        ],
        implementationCode: `
            const { staleDossier, triggeringSource, allSources } = args;
            const comboString = staleDossier.data.synergyData.combination.map(c => c.name).join(' + ');
            runtime.logEvent(\`[Re-evaluation] 🔄 Starting re-evaluation for \${comboString} based on new source: "\${triggeringSource.title.substring(0,40)}..."\`);
            
            // 1. Re-run the dossier generation with the new source included in the context
            const newDossierResult = await runtime.tools.run('GenerateRiskEngineeringDossier', {
                synergy: staleDossier.data.synergyData,
                backgroundSources: [...allSources, triggeringSource]
            });
            const newDossier = newDossierResult.dossier;

            // 2. Compare the old and new dossiers to generate a changelog
            const comparisonResult = await runtime.tools.run('CompareRiskDossiers', {
                oldDossier: staleDossier.data,
                newDossier: newDossier,
                triggeringSource: triggeringSource
            });
            const changelog = comparisonResult.changelog || ["Re-evaluated with new data."];
            
            // 3. Assemble and record the new, versioned dossier
            const oldVersion = staleDossier.data.version || 1;
            const oldHistory = staleDossier.data.history || [\`v1.0: Initial dossier generated on \${new Date(staleDossier.data.updatedAt).toLocaleDateString()}.\`];

            const newHistoryEntry = \`v\${oldVersion + 1}.0 (\${new Date().toLocaleDateString()}): \${changelog.join(' ')}\`;
            
            const recordResult = await runtime.tools.run('RecordTrialDossier', {
                ...newDossier,
                version: oldVersion + 1,
                history: [...oldHistory, newHistoryEntry]
            });

            runtime.logEvent(\`[Re-evaluation] ✅ \${comboString} updated to v\${oldVersion + 1}.0 and recorded.\`);
            return recordResult;
        `
    },
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

        // Step 2: Deep Federated Search with Self-Healing
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
        
        let searchResult = await runtime.tools.run('Federated Scientific Search', { query: refinedQueryString, maxResultsPerSource: 20, proxyUrl });
        let initialSearchResults = searchResult.searchResults || [];
        
        // Check if search failed completely
        if (initialSearchResults.length === 0) {
            // A. Check for network errors in the log
            const recentLogs = runtime.getState().eventLog.slice(-50); // check last 50 logs
            const hasFetchError = recentLogs.some(log => log.includes('[Fetch] WARN') || log.includes('All direct and proxy fetch attempts failed'));
        
            if (hasFetchError) {
                runtime.logEvent('[Workflow] Search returned no results and network errors were detected. Engaging fetch adaptation protocol...');
                try {
                    await runtime.tools.run('AdaptFetchStrategy', {});
                    runtime.logEvent('[Workflow] Fetch strategy adapted. Retrying search with original queries...');
                    // Retry the original search
                    searchResult = await runtime.tools.run('Federated Scientific Search', { query: refinedQueryString, maxResultsPerSource: 20, proxyUrl });
                    initialSearchResults = searchResult.searchResults || [];
                } catch (adaptError) {
                    runtime.logEvent(\`[Workflow] ⚠️ Fetch adaptation failed: \${adaptError.message}. Proceeding with diagnostic query retry as fallback.\`);
                }
            }
            
            // B. If still no results (either adaptation didn't work, wasn't triggered, or also failed), use query diagnosis.
            if (initialSearchResults.length === 0) {
                runtime.logEvent('[Workflow] Initial search (and potential adaptation) yielded no results. Engaging diagnostic query retry...');
                const retrySearchResult = await runtime.tools.run('Diagnose and Retry Search', { originalQuery: refinedQueryString, researchObjective, reasonForFailure: 'The initial refined queries returned zero results.', proxyUrl });
                initialSearchResults = retrySearchResult.searchResults || [];
            }
        }
        
        // C. Final check and filter for new results
        const newSearchResults = initialSearchResults.filter(result => {
            const canonicalUrl = runtime.search.buildCanonicalUrl(result.link);
            return canonicalUrl && !existingSourceUris.has(canonicalUrl);
        });
        
        runtime.logEvent(\`[Workflow] Search found \${initialSearchResults.length} total results. \${newSearchResults.length} are new and will be processed.\`);
        
        if (newSearchResults.length === 0) {
            if (initialSearchResults.length > 0) {
                runtime.logEvent('[Workflow] No *new* articles found matching the query. Analysis complete for this objective.');
            } else {
                // If we are here, it means initial search, adaptation, and query retry ALL failed to find anything. This is a fatal error.
                throw new Error("Workflow failed at Step 2: Search returned no results, even after adaptation and query retry.");
            }
        }

        // Step 3: Rank New Search Results
        runtime.logEvent(\`[Workflow] Step 3: Ranking \${newSearchResults.length} new sources...\`);
        const rankResult = await runtime.tools.run('Rank Search Results', { searchResults: newSearchResults, researchObjective });
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
                        await runtime.tools.run('GenerateRiskEngineeringDossier', { 
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
        
        // Step 5: Final Ranking and Critique of Top Proposals
        runtime.logEvent(\`[Workflow] Step 5: All new sources processed. Critiquing top generated proposals...\`);
        
        const allDossiers = runtime.getState().liveFeed.filter(item => item.type === 'dossier');
        
        if (allDossiers.length > 0) {
            const rankedDossiers = allDossiers.sort((a,b) => (b.data.synergyData.trialPriorityScore || 0) - (a.data.synergyData.trialPriorityScore || 0));
            const topDossiersToCritique = rankedDossiers.slice(0, 2); // Critique the top 2

            runtime.logEvent(\`[Workflow] Found \${topDossiersToCritique.length} top dossiers to critique.\`);

            for (const dossier of topDossiersToCritique) {
                try {
                    await runtime.tools.run('CritiqueInvestmentProposal', {
                        dossier: dossier.data,
                        backgroundSources: [...existingSources, ...newlyValidatedSources]
                    });
                } catch (e) {
                    runtime.logEvent(\`[Workflow] -> ⚠️ Critique failed for dossier on '\${dossier.data.synergyData.combination.map(c=>c.name).join(' + ')}': \${e.message}\`);
                }
            }
        } else {
             runtime.logEvent('[Workflow] No dossiers were generated in this run to critique.');
        }

        const totalValidatedSources = existingSources.length + newlyValidatedSources.length;
        const finalSummary = \`Workflow completed. Processed \${rankedSearchResults.length} new sources, validated \${newlyValidatedSources.length}, found \${allFoundSynergies.length} new synergies, and critiqued top proposals.\`;
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
    
    // NEW: Retry logic
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
            const response = await fetch(url, {
                signal: AbortSignal.timeout(10000), // 10 second timeout per attempt
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'User-Agent': userAgent,
                    'Referer': 'https://www.google.com/', // Change referer to look less suspicious
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
            return; // Success, exit the loop and function

        } catch (e) {
            const error = e as Error;
            console.error(\\\`[Web Proxy] Attempt \\\${attempt} failed for \\\${url}: \\\${error.message}\\\`);
            if (attempt === 3) {
                // Last attempt failed, send error response
                res.status(500).json({ error: 'Failed to retrieve or process content from URL. Reason: ' + error.message });
            } else {
                await new Promise(resolve => setTimeout(resolve, 500)); // Wait before retrying
            }
        }
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