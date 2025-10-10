
import type { ToolCreatorPayload } from '../types';

export const WORKFLOW_TOOLS: ToolCreatorPayload[] = [
    {
        name: 'Execute Full Research and Proposal Workflow',
        description: 'Executes the complete, end-to-end workflow from scientific literature search to generating and then critically reviewing investment-ready trial dossiers for the most promising synergistic combinations.',
        category: 'Automation',
        executionEnvironment: 'Client',
        purpose: 'To provide a single, powerful, and reliable command for the agent to perform its entire core function autonomously.',
        parameters: [
            { name: 'researchObjective', type: 'string', description: 'The user\'s high-level research objective (e.g., "Find novel synergistic treatments for Alzheimer\'s disease").', required: true },
            { name: 'numberOfProposals', type: 'number', description: 'The number of top proposals to generate dossiers for (default: 2).', required: false },
        ],
        implementationCode: `
        const { researchObjective, numberOfProposals = 2 } = args;
        runtime.logEvent('[Workflow] Starting full research and proposal workflow...');

        // Step 1: Bootstrap Proxy for reliable network access
        runtime.logEvent('[Workflow] Step 1/5: Initializing local web proxy service...');
        let proxyUrl = null;
        try {
            const proxyResult = await runtime.tools.run('Bootstrap Web Proxy Service', {});
            if (proxyResult && proxyResult.proxyUrl) {
                proxyUrl = proxyResult.proxyUrl;
                 runtime.logEvent(\`[Workflow] Successfully started local proxy at \${proxyUrl}\`);
            } else {
                 runtime.logEvent('[Workflow] WARN: Could not start local proxy service. Will rely on public CORS proxies.');
            }
        } catch (e) {
             runtime.logEvent(\`[Workflow] WARN: Failed to start local proxy service: \${e.message}.\`);
        }
        
        // Step 2: Refine Search Queries
        runtime.logEvent('[Workflow] Step 2/5: Refining search queries...');
        const refineResult = await runtime.tools.run('Refine Search Queries', { researchObjective });
        if (!refineResult || !refineResult.queries || refineResult.queries.length === 0) {
            throw new Error("Workflow failed at Step 2: Could not generate refined search queries from the objective.");
        }
        const refinedQueryString = refineResult.queries.join('; ');
        runtime.logEvent(\`[Workflow] Refined queries: \${refinedQueryString}\`);

        // Step 3: Deep Federated Search (with Smart Retry)
        runtime.logEvent('[Workflow] Step 3/5: Performing deep search on scientific literature...');
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
                 throw new Error(\`Workflow failed at Step 3: Federated search returned no results, even after a diagnostic retry. Error: \${e.message}\`);
            }
        }
        
        const initialSearchResults = searchResult.searchResults;
        runtime.logEvent(\`[Workflow] Found \${initialSearchResults.length} potential sources. Beginning streaming validation and analysis...\`);
        
        // Step 4: STREAMING VALIDATION, CLASSIFICATION, AND ANALYSIS LOOP
        runtime.logEvent(\`[Workflow] Step 4/5: Processing \${initialSearchResults.length} sources individually...\`);
        let allValidatedSources = [];
        let allSynergies = [];
        let generatedDossiers = [];
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
            allValidatedSources.push(validatedSource);

            // b. Classify ONE source
            const classificationResult = await runtime.tools.run('Identify Meta-Analyses', { validatedSources: [validatedSource] });
            const isMeta = classificationResult.metaAnalyses && classificationResult.metaAnalyses.length > 0;
            if (isMeta) {
                metaAnalyses.push(validatedSource);
                runtime.logEvent('[Workflow] ...classified as Meta-Analysis.');
                continue; // Don't analyze meta-analyses for novel synergies
            }
            runtime.logEvent('[Workflow] ...classified as Primary Study.');
            
            // c. Analyze ONE primary study for synergies
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
                    const paramsPrompt = \`Based on the synergy: \${JSON.stringify(synergy)}, call the 'RecordSynergyGameParameters' tool with appropriate numerical values. Ensure synergyCombination matches the input.\`;
                    const systemInstruction = "You are an expert system that translates scientific data into simulation parameters by calling the provided tool. Respond only with a tool call.";
                    try {
                        const aiResponse = await runtime.ai.processRequest(paramsPrompt, systemInstruction, [gameParamsTool]);
                        const toolCall = aiResponse?.toolCalls?.[0];
                        if (toolCall && toolCall.name === 'RecordSynergyGameParameters') {
                            await runtime.tools.run(toolCall.name, toolCall.arguments);
                        }
                    } catch(e) {
                        runtime.logEvent(\`[Workflow] WARN: Failed to generate parameters for \${synergy.combination.join(' + ')}. Error: \${e.message}\`);
                    }

                    // e. Generate Proposal for novel/hypothesized synergies
                    if (synergy.status === 'Hypothesized' && generatedDossiers.length < numberOfProposals) {
                        const proposalResult = await runtime.tools.run('Generate Proposal for Single Synergy', {
                            synergy: synergy,
                            backgroundSources: allValidatedSources // Provide all sources found so far for context
                        });
                        if (proposalResult.dossier) {
                            generatedDossiers.push(proposalResult.dossier);
                        }
                    }
                 }
            }
             await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit between sources
        }

        // Step 5: Final Summary
        runtime.logEvent('[Workflow] Step 5/5: Finalizing...');
        const finalSummary = \`Workflow completed for objective: "\${researchObjective}". Fully processed \${initialSearchResults.length} potential articles, validating \${allValidatedSources.length}. Identified \${allSynergies.length} synergies and generated \${generatedDossiers.length} proposals.\`;
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
