



import type { ToolCreatorPayload } from '../types';

export const WORKFLOW_TOOLS: ToolCreatorPayload[] = [
    {
        name: 'Execute Full Research and Proposal Workflow',
        description: 'Executes the complete, end-to-end workflow from scientific literature search to identifying and scoring all potential synergistic combinations for trial-readiness.',
        category: 'Automation',
        executionEnvironment: 'Client',
        purpose: 'To provide a single, powerful, and reliable command for the agent to perform its entire core function autonomously.',
        parameters: [
            { name: 'researchObjective', type: 'string', description: 'The user\'s high-level research objective (e.g., "Find novel synergistic treatments for Alzheimer\'s disease").', required: true },
        ],
        implementationCode: `
        const { researchObjective } = args;
        runtime.logEvent('[Workflow] Starting full research and proposal workflow...');

        // Step 1: Refine Search Queries
        runtime.logEvent('[Workflow] Step 1/4: Refining search queries...');
        const refineResult = await runtime.tools.run('Refine Search Queries', { researchObjective });
        if (!refineResult || !refineResult.queries || refineResult.queries.length === 0) {
            throw new Error("Workflow failed at Step 1: Could not generate refined search queries from the objective.");
        }
        const refinedQueryString = refineResult.queries.join('; ');
        runtime.logEvent(\`[Workflow] Refined queries: \${refinedQueryString}\`);

        // Step 2: Deep Federated Search (with Smart Retry)
        runtime.logEvent('[Workflow] Step 2/4: Performing deep search on scientific literature...');
        
        let proxyUrl = null;
        try {
            const proxyBootstrapResult = await runtime.tools.run('Test Web Proxy Service', {});
            if (proxyBootstrapResult.proxyUrl) {
                proxyUrl = proxyBootstrapResult.proxyUrl;
            }
        } catch (e) {
            runtime.logEvent(\`[Workflow] WARN: Could not start or test local proxy service: \${e.message}. Will rely on public proxies.\`);
        }

        let searchResult = await runtime.tools.run('Federated Scientific Search', { query: refinedQueryString, maxResultsPerSource: 20, proxyUrl });
        
        if (!searchResult || !searchResult.searchResults || searchResult.searchResults.length === 0) {
            runtime.logEvent('[Workflow] Initial search failed or returned no results. Engaging diagnostic retry tool...');
            try {
                searchResult = await runtime.tools.run('Diagnose and Retry Search', {
                    originalQuery: refinedQueryString,
                    researchObjective: researchObjective,
                    reasonForFailure: 'The initial refined queries returned zero results from all scientific databases.',
                    proxyUrl: proxyUrl,
                });
                if (!searchResult || !searchResult.searchResults || searchResult.searchResults.length === 0) {
                     throw new Error("Diagnostic retry also failed to find any sources.");
                }
                 runtime.logEvent('[Workflow] ✅ Diagnostic retry succeeded. Proceeding with new search results.');
            } catch(e) {
                 throw new Error(\`Workflow failed at Step 2: Federated search returned no results, even after a diagnostic retry. Error: \${e.message}\`);
            }
        }
        
        const initialSearchResults = searchResult.searchResults;
        runtime.logEvent(\`[Workflow] Found \${initialSearchResults.length} potential sources. Beginning streaming validation and analysis...\`);
        
        // Step 3: STREAMING VALIDATION, CLASSIFICATION, AND ANALYSIS LOOP
        runtime.logEvent(\`[Workflow] Step 3/4: Processing \${initialSearchResults.length} sources individually...\`);
        let allValidatedSources = [];
        let allSynergies = [];
        let metaAnalyses = [];

        const gameParamsTool = runtime.tools.list().find(t => t.name === 'RecordSynergyGameParameters');
        if (!gameParamsTool) throw new Error("Core tool 'RecordSynergyGameParameters' not found.");

        for (const [index, source] of initialSearchResults.entries()) {
            runtime.logEvent(\`[Workflow] Source \${index + 1}/\${initialSearchResults.length}: "\${source.title.substring(0, 50)}..."\`);
            
            // a. Enrich and Validate ONE source
            const validationResult = await runtime.tools.run('Enrich and Validate Sources', { searchResults: [source], proxyUrl, researchObjective });
            const validatedSource = validationResult?.validatedSources?.[0];
            
            if (!validatedSource) {
                runtime.logEvent('[Workflow] ...source failed validation or enrichment. Skipping.');
                continue; // Skip to the next source
            }
            
            // NEW: Add reliability check
            const RELIABILITY_THRESHOLD = 0.6; // 60%
            if (validatedSource.reliabilityScore < RELIABILITY_THRESHOLD) {
                runtime.logEvent(\`[Workflow] ...source "\${validatedSource.title.substring(0,50)}..." skipped due to low reliability score (\${(validatedSource.reliabilityScore * 100).toFixed(0)}% < \${RELIABILITY_THRESHOLD * 100}%).\`);
                continue;
            }
            allValidatedSources.push(validatedSource);

            // b. Classify ONE source
            const classificationResult = await runtime.tools.run('Identify Meta-Analyses', { validatedSources: [validatedSource] });
            const isMeta = classificationResult.metaAnalyses && classificationResult.metaAnalyses.length > 0;
            if (isMeta) {
                metaAnalyses.push(validatedSource);
                runtime.logEvent('[Workflow] ...classified as Meta-Analysis.');
            } else {
                runtime.logEvent('[Workflow] ...classified as Primary Study.');
            }
            
            // c. Analyze the source for synergies (both meta-analyses and primary studies)
            const synergyAnalysisResult = await runtime.tools.run('Analyze Single Source for Synergies', {
                sourceToAnalyze: validatedSource,
                researchObjective,
                metaAnalyses
            });
            const newSynergies = synergyAnalysisResult.synergies || [];

            if (newSynergies.length > 0) {
                 allSynergies.push(...newSynergies);

                 for (const synergy of newSynergies) {
                    // d. Generate Game Parameters for synergy
                    const paramsPrompt = \`Based on the synergy: \${JSON.stringify(synergy)}, call the 'RecordSynergyGameParameters' tool with appropriate numerical values. The 'synergyCombination' parameter must be an array of strings containing only the intervention names.\`;
                    const systemInstruction = "You are an expert system that translates scientific data into simulation parameters by calling the provided tool. Respond only with a tool call.";
                    try {
                        const aiResponse = await runtime.ai.processRequest(paramsPrompt, systemInstruction, [gameParamsTool]);
                        const toolCall = aiResponse?.toolCalls?.[0];
                        if (toolCall && toolCall.name === 'RecordSynergyGameParameters') {
                            // Safeguard: Manually inject the combination names to ensure it's correct, as the LLM might get it wrong.
                            toolCall.arguments.synergyCombination = synergy.combination.map(c => c.name);
                            await runtime.tools.run(toolCall.name, toolCall.arguments);
                        }
                    } catch(e) {
                        runtime.logEvent(\`[Workflow] WARN: Failed to generate parameters for \${synergy.combination.map(c => c.name).join(' + ')}. Error: \${e.message}\`);
                    }
                 }
            }
             await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit between sources
        }

        // Step 3.5: De Novo Hypothesis Generation
        runtime.logEvent('[Workflow] Step 3.5: Building semantic space for de novo hypothesis generation...');
        if (allValidatedSources.length > 0) {
            try {
                const chunkingResult = await runtime.tools.run('Chunk and Embed Scientific Articles', { validatedSources: allValidatedSources });
                const vectorDB = chunkingResult.vectorDB;
                
                if (vectorDB && vectorDB.length > 0) {
                    runtime.logEvent(\`[Workflow] ...semantic space created with \${vectorDB.length} chunks. Generating conceptual queries...\`);
                    const conceptualQueriesResult = await runtime.tools.run('Generate Conceptual Queries from Objective', { researchObjective, validatedSources: allValidatedSources });
                    const conceptualQueries = conceptualQueriesResult.conceptual_queries;

                    if (conceptualQueries && conceptualQueries.length > 0) {
                        for (const query of conceptualQueries) {
                            runtime.logEvent(\`[Workflow] ...exploring concept: "\${query.substring(0, 80)}..."\`);
                            // This tool finds ONE hypothesis and records it (unscored)
                            const hypothesisResult = await runtime.tools.run('Hypothesis Generator via Conceptual Search', { 
                                conceptualQuery: query, 
                                vectorDB: vectorDB 
                            });
                            
                            const newHypothesis = hypothesisResult.synergy;
                            if (newHypothesis) {
                                // Now, score this new hypothesis
                                runtime.logEvent(\`[Workflow] ...scoring de novo hypothesis: \${newHypothesis.combination.map(c=>c.name).join(' + ')}\`);
                                const scoringResult = await runtime.tools.run('Score Single Synergy', {
                                    synergyToScore: newHypothesis,
                                    backgroundSources: allValidatedSources
                                });

                                if (scoringResult.updatedSynergy) {
                                    // Record the scored synergy. This will update the previous entry in the UI.
                                     await runtime.tools.run('RecordSynergy', scoringResult.updatedSynergy);

                                     // Generate game parameters for the newly scored hypothesis
                                     runtime.logEvent(\`[Workflow] ...generating game parameters for de novo hypothesis.\`);
                                     const paramsPrompt = \`Based on the synergy: \${JSON.stringify(scoringResult.updatedSynergy)}, call the 'RecordSynergyGameParameters' tool with appropriate numerical values. The 'synergyCombination' parameter must be an array of strings containing only the intervention names.\`;
                                     const systemInstruction = "You are an expert system that translates scientific data into simulation parameters by calling the provided tool. Respond only with a tool call.";
                                     try {
                                         const aiResponse = await runtime.ai.processRequest(paramsPrompt, systemInstruction, [gameParamsTool]);
                                         const toolCall = aiResponse?.toolCalls?.[0];
                                         if (toolCall && toolCall.name === 'RecordSynergyGameParameters') {
                                             toolCall.arguments.synergyCombination = scoringResult.updatedSynergy.combination.map(c => c.name);
                                             await runtime.tools.run(toolCall.name, toolCall.arguments);
                                         }
                                     } catch(e) {
                                         runtime.logEvent(\`[Workflow] WARN: Failed to generate game parameters for de novo hypothesis. Error: \${e.message}\`);
                                     }
                                }
                            }
                            await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
                        }
                    }
                }
            } catch (e) {
                runtime.logEvent(\`[Workflow] WARN: De novo hypothesis generation step failed. Error: \${e.message}\`);
            }
        }

        // Step 4: Final Summary
        runtime.logEvent('[Workflow] Step 4/4: Finalizing...');
        const finalSummary = \`Workflow completed for objective: "\${researchObjective}". Fully processed \${initialSearchResults.length} potential articles, validating \${allValidatedSources.length}. Identified \${allSynergies.length} potential synergies and scored them for trial readiness. Results are available in the 'Synergies' and 'Proposals' tabs.\`;
        runtime.logEvent(\`[Workflow] ✅ \${finalSummary}\`);
        return { success: true, message: "Workflow finished successfully.", summary: finalSummary };
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
    'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0'
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
                'User-Agent': userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
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
