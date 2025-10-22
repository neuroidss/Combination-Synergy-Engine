

import type { ToolCreatorPayload } from '../types';

export const RESEARCH_TOOLS: ToolCreatorPayload[] = [
    {
        name: 'Rank Search Results',
        description: 'Ranks a list of scientific search results based on their relevance to a research objective, prioritizing meta-analyses and systematic reviews.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To prioritize the most promising scientific articles first, ensuring that the most valuable information is processed at the beginning of the workflow.',
        parameters: [
            { name: 'searchResults', type: 'array', description: 'An array of search result objects, each with a "title" and "snippet".', required: true },
            { name: 'researchObjective', type: 'string', description: 'The overall research objective to guide the ranking.', required: true },
        ],
        implementationCode: `
            const { searchResults, researchObjective } = args;
            if (!searchResults || searchResults.length === 0) {
                return { success: true, rankedResults: [] };
            }

            runtime.logEvent(\`[Ranker] Ranking \${searchResults.length} results using embedding-based relevance scoring...\`);

            try {
                // 1. Prepare texts for embedding
                const textsToEmbed = [
                    researchObjective, // The first item is the query
                    ...searchResults.map(r => \`\${r.title}\\n\${r.snippet}\`)
                ];

                // 2. Generate all embeddings in a single call
                const embeddings = await runtime.ai.generateEmbeddings(textsToEmbed);
                const objectiveEmbedding = embeddings[0];
                const resultEmbeddings = embeddings.slice(1);

                // Helper for cosine similarity
                const cosineSimilarity = (vecA, vecB) => {
                    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
                    // Vectors are pre-normalized by the embedding service, so dot product is sufficient.
                    let dotProduct = 0;
                    for (let i = 0; i < vecA.length; i++) {
                        dotProduct += vecA[i] * vecB[i];
                    }
                    return dotProduct;
                };

                // 3. Score each result
                const scoredResults = searchResults.map((result, index) => {
                    // Base score from semantic similarity
                    let similarityScore = cosineSimilarity(objectiveEmbedding, resultEmbeddings[index]);
                    
                    // FIX: Prevent NaN scores from breaking the sort
                    if (isNaN(similarityScore)) {
                        similarityScore = 0;
                    }

                    // Heuristic bonus for important keywords
                    let heuristicBonus = 0;
                    const lowerCaseTitle = result.title.toLowerCase();
                    if (lowerCaseTitle.includes('meta-analysis') || lowerCaseTitle.includes('systematic review')) {
                        heuristicBonus = 0.2; // Strong bonus for meta-analyses
                    } else if (lowerCaseTitle.includes('review')) {
                        heuristicBonus = 0.1; // Moderate bonus for reviews
                    }

                    const finalScore = similarityScore + heuristicBonus;
                    
                    return { ...result, score: finalScore };
                });

                // 4. Sort by final score
                const rankedResults = scoredResults.sort((a, b) => b.score - a.score);

                runtime.logEvent(\`[Ranker] ✅ Successfully ranked \${rankedResults.length} articles. Top result: "\${rankedResults[0]?.title}" (Score: \${rankedResults[0]?.score.toFixed(3)})\`);
                return { success: true, rankedResults };

            } catch (e) {
                runtime.logEvent(\`[Ranker] ⚠️ WARN: Failed to rank search results with embeddings: \${e.message}. Proceeding with original order.\`);
                // Fallback: return the original order if embedding fails
                return { success: true, rankedResults: searchResults };
            }
        `
    },
    {
        name: 'DiscoverProxyBuilders',
        description: 'Uses an AI model to discover and generate code for new public CORS proxy services. This is a powerful adaptation mechanism to bypass content blockades when existing proxies fail.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To enable the agent to invent new ways to access web content, making the research process more resilient and adaptive to network restrictions.',
        parameters: [],
        implementationCode: `
            runtime.logEvent('[Discovery] Attempting to discover new CORS proxy strategies...');
            const systemInstruction = \`You are an expert at bypassing CORS. Your task is to find and provide code for public CORS proxy services.
You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
{
  "proxy_builder_strings": [
    "(url) => \\\`https://corsproxy.io/?\\\${encodeURIComponent(url)}\\\`",
    "(url) => \\\`https://api.allorigins.win/raw?url=\\\${encodeURIComponent(url)}\\\`"
  ]
}
Find 2-3 MORE different, currently active public CORS proxies and provide their function strings in the same format. Do not include the examples I provided.\`;

            const prompt = "Find new, publicly available CORS proxy services and provide the corresponding JavaScript arrow functions to format a URL for them.";

            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            let builderStrings = [];
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("No valid JSON response for proxy builders.");
                const parsed = JSON.parse(jsonMatch[0]);
                builderStrings = parsed.proxy_builder_strings;
                if (!Array.isArray(builderStrings) || builderStrings.length === 0) {
                    throw new Error("AI did not generate a valid array of proxy builder strings.");
                }
            } catch(e) {
                throw new Error('Failed to discover proxy builders: ' + e.message);
            }

            runtime.logEvent(\`[Discovery] ✅ Discovered \${builderStrings.length} new potential proxy strategies.\`);
            return { success: true, newBuilderStrings: builderStrings };
        `
    },
    {
        name: 'Export Learned Skills',
        description: 'Exports the definitions of user-created tools and currently learned proxy strategies as a JSON object.',
        category: 'Automation',
        executionEnvironment: 'Client',
        purpose: 'To allow the user to inspect, save, and share the new skills and adaptations the agent has learned during its operation.',
        parameters: [],
        implementationCode: `
            runtime.logEvent('[Export] Exporting learned skills and strategies...');
            const allTools = runtime.tools.list();
            
            // A list of hardcoded tool names that are part of the initial bootstrap
            const bootstrapToolNames = new Set([
                "Core Architectural Principle: Multiple Tool Calls Over JSON", "Workflow Creator", "Propose Skill From Observation",
                "Task Complete", "Tool Creator", "Debug Log View", "Server File Writer", "Start Node Process",
                "Start Python Process", "Stop Process", "List Managed Processes", "Execute Full Research and Proposal Workflow",
                "Bootstrap Web Proxy Service", "Test Web Proxy Service", "Refine Search Queries", "Diagnose and Retry Search",
                "Federated Scientific Search", "Read Webpage Content", "Extract References from Source",
                "Embed All Sources", "Generate 2D Map Coordinates", "Chunk and Embed Scientific Articles",
                "Hypothesis Generator via Conceptual Search", "Identify Meta-Analyses", "Analyze Single Source for Synergies",
                "Score Single Synergy", "Generate Proposal for Single Synergy", "Critique Investment Proposal",
                "Rank Synergies by Promise", "RecordRefinedQueries", "RecordValidatedSource", "RecordMetaAnalysis",
                "RecordPrimaryStudy", "RecordSynergy", "RecordSynergyGameParameters", "RecordTrialDossier",
                "RecordCritique", "RecordErrorAnalysis", "Diagnose Tool Execution Error", "InterpretVacancy",
                "FindPersonalizedVacancies", "CreateUserAgingVector", "ProjectUserOntoMap", "Synergy Forge Main UI",
                "AdaptFetchStrategy", "DiscoverProxyBuilders", "Find and Validate Single Source", "Export Learned Skills",
                "Rank Search Results"
            ]);

            const learnedTools = allTools.filter(tool => !bootstrapToolNames.has(tool.name));

            const proxyBuilders = await runtime.search.getProxyList();

            const exportData = {
                learnedTools: learnedTools.map(t => ({
                    name: t.name,
                    description: t.description,
                    category: t.category,
                    executionEnvironment: t.executionEnvironment,
                    parameters: t.parameters,
                    implementationCode: t.implementationCode,
                    purpose: t.purpose,
                })),
                learnedProxyStrategies: proxyBuilders.map(p => p.builderString),
            };

            runtime.logEvent(\`[Export] ✅ Exported \${learnedTools.length} learned tools and \${proxyBuilders.length} proxy strategies.\`);
            console.log('--- EXPORTED SKILLS ---');
            console.log(JSON.stringify(exportData, null, 2));

            return { 
                success: true, 
                message: 'Exported data has been logged to the browser console.',
                exportedData 
            };
        `
    },
    {
        name: 'Generate Conceptual Queries from Objective',
        description: 'Analyzes a research objective and existing literature to generate high-level conceptual questions for discovering novel, unstated synergies.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To steer the hypothesis generation process by creating abstract, "out-of-the-box" research questions that go beyond simple keyword searching.',
        parameters: [
            { name: 'researchObjective', type: 'string', description: 'The original high-level research goal.', required: true },
            { name: 'validatedSources', type: 'array', description: 'An array of validated source objects to provide context.', required: true },
        ],
        implementationCode: `
    const { researchObjective, validatedSources } = args;
    const systemInstruction = \`You are an expert bioinformatics researcher specializing in identifying novel research vectors.
Based on the user's high-level objective and the key findings from the provided literature summaries, generate 3 to 5 high-level conceptual questions designed to uncover novel, unstated synergies.
Frame these questions in the format of "Find a compound/intervention that achieves [DESIRED_EFFECT] while avoiding [UNDESIRED_EFFECT]" or "What is the relationship between [MECHANISM_A] and [MECHANISM_B] in the context of aging?".
Your goal is to provoke non-obvious connections.
You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
{ "conceptual_queries": ["query 1", "query 2", ...] }\`;

    const sourceSummaries = validatedSources.map(s => ({ title: s.title, summary: s.summary, reliability: s.reliabilityScore })).slice(0, 20); // Limit context size

    const prompt = \`Research Objective: "\${researchObjective}"\\n\\nSummaries of Existing Literature:\\n\${JSON.stringify(sourceSummaries)}\\n\\nBased on the above, generate conceptual queries:\`;
    
    const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
    let queries = [];
    try {
        const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
        if (!jsonMatch) throw new Error("No valid JSON response for conceptual queries. Raw response: " + aiResponseText);
        const parsed = JSON.parse(jsonMatch[0]);
        queries = parsed.conceptual_queries;
        if (!Array.isArray(queries) || queries.length === 0) throw new Error("AI did not generate a valid array of conceptual queries.");
    } catch(e) {
        throw new Error('Failed to generate conceptual queries: ' + e.message);
    }
    
    runtime.logEvent(\`[Conceptualizer] Generated \${queries.length} conceptual queries.\`);
    return { success: true, conceptual_queries: queries };
    `
    },
    {
        name: 'Refine Search Queries',
        description: 'Takes a high-level research objective and generates multiple specific, targeted search queries optimized for scientific databases. Includes a fallback mechanism for robustness.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To improve literature search quality by breaking down a broad topic into precise queries, with a built-in retry mechanism to handle AI model failures.',
        parameters: [
            { name: 'researchObjective', type: 'string', description: 'The high-level research goal.', required: true },
            { name: 'maxQueries', type: 'number', description: 'The maximum number of queries to generate (default: 5).', required: false },
        ],
        implementationCode: `
        const { researchObjective, maxQueries = 5 } = args;
        const systemInstruction = \`You are an expert search query generation assistant. Your task is to break down a high-level research objective into specific, targeted search queries for scientific databases like PubMed.
You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
{
  "queries": [
    "query 1",
    "query 2",
    ...
  ]
}\`;
        
        const prompt = 'Based on the research objective "' + researchObjective + '", generate up to ' + maxQueries + ' specific search queries. Prioritize queries that might find synergistic interactions, contraindications, and novel applications.';

        let queries = [];
        try {
            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            
            const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
            if (!jsonMatch) throw new Error("No JSON object found in the AI's response.");
            
            const parsedJson = JSON.parse(jsonMatch[0]);

            if (parsedJson && Array.isArray(parsedJson.queries)) {
                queries = parsedJson.queries;
                runtime.logEvent('[Refine Queries] ✅ Generated ' + queries.length + ' queries via primary JSON method.');
            } else {
                throw new Error("The parsed JSON does not contain a 'queries' array.");
            }
        } catch (e) {
            runtime.logEvent('[Refine Queries] ⚠️ Primary JSON method failed: ' + e.message + '. Attempting fallback text extraction...');
            
            // --- RESILIENCE: FALLBACK STRATEGY ---
            const fallbackSystemInstruction = "You are a search query generator. Provide a list of search queries based on the user's request, with each query on a new line. Do not add numbers, bullet points, or any other text.";
            const fallbackPrompt = 'Generate up to ' + maxQueries + ' search queries for the objective: "' + researchObjective + '"';
            
            try {
                const fallbackResponse = await runtime.ai.generateText(fallbackPrompt, fallbackSystemInstruction);
                queries = fallbackResponse.split('\\n').map(q => q.trim()).filter(q => q.length > 5);
                if (queries.length > 0) {
                    runtime.logEvent('[Refine Queries] ✅ Succeeded with fallback method, generated ' + queries.length + ' queries.');
                } else {
                    throw new Error("Fallback method also failed to produce valid queries.");
                }
            } catch (fallbackError) {
                throw new Error('AI failed to generate refined queries using both primary and fallback methods. Last error: ' + fallbackError.message);
            }
        }
        
        if (queries.length === 0) {
             throw new Error("AI failed to generate any refined queries.");
        }

        return { success: true, queries: queries };
    `
    },
     {
        name: 'Diagnose and Retry Search',
        description: 'Analyzes a failed search query, generates alternative queries, and re-runs the search. This is a recovery tool.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To provide a self-healing mechanism for the research workflow when the initial scientific search yields no results.',
        parameters: [
            { name: 'researchObjective', type: 'string', description: 'The original high-level research goal for context.', required: true },
            { name: 'originalQuery', type: 'string', description: 'The exact query string that failed or returned zero results.', required: true },
            { name: 'reasonForFailure', type: 'string', description: 'A brief description of why the search failed (e.g., "Returned zero results.").', required: true },
            { name: 'proxyUrl', type: 'string', description: 'Optional. The URL of a web proxy service to use.', required: false },
        ],
        implementationCode: `
            const { researchObjective, originalQuery, reasonForFailure, proxyUrl } = args;
            runtime.logEvent('[Search Diagnosis] Analyzing failed query: "' + originalQuery.substring(0, 100) + '..."');

            const systemInstruction = \`You are a search query diagnostics expert. A search failed. Analyze the original query and research objective, then generate 3 alternative, broader, and more general search queries that are more likely to yield results.
You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
{ "new_queries": ["query 1", "query 2", "query 3"] }\`;

            const prompt = 'The research objective is: "' + researchObjective + '". The following search query failed because: ' + reasonForFailure + '\\n\\nFailed Query:\\n"' + originalQuery + '"\\n\\nGenerate 3 broader alternative queries:';
            
            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            let newQueries = [];
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("No valid JSON response for new queries. Raw response: " + aiResponseText);
                const parsed = JSON.parse(jsonMatch[0]);
                newQueries = parsed.new_queries;
                if (!Array.isArray(newQueries) || newQueries.length === 0) throw new Error("AI did not generate a valid array of new queries.");
            } catch(e) {
                throw new Error('Failed to generate diagnostic queries: ' + e.message);
            }
            
            runtime.logEvent('[Search Diagnosis] Generated new queries: ' + newQueries.join('; '));
            
            // Retry the search with the new queries
            return await runtime.tools.run('Federated Scientific Search', {
                query: newQueries.join('; '),
                maxResultsPerSource: 15, // Get slightly fewer results on retry
                proxyUrl,
            });
        `
    },
    {
        name: 'Federated Scientific Search',
        description: 'Searches multiple scientific databases (PubMed, Google Patents, bioRxiv) for primary research articles related to a query. This is the mandatory first step of any research task.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To gather a high-quality, broad list of potential scientific literature from trusted sources, which will then be rigorously verified.',
        parameters: [
            { name: 'query', type: 'string', description: 'The research topic to investigate (e.g., "synergistic effects of metformin and rapamycin on aging"). Can be multiple queries separated by a semicolon.', required: true },
            { name: 'maxResultsPerSource', type: 'number', description: 'The maximum number of results to return from each data source (default: 5).', required: false },
            { name: 'sinceYear', type: 'number', description: 'Optional. Only return results published in or after this year.', required: false },
            { name: 'proxyUrl', type: 'string', description: 'Optional. The URL of a web proxy service to use for all network requests.', required: false },
        ],
        implementationCode: `
            const { query, maxResultsPerSource = 5, sinceYear, proxyUrl } = args;
            runtime.logEvent('[Search] Starting federated search for: "' + query.substring(0, 100) + '..."');
            
            const queries = query.split(';').map(q => q.trim()).filter(Boolean);
            const allResults = [];

            for (const q of queries) {
                const searchFunctions = [
                    () => runtime.search.pubmed(q, maxResultsPerSource, sinceYear, proxyUrl),
                    () => runtime.search.biorxiv(q, maxResultsPerSource, sinceYear, proxyUrl),
                    () => runtime.search.patents(q, maxResultsPerSource, proxyUrl),
                    () => runtime.search.web(q, maxResultsPerSource, proxyUrl),
                ];
                
                for (const searchFn of searchFunctions) {
                    try {
                        const results = await searchFn();
                        allResults.push(...results);
                    } catch (e) {
                        // The error is already logged by the individual search function.
                        // We can continue to the next source.
                    }
                    // Add a delay to avoid rate-limiting
                    await new Promise(resolve => setTimeout(resolve, 350));
                }
            }

            const uniqueResultsMap = new Map();
            for (const item of allResults) {
                const canonicalUrl = runtime.search.buildCanonicalUrl(item.link);
                if (canonicalUrl && !uniqueResultsMap.has(canonicalUrl)) {
                    // Update the item's link to the canonical one before storing
                    uniqueResultsMap.set(canonicalUrl, { ...item, link: canonicalUrl });
                }
            }
            const uniqueResults = Array.from(uniqueResultsMap.values());
            
            runtime.logEvent('[Search] Federated search complete. Found ' + uniqueResults.length + ' unique potential sources.');

            return {
                success: true,
                message: 'Found ' + uniqueResults.length + ' potential articles.',
                searchResults: uniqueResults,
            };
        `,
    },
    {
        name: 'Find and Validate Single Source',
        description: 'A resilient tool that takes a single search result, tries multiple methods to fetch its full content, then uses an AI to validate, summarize, and score it against the research objective.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To provide a robust, single-source validation pipeline that can be iteratively called by a workflow, allowing for graceful error handling and retries.',
        parameters: [
            { name: 'searchResult', type: 'object', description: 'A single search result object containing a "title" and a "link".', required: true },
            { name: 'researchObjective', type: 'string', description: 'The original research objective to provide context for summarization and validation.', required: true },
            { name: 'proxyUrl', type: 'string', description: 'Optional. The URL of a web proxy service to use for fetching content.', required: false },
        ],
        implementationCode: `
            const { searchResult, researchObjective, proxyUrl } = args;

            // Step 1: Enrich the source by fetching its content
            runtime.logEvent(\`[Validator] Enriching: \${searchResult.link.substring(0, 70)}...\`);
            const enrichedSource = await runtime.search.enrichSource(searchResult, proxyUrl);
            if (!enrichedSource || !enrichedSource.snippet || enrichedSource.snippet.startsWith('Fetch failed')) {
                throw new Error('Failed to fetch or enrich content for the source.');
            }
            
            // --- NEW: Pre-validation Step ---
            // Check if the snippet is garbage (e.g., a "coming soon" message) before calling the AI.
            const snippetText = enrichedSource.snippet.toLowerCase();
            if (snippetText.length < 150 && (snippetText.includes('will be available') || snippetText.includes('not found') || snippetText.includes('no abstract'))) {
                throw new Error(\`Skipping source due to low-quality snippet: "\${enrichedSource.snippet.substring(0,100)}..."\`);
            }

            // Step 2: Validate the enriched content using an AI model
            runtime.logEvent(\`[Validator] Validating: \${(enrichedSource.title || '').substring(0, 50)}...\`);
            
            const truncatedTitle = (enrichedSource.title || '').substring(0, 300);
            const truncatedSnippet = (enrichedSource.snippet || '').substring(0, 4000);

            const validationContext = \`<PRIMARY_SOURCE>\\n<TITLE>\${truncatedTitle}</TITLE>\\n<URL>\${enrichedSource.link}</URL>\\n<SNIPPET>\\n\${truncatedSnippet}\\n</SNIPPET>\\n</PRIMARY_SOURCE>\`;
            
            const systemInstruction = \`You are an automated data extraction service. Your SOLE function is to analyze the provided scientific source and call the 'RecordValidatedSource' tool.
- You must provide a concise summary, a reliability score (0.0-1.0), and a justification for the score.
- CRITICAL: Do NOT write ANY text or explanations. Your entire response MUST consist of a single tool call.\`;
            
            const validationPrompt = 'Research Objective: "' + researchObjective + '"\\n\\nBased on the objective, assess, summarize, and record the following source by calling the \\'RecordValidatedSource\\' tool.\\n\\n' + validationContext;

            const recordTool = runtime.tools.list().find(t => t.name === 'RecordValidatedSource');
            if (!recordTool) throw new Error("Core tool 'RecordValidatedSource' not found.");

            const aiResponse = await runtime.ai.processRequest(validationPrompt, systemInstruction, [recordTool]);

            if (!aiResponse || !aiResponse.toolCalls || aiResponse.toolCalls.length !== 1 || aiResponse.toolCalls[0].name !== 'RecordValidatedSource') {
                let analysis = "AI did not return exactly one 'RecordValidatedSource' tool call.";
                if (aiResponse && aiResponse.text && aiResponse.text.trim()) {
                    analysis += \` AI's textual response was: "\${aiResponse.text.trim()}"\`;
                }
                throw new Error(analysis);
            }
            
            // Step 3: Record the validated source
            const toolCall = aiResponse.toolCalls[0];

            // FIX: AI models can sometimes omit the 'title' field in the tool call.
            // If it's missing, we re-insert it from our context to prevent crashes.
            if (toolCall.arguments && !toolCall.arguments.title && enrichedSource.title) {
                runtime.logEvent('[Validator] ⚠️ AI omitted title from tool call. Re-inserting it from context.');
                toolCall.arguments.title = enrichedSource.title;
            }

            const executionResult = await runtime.tools.run(toolCall.name, toolCall.arguments);
            if (!executionResult || !executionResult.validatedSource) {
                throw new Error("Recording the validated source failed.");
            }
            
            const finalValidatedSource = {
                ...executionResult.validatedSource,
                url: executionResult.validatedSource.uri, // Align property names
                textContent: enrichedSource.textContent, // Carry over the full text
            };

            // FIX: Add a defensive check here to prevent crash even if title is somehow still missing.
            const titleForLog = finalValidatedSource.title || 'Untitled Source';
            runtime.logEvent(\`[Validator] ✅ Validated: \${titleForLog.substring(0, 50)}...\`);
            
            return { success: true, validatedSource: finalValidatedSource };
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
          runtime.logEvent('[Web Reader] Fetching content from: ' + url + ' via proxy ' + proxyUrl);
          try {
              const response = await fetch(proxyUrl + '/browse', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url }),
              });

              if (!response.ok) {
                  const errorText = await response.text();
                  throw new Error('Proxy service failed with status ' + response.status + ': ' + errorText);
              }
              
              const htmlContent = await response.text();
              
              // Basic HTML stripping
              const textContent = htmlContent
                  .replace(/<style[^>]*>[\\s\\S]*?<\\/style>/gi, '')
                  .replace(/<script[^>]*>[\\s\\S]*?<\\/script>/gi, '')
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/\\s\\s+/g, ' ')
                  .trim();
              
              return { success: true, textContent };

          } catch (e) {
              const errorMessage = e instanceof Error ? e.message : String(e);
              throw new Error('Failed to read webpage content: ' + errorMessage);
          }
        `,
    },
    {
        name: 'Extract References from Source',
        description: 'Analyzes the full text content of a scientific article to find and extract the titles of papers listed in its "References" or "Bibliography" section.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To enable citation chaining (snowballing), allowing the agent to discover more relevant literature by exploring the references of a highly relevant source.',
        parameters: [
            { name: 'sourceContent', type: 'string', description: 'The full text content of the scientific article.', required: true },
        ],
        implementationCode: `
        const { sourceContent } = args;
        if (!sourceContent || sourceContent.length < 100) {
            return { success: true, reference_titles: [] };
        }
        
        const systemInstruction = \`You are an expert research assistant. Your task is to extract the titles of publications from the 'References' or 'Bibliography' section of a scientific paper.
- Focus ONLY on the titles of the referenced works.
- Exclude authors, journal names, page numbers, and years.
- You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
{
  "reference_titles": ["The complete title of the first reference.", "The complete title of the second reference."]
}
- If no references are found, return an empty array.\`;

        const prompt = 'Here is the text of a scientific paper. Please extract the publication titles from its reference list at the end of the document.\\n\\n' + sourceContent.substring(0, 50000); // Truncate to avoid excessive token usage

        const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
        
        let responseJson;
        try {
            const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
            if (!jsonMatch) throw new Error("No JSON object found in the AI's response. Raw response: " + aiResponseText);
            responseJson = JSON.parse(jsonMatch[0]);
        } catch (e) {
            runtime.logEvent('[Extract Refs] ❌ Error parsing JSON. AI Response: ' + aiResponseText);
            throw new Error('Failed to parse the AI\\'s reference extraction response. Details: ' + e.message);
        }
        
        if (!responseJson.reference_titles || !Array.isArray(responseJson.reference_titles)) {
            throw new Error("AI response did not contain a valid 'reference_titles' array.");
        }
        
        runtime.logEvent('[Extract Refs] ✅ Extracted ' + responseJson.reference_titles.length + ' reference titles.');
        return { success: true, reference_titles: responseJson.reference_titles };
    `
    },
];