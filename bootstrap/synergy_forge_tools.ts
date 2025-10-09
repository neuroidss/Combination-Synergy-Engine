

import type { ToolCreatorPayload } from '../types';

const CRITIQUE_PROPOSAL_TOOL: ToolCreatorPayload = {
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
        runtime.logEvent(\`[Critique] Starting critical analysis for: \${comboString}\`);

        // Step 1: Formulate adversarial search queries
        const queries = [
            \`\${comboString} risks side effects contraindications\`,
            \`"\${comboString}" failed trial\`,
            \`problems with combining \${dossier.combination.join(' and ')}\`,
            \`evidence against \${dossier.scientificRationale.substring(0, 150)}\`
        ];
        
        runtime.logEvent(\`[Critique] Searching for counter-evidence...\`);
        const searchResult = await runtime.tools.run('Federated Scientific Search', { query: queries.join('; '), maxResultsPerSource: 3 });
        const searchResults = searchResult.searchResults || [];

        let context = \`CRITIQUE THE FOLLOWING INVESTMENT PROPOSAL:\\n\${JSON.stringify(dossier, null, 2)}\`;
        if (searchResults.length > 0) {
            const searchContext = searchResults.map(r => \`<EVIDENCE>\\n<TITLE>\${r.title}</TITLE>\\n<SNIPPET>\${r.snippet}</SNIPPET>\\n<URL>\${r.link}</URL>\\n</EVIDENCE>\`).join('\\n\\n');
            context += \`\\n\\nPOTENTIAL CONTRADICTORY EVIDENCE FOUND:\\n\${searchContext}\`;
        } else {
            context += \`\\n\\nNo direct contradictory evidence was found in a preliminary search.\`;
        }

        const systemInstruction = \`You are a highly skeptical and meticulous scientific peer reviewer and venture capital analyst. Your job is to find flaws in investment proposals.
-   Analyze the provided dossier and any search evidence.
-   Your tone should be critical, professional, and evidence-based.
-   Focus on: 1) Understated or misrepresented risks. 2) Weaknesses in the scientific rationale. 3) Contradictory evidence from the search results. 4) Feasibility of the roadmap and market claims.
-   Your output MUST be a single JSON object with the keys: "strengths", "weaknesses", "contradictoryEvidence" (an array of strings with citations), and "overallVerdict" ('Sound', 'Needs Revision', 'High Risk'). Do NOT add any text outside the JSON object.\`;

        runtime.logEvent(\`[Critique] Generating critique for \${comboString}...\`);
        const critiqueJsonString = await runtime.ai.generateText(context, systemInstruction);
        
        let critique;
        try {
            const jsonMatch = critiqueJsonString.match(/\\{[\\s\\S]*\\}/);
            if (!jsonMatch) throw new Error("No JSON object found in the AI's critique response.");
            critique = JSON.parse(jsonMatch[0]);
        } catch (e) {
            runtime.logEvent(\`[Critique] ❌ Error parsing critique JSON. AI Response: \${critiqueJsonString}\`);
            throw new Error(\`Failed to parse the AI's critique response. Details: \${e.message}\`);
        }
        
        // Add the combination to the critique object for easy matching later
        critique.combination = dossier.combination;

        return { success: true, message: \`Critique generated for \${comboString}\`, critique };
    `
};

const RECORD_CRITIQUE_TOOL: ToolCreatorPayload = {
    name: 'RecordCritique',
    description: 'Records the structured output from the Critique Investment Proposal tool.',
    category: 'Functional',
    executionEnvironment: 'Client',
    purpose: 'To log the final critique of a proposal, making it available for the UI to display.',
    parameters: [
        { name: 'critique', type: 'object', description: 'The full critique object, including combination, strengths, weaknesses, etc.', required: true },
    ],
    implementationCode: `
        const { critique } = args;
        runtime.logEvent(\`[Critique] Recording critique for: \${critique.combination.join(' + ')}\`);
        return { success: true, critique };
    `
};


export const SYNERGY_FORGE_FUNCTIONAL_TOOLS: ToolCreatorPayload[] = [
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

        // Step 1: Federated Search
        runtime.logEvent('[Workflow] Step 1/8: Searching scientific literature...');
        const searchResult = await runtime.tools.run('Federated Scientific Search', { query: researchObjective, maxResultsPerSource: 10 });
        if (!searchResult || !searchResult.searchResults || searchResult.searchResults.length === 0) {
            throw new Error("Workflow failed at Step 1: Federated search returned no results.");
        }
        const searchResults = searchResult.searchResults;
        runtime.logEvent(\`[Workflow] Found \${searchResults.length} potential sources.\`);

        // Step 2: Bootstrap Proxy
        runtime.logEvent('[Workflow] Step 2/8: Initializing local web proxy service...');
        let proxyUrl = null;
        try {
            const proxyResult = await runtime.tools.run('Bootstrap Web Proxy Service', {});
            if (proxyResult && proxyResult.proxyUrl) {
                proxyUrl = proxyResult.proxyUrl;
                runtime.logEvent(\`[Workflow] Proxy is ready at \${proxyUrl}.\`);
            } else {
                 runtime.logEvent('[Workflow] WARN: Could not start local proxy service. Will rely on public CORS proxies, which may be less reliable.');
            }
        } catch (e) {
             runtime.logEvent(\`[Workflow] WARN: Failed to start local proxy service: \${e.message}. Will rely on public CORS proxies, which may be less reliable.\`);
        }

        // Step 3: Enrich and Validate
        runtime.logEvent('[Workflow] Step 3/8: Enriching and validating sources...');
        const validationResult = await runtime.tools.run('Enrich and Validate Sources', { searchResults, proxyUrl });
        if (!validationResult || !validationResult.validatedSources || validationResult.validatedSources.length === 0) {
            throw new Error("Workflow failed at Step 3: No valid scientific sources were found.");
        }
        const validatedSources = validationResult.validatedSources;
        runtime.logEvent(\`[Workflow] Validated \${validatedSources.length} sources.\`);

        // Step 4: Analyze for Synergies
        runtime.logEvent('[Workflow] Step 4/8: Analyzing sources for synergistic combinations...');
        const synergyAnalysisResult = await runtime.tools.run('Analyze Sources for Synergies', { validatedSources, researchObjective });
        if (!synergyAnalysisResult || !synergyAnalysisResult.synergies || synergyAnalysisResult.synergies.length === 0) {
            runtime.logEvent('[Workflow] Analysis complete. No synergistic combinations were identified.');
            return { success: true, message: "Workflow complete. No synergistic combinations were found based on the provided literature." };
        }
        const synergies = synergyAnalysisResult.synergies;
        runtime.logEvent(\`[Workflow] Identified \${synergies.length} potential synergies.\`);

        // Step 5: Record Data & Generate Params
        runtime.logEvent('[Workflow] Step 5/8: Recording findings and generating simulation parameters...');
        const systemInstructionForParams = "You are a game designer translating scientific data into game mechanics. Provide ONLY a valid JSON object with keys like senolytic_clearance, autophagy_boost, etc., and numeric values.";
        for (const synergy of synergies) {
            await runtime.tools.run('RecordSynergy', synergy);
            const paramsPrompt = \`Based on the synergy: \${JSON.stringify(synergy)}, generate game parameters. Respond with ONLY the JSON object.\`;
            const paramsJsonString = await runtime.ai.generateText(paramsPrompt, systemInstructionForParams);
            let gameParameters = {};
            try { gameParameters = JSON.parse(paramsJsonString.match(/\\{[\\s\\S]*\\}/)?.[0] || '{}'); } catch (e) { /* ignore */ }
            await runtime.tools.run('RecordSynergyGameParameters', { synergyCombination: synergy.combination, gameParameters });
        }
        runtime.logEvent(\`[Workflow] Recorded \${synergies.length} synergies.\`);

        // Step 6: Generate Dossiers for Top Synergies
        runtime.logEvent(\`[Workflow] Step 6/8: Generating top \${numberOfProposals} investment dossiers...\`);
        const dossierSystemInstruction = \`You are a senior business analyst and scientific consultant at a biotech venture capital firm with a mandate for ethical and safe investments. Your task is to write a compelling, data-driven investment dossier for a *novel* clinical trial.
Your response MUST be a single JSON object that conforms to the parameters of the 'RecordTrialDossier' tool.
Key instructions:
1.  **Focus on Novelty:** The proposal must be for a new trial. If the synergy is 'Hypothesized', frame it as a first-of-its-kind investigation. If the synergy is 'Known', you MUST frame the proposal around a novel application (e.g., a new patient population or disease indication) or a combination with a third, novel element. Do not propose a trial for something that is already standard practice.
2.  **Risk Analysis is CRITICAL:** The 'risks' section must be thorough and scientifically accurate. You MUST NOT downplay, misrepresent, or omit known risks, especially for drug combinations (e.g., renal, GI, or cardiovascular toxicity). Accurately reflect the scientific consensus on safety. An inaccurate risk assessment will invalidate the entire proposal.
3.  **In Silico Validation:** This section should describe the *hypothesized* effects on the SynergyForge simulation's biomarkers based on the mechanisms of action. AVOID making overly specific quantitative claims (e.g., "25% decrease"). Instead, focus on the qualitative impact (e.g., "is expected to significantly reduce markers of inflammation...").\`;
        
        const topSynergiesPrompt = \`From the following list of synergies, identify the top \${numberOfProposals} most promising candidates for investment. You MUST prioritize 'Hypothesized' synergies as they represent novel trial opportunities. Only select 'Known' synergies if there are insufficient 'Hypothesized' candidates. Base your selection on scientific rationale and potential impact. List only their combinations as a JSON array of arrays, e.g., [["Metformin", "Rapamycin"], ["Dasatinib", "Quercetin"]].\\n\\nSynergies: \${JSON.stringify(synergies)}\`;
        const topSynergiesJson = await runtime.ai.generateText(topSynergiesPrompt, "You are a helpful assistant that only outputs JSON.");
        let topCombinations = [];
        try { topCombinations = JSON.parse(topSynergiesJson.match(/\\[[\\s\\S]*\\]/)?.[0] || '[]'); } catch(e) { /* ignore */ }
        
        if(topCombinations.length === 0) { // Fallback if AI fails
             topCombinations = synergies.slice(0, numberOfProposals).map(s => s.combination);
        }
        
        const generatedDossiers = [];
        for (const combination of topCombinations) {
            const comboString = combination.join(' + ');
            runtime.logEvent(\`[Workflow] ...writing dossier for \${comboString}.\`);
            const dossierPrompt = \`Write a full investment dossier for the combination: "\${comboString}". Use all the provided background information on sources and synergies. Create plausible but concise sections for executiveSummary, scientificRationale, inSilicoValidation, marketAndIP, roadmap, and risks. The "combination" field in your JSON output must be an array of strings. Respond with ONLY the JSON object.\\n\\nValidated Sources:\\n\${JSON.stringify(validatedSources)}\\n\\nIdentified Synergies:\\n\${JSON.stringify(synergies)}\`;
            const dossierJsonString = await runtime.ai.generateText(dossierPrompt, dossierSystemInstruction);
            try {
                const dossierArgs = JSON.parse(dossierJsonString.match(/\\{[\\s\\S]*\\}/)?.[0] || '{}');
                if (dossierArgs.combination) {
                    const dossierResult = await runtime.tools.run('RecordTrialDossier', dossierArgs);
                    if (dossierResult.dossier) {
                        generatedDossiers.push(dossierResult.dossier);
                    }
                }
            } catch (e) {
                runtime.logEvent(\`[Workflow] WARN: Failed to generate or parse dossier for \${comboString}. Error: \${e.message}\`);
            }
        }
        
        // Step 7: Critique Generated Dossiers
        runtime.logEvent('[Workflow] Step 7/8: Subjecting proposals to critical review...');
        for (const dossier of generatedDossiers) {
            const comboString = dossier.combination.join(' + ');
            try {
                runtime.logEvent(\`[Workflow] ...critiquing dossier for \${comboString}.\`);
                const critiqueResult = await runtime.tools.run('Critique Investment Proposal', { dossier });
                if (critiqueResult.critique) {
                    await runtime.tools.run('RecordCritique', { critique: critiqueResult.critique });
                }
            } catch (e) {
                runtime.logEvent(\`[Workflow] WARN: Failed to generate critique for \${comboString}. Error: \${e.message}\`);
            }
        }

        // Step 8: Final Summary
        runtime.logEvent('[Workflow] Step 8/8: Finalizing...');
        const finalSummary = \`Workflow completed for objective: "\${researchObjective}". Validated \${validatedSources.length} sources, identified \${synergies.length} synergies, and generated and critiqued \${generatedDossiers.length} investment proposals.\`;
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

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.post('/browse', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL is required.' });
    }
    console.log('[Web Proxy] Fetching URL: ' + url);
    try {
        const response = await fetch(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch URL with status: ' + response.status + ' ' + response.statusText);
        }
        const htmlContent = await response.text();
        res.json({ success: true, htmlContent: htmlContent });
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
        name: 'Read Webpage Content',
        description: "Fetches the full text content of a given public URL using a specified web proxy service.",
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: "To provide the AI with the fundamental ability to 'read' the content of webpages, enabling deeper analysis than search snippets allow.",
        parameters: [
            { name: 'url', type: 'string', description: 'The full URL of the webpage to read.', required: true },
            { name: 'proxyUrl', type: 'string', description: 'The base URL of the web proxy service to use (e.g., http://localhost:3002).', required: true },
        ],
        implementationCode: `
          const { url, proxyUrl } = args;
          runtime.logEvent(\`[Web Reader] Fetching content from: \${url} via proxy \${proxyUrl}\`);
          try {
              const response = await fetch(\`\${proxyUrl}/browse\`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url }),
              });

              if (!response.ok) {
                  const errorData = await response.json().catch(() => ({ error: 'Unknown proxy error.' }));
                  throw new Error(\`Proxy service failed with status \${response.status}: \${errorData.error}\`);
              }

              const data = await response.json();
              if (!data.success || !data.htmlContent) {
                  throw new Error(data.error || 'Proxy service returned success false but no error message.');
              }
              
              // Basic HTML stripping
              const textContent = data.htmlContent
                  .replace(/<style[^>]*>[\\s\\S]*?<\\/style>/gi, '')
                  .replace(/<script[^>]*>[\\s\\S]*?<\\/script>/gi, '')
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/\\s\\s+/g, ' ')
                  .trim();
              
              return { success: true, textContent };

          } catch (e) {
              const errorMessage = e instanceof Error ? e.message : String(e);
              throw new Error(\`Failed to read webpage content: \${errorMessage}\`);
          }
        `,
    },
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
                runtime.search.web(query, maxResultsPerSource),
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
            { name: 'proxyUrl', type: 'string', description: 'The URL of the bootstrapped web proxy service to use for fetching content.', required: false },
        ],
        implementationCode: `
            const { searchResults, proxyUrl } = args;
            if (!Array.isArray(searchResults) || searchResults.length === 0) {
                return { success: true, validatedSources: [] };
            }
            
            runtime.logEvent(\`[Validator] Starting enrichment for \${searchResults.length} sources... Using proxy: \${proxyUrl || 'default'}\`);
            const enrichmentPromises = searchResults.map(res => runtime.search.enrichSource(res, proxyUrl));
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
        name: 'Analyze Sources for Synergies',
        description: 'Takes a list of validated scientific sources and uses an AI model to analyze their content, identifying potential synergistic, additive, or antagonistic combinations of longevity interventions.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To perform the core scientific analysis, turning a list of validated sources into a structured list of potential synergies for further processing.',
        parameters: [
            { name: 'validatedSources', type: 'array', description: 'The array of validated source objects, each containing a title, summary, and reliability score.', required: true },
            { name: 'researchObjective', type: 'string', description: 'The original research objective to focus the analysis.', required: true },
        ],
        implementationCode: `
            const { validatedSources, researchObjective } = args;
            if (!Array.isArray(validatedSources) || validatedSources.length === 0) {
                return { success: true, synergies: [] };
            }

            runtime.logEvent(\`[Synergy Analysis] Starting AI analysis of \${validatedSources.length} sources...\`);

            const sourceContext = validatedSources.map((s, i) => 
                \`<SOURCE \${i + 1}>\\n<TITLE>\${s.title}</TITLE>\\n<RELIABILITY>\${s.reliabilityScore}</RELIABILITY>\\n<SUMMARY>\${s.summary}</SUMMARY>\\n</SOURCE>\`
            ).join('\\n\\n');

            const systemInstruction = \`You are an expert bioinformatics researcher with a strong emphasis on safety and clinical relevance. Your task is to analyze scientific literature to find combinations of longevity interventions.
For each combination, you must:
1.  Identify the nature of the interaction: 'Synergistic', 'Additive', or 'Antagonistic'.
2.  Determine if the synergy is 'Known' (well-documented) or 'Hypothesized' (based on mechanisms).
3.  Provide a scientific rationale, citing sources like [1], [2].
4.  CRITICALLY ASSESS and clearly state any potential risks, side effects, or contraindications of the combination (e.g., "Increased risk of renal toxicity"). If no specific risks for the combination are mentioned, extrapolate from the risks of the individual components. This is a mandatory field.

Your output MUST be a single JSON object with a key "synergies", which is an array of objects. Each object must have "combination", "status", "synergyType", "summary", and "potentialRisks".
Example:
{
  "synergies": [
    {
      "combination": ["Aspirin (COX Inhibitor)", "Ibuprofen (NSAID)"],
      "status": "Known",
      "synergyType": "Antagonistic",
      "summary": "Combining these NSAIDs does not improve efficacy and significantly increases the risk of gastrointestinal bleeding and renal impairment [4].",
      "potentialRisks": "High risk of gastrointestinal bleeding, peptic ulcers, and acute kidney injury, especially in the elderly."
    }
  ]
}
You MUST respond with ONLY the JSON object.\`;

            const analysisPrompt = \`Based on the research objective "\${researchObjective}" and the following sources, identify all potential synergies.\\n\\n\${sourceContext}\`;

            const aiResponseText = await runtime.ai.generateText(analysisPrompt, systemInstruction);

            let analysisJson;
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("No JSON object found in the AI's synergy analysis response.");
                analysisJson = JSON.parse(jsonMatch[0]);
            } catch (e) {
                runtime.logEvent(\`[Synergy Analysis] ❌ Error parsing synergy JSON. AI Response: \${aiResponseText}\`);
                throw new Error(\`Failed to parse the AI's synergy analysis response. Details: \${e.message}\`);
            }

            if (!analysisJson.synergies || !Array.isArray(analysisJson.synergies)) {
                runtime.logEvent(\`[Synergy Analysis] ⚠️ AI did not return a valid 'synergies' array. Response was: \${aiResponseText}\`);
                return { success: true, message: "AI analysis complete, but no synergies were identified.", synergies: [] };
            }

            runtime.logEvent(\`[Synergy Analysis] ✅ AI identified \${analysisJson.synergies.length} potential synergies.\`);

            return {
                success: true,
                message: \`AI analysis identified \${analysisJson.synergies.length} potential synergies.\`,
                synergies: analysisJson.synergies,
            };
        `,
    },
    CRITIQUE_PROPOSAL_TOOL,
    RECORD_CRITIQUE_TOOL,
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
            { name: 'potentialRisks', type: 'string', description: 'A clear description of potential risks, side effects, or contraindications of the combination.', required: true },
        ],
        implementationCode: `
            const { combination, status, synergyType, summary, potentialRisks } = args;
            runtime.logEvent(\`[Synergy Analysis] Recording synergy: \${combination.join(' + ')}\`);
            
            return {
                success: true,
                synergy: {
                    combination,
                    status,
                    synergyType,
                    summary,
                    potentialRisks,
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