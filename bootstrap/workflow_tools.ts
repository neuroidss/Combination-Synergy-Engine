import type { ToolCreatorPayload } from '../types';

export const WORKFLOW_TOOLS: ToolCreatorPayload[] = [
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
        const refinedQueryString = refineResult.queries.join('; ');
        runtime.logEvent(\`[Workflow] Refined queries: \${refinedQueryString}\`);

        // Step 2: Deep Federated Search
        runtime.logEvent('[Workflow] Step 2/4: Performing deep search on scientific literature...');
        let proxyUrl = null;
        if (runtime.isServerConnected()) {
            try {
                const proxyBootstrapResult = await runtime.tools.run('Test Web Proxy Service', {});
                proxyUrl = proxyBootstrapResult.proxyUrl;
            } catch (e) {
                runtime.logEvent(\`[Workflow] WARN: Could not start or test local proxy service: \${e.message}. Will rely on public proxies.\`);
            }
        }
        
        const searchResult = await runtime.tools.run('Federated Scientific Search', { query: refinedQueryString, maxResultsPerSource: 20, proxyUrl });
        let initialSearchResults = searchResult.searchResults || [];
        
        if (initialSearchResults.length === 0) {
            runtime.logEvent('[Workflow] Initial search failed or returned no results. Engaging diagnostic retry tool...');
            const retrySearchResult = await runtime.tools.run('Diagnose and Retry Search', {
                originalQuery: refinedQueryString, researchObjective, reasonForFailure: 'The initial refined queries returned zero results.', proxyUrl,
            });
            initialSearchResults = retrySearchResult.searchResults || [];
            if (initialSearchResults.length === 0) {
                 throw new Error("Workflow failed at Step 2: Federated search returned no results, even after a diagnostic retry.");
            }
            runtime.logEvent('[Workflow] ✅ Diagnostic retry succeeded.');
        }
        runtime.logEvent(\`[Workflow] Found \${initialSearchResults.length} potential sources. Beginning validation...\`);

        // Step 3: ITERATIVE VALIDATION with SELF-HEALING
        runtime.logEvent(\`[Workflow] Step 3/4: Validating \${initialSearchResults.length} sources individually...\`);
        
        let sourcesToProcess = [...initialSearchResults];
        let validatedSources = [];
        let failedSources = [];
        let adaptationAttempted = false;

        while (sourcesToProcess.length > 0) {
            let currentIterationFailures = [];
            
            for (const [index, source] of sourcesToProcess.entries()) {
                runtime.logEvent(\`[Workflow] -> Processing source \${index + 1}/\${sourcesToProcess.length}: "\${source.title.substring(0, 40)}..."\`);
                try {
                    const validationResult = await runtime.tools.run('Find and Validate Single Source', {
                        searchResult: source, researchObjective, proxyUrl
                    });
                    validatedSources.push(validationResult.validatedSource);
                } catch (e) {
                    runtime.logEvent(\`[Workflow] -> ❌ Validation failed for source: \${e.message}\`);
                    currentIterationFailures.push(source);
                }
                await new Promise(resolve => setTimeout(resolve, 350)); // Rate limit
            }

            const failureRate = sourcesToProcess.length > 0 ? currentIterationFailures.length / sourcesToProcess.length : 0;
            
            if (failureRate > 0.5 && !adaptationAttempted) {
                runtime.logEvent(\`[Workflow] High failure rate (\${(failureRate * 100).toFixed(0)}%) detected. Attempting self-healing...\`);
                adaptationAttempted = true;
                await runtime.tools.run('AdaptFetchStrategy', {});
                runtime.logEvent('[Workflow] Retrying failed sources with new strategy...');
                sourcesToProcess = currentIterationFailures; // Set up the next loop with only the failed sources
            } else {
                failedSources.push(...currentIterationFailures);
                sourcesToProcess = []; // Exit the loop
            }
        }
        
        if (failedSources.length > 0) {
            runtime.logEvent(\`[Workflow] Validation complete. \${failedSources.length} sources could not be processed.\`);
        }
        runtime.logEvent(\`[Workflow] Processing \${validatedSources.length} successfully validated sources...\`);
        
        let allSynergies = [];
        let metaAnalyses = [];

        const gameParamsTool = runtime.tools.list().find(t => t.name === 'RecordSynergyGameParameters');
        if (!gameParamsTool) throw new Error("Core tool 'RecordSynergyGameParameters' not found.");

        for (const [index, validatedSource] of validatedSources.entries()) {
            runtime.logEvent(\`[Workflow] Analyzing source \${index + 1}/\${validatedSources.length}: "\${validatedSource.title.substring(0, 50)}..."\`);
            
            if (validatedSource.reliabilityScore < 0.6) {
                runtime.logEvent(\`[Workflow] ...source skipped due to low reliability score (\${(validatedSource.reliabilityScore * 100).toFixed(0)}%).\`);
                continue;
            }

            const classificationResult = await runtime.tools.run('Identify Meta-Analyses', { validatedSources: [validatedSource] });
            if (classificationResult.metaAnalyses && classificationResult.metaAnalyses.length > 0) {
                metaAnalyses.push(validatedSource);
            }
            
            const synergyAnalysisResult = await runtime.tools.run('Analyze Single Source for Synergies', {
                sourceToAnalyze: validatedSource, researchObjective, metaAnalyses
            });
            const newSynergies = synergyAnalysisResult.synergies || [];

            if (newSynergies.length > 0) {
                 allSynergies.push(...newSynergies);
                 for (const synergy of newSynergies) {
                    const paramsPrompt = \`Based on the synergy: \${JSON.stringify(synergy)}, call the 'RecordSynergyGameParameters' tool with appropriate numerical values. The 'synergyCombination' parameter must be an array of strings containing only the intervention names.\`;
                    const systemInstruction = "You are an expert system that translates scientific data into simulation parameters by calling the provided tool. Respond only with a tool call.";
                    try {
                        const aiResponse = await runtime.ai.processRequest(paramsPrompt, systemInstruction, [gameParamsTool]);
                        const toolCall = aiResponse?.toolCalls?.[0];
                        if (toolCall && toolCall.name === 'RecordSynergyGameParameters') {
                            toolCall.arguments.synergyCombination = synergy.combination.map(c => c.name);
                            await runtime.tools.run(toolCall.name, toolCall.arguments);
                        }
                    } catch(e) { 
                        runtime.logEvent(\`[Workflow] WARN: Failed to generate game parameters for \${synergy.combination.map(c => c.name).join(' + ')}. Error: \${e.message}\`);
                    }
                 }
            }
             await new Promise(resolve => setTimeout(resolve, 500));
        }

        runtime.logEvent('[Workflow] Step 3.5: Building semantic space for de novo hypothesis generation...');
        if (validatedSources.length > 0) {
            try {
                const chunkingResult = await runtime.tools.run('Chunk and Embed Scientific Articles', { validatedSources });
                const vectorDB = chunkingResult.vectorDB;
                
                if (vectorDB && vectorDB.length > 0) {
                    runtime.logEvent(\`[Workflow] ...semantic space created with \${vectorDB.length} chunks. Generating conceptual queries...\`);
                    const conceptualQueriesResult = await runtime.tools.run('Generate Conceptual Queries from Objective', { researchObjective, validatedSources: validatedSources });
                    const conceptualQueries = conceptualQueriesResult.conceptual_queries;

                    if (conceptualQueries && conceptualQueries.length > 0) {
                        for (const query of conceptualQueries) {
                            runtime.logEvent(\`[Workflow] ...exploring concept: "\${query.substring(0, 80)}..."\`);
                            const hypothesisResult = await runtime.tools.run('Hypothesis Generator via Conceptual Search', { 
                                conceptualQuery: query, 
                                vectorDB: vectorDB 
                            });
                            
                            const newHypothesis = hypothesisResult.synergy;
                            if (newHypothesis) {
                                runtime.logEvent(\`[Workflow] ...scoring de novo hypothesis: \${newHypothesis.combination.map(c=>c.name).join(' + ')}\`);
                                const scoringResult = await runtime.tools.run('Score Single Synergy', {
                                    synergyToScore: newHypothesis,
                                    backgroundSources: validatedSources
                                });

                                if (scoringResult.updatedSynergy) {
                                     await runtime.tools.run('RecordSynergy', scoringResult.updatedSynergy);

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
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }
                }
            } catch (e) {
                runtime.logEvent(\`[Workflow] WARN: De novo hypothesis generation step failed. Error: \${e.message}\`);
            }
        }

        runtime.logEvent('[Workflow] Step 4/4: Finalizing...');
        const finalSummary = \`Workflow completed. Processed \${initialSearchResults.length} potential articles, validating \${validatedSources.length}. Identified \${allSynergies.length} potential synergies.\`;
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