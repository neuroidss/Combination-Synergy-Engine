import type { ToolCreatorPayload } from '../types';

export const RESEARCH_TOOLS: ToolCreatorPayload[] = [
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
You MUST respond with ONLY a single, valid JSON object in the following format:
{
  "queries": [
    "query 1",
    "query 2",
    ...
  ]
}
Do not add any text, explanations, or markdown formatting like \\\`\\\`\\\`json before or after the JSON object.\`;
        
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
You MUST respond with ONLY a single, valid JSON object in the following format:
{ "new_queries": ["query 1", "query 2", "query 3"] }\`;

            const prompt = 'The research objective is: "' + researchObjective + '". The following search query failed because: ' + reasonForFailure + '\\n\\nFailed Query:\\n"' + originalQuery + '"\\n\\nGenerate 3 broader alternative queries:';
            
            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            let newQueries = [];
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("No valid JSON response for new queries.");
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

            const uniqueResults = Array.from(new Map(allResults.map(item => [item.link, item])).values());
            
            runtime.logEvent('[Search] Federated search complete. Found ' + uniqueResults.length + ' unique potential sources.');

            return {
                success: true,
                message: 'Found ' + uniqueResults.length + ' potential articles.',
                searchResults: uniqueResults,
            };
        `,
    },
    {
        name: 'Enrich and Validate Sources',
        description: 'Takes a list of search results, enriches them by fetching their content one-by-one to avoid rate-limiting, then uses an AI to validate, summarize, and score each source individually for maximum reliability.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To programmatically verify a list of search results link to valid scientific articles and to extract summaries from the confirmed sources using a resilient, sequential AI validation process.',
        parameters: [
            { name: 'searchResults', type: 'array', description: 'An array of search result objects, each containing a "title" and a "link".', required: true },
            { name: 'proxyUrl', type: 'string', description: 'The URL of the bootstrapped web proxy service to use for fetching content.', required: false },
            { name: 'researchObjective', type: 'string', description: 'The original research objective to provide context for summarization and validation.', required: true },
        ],
        implementationCode: `
            const { searchResults, proxyUrl, researchObjective } = args;
            if (!Array.isArray(searchResults) || searchResults.length === 0) {
                return { success: true, validatedSources: [] };
            }
            
            runtime.logEvent(\`[Validator] Starting enrichment for \${searchResults.length} sources... Using proxy: \${proxyUrl || 'default'}\`);
            
            // Enrich sources sequentially to avoid rate limiting
            const enrichedResults = [];
            for (const [index, res] of searchResults.entries()) {
                runtime.logEvent(\`[Enricher] Processing source \${index + 1}/\${searchResults.length}: \${res.link.substring(0, 70)}...\`);
                try {
                    const enriched = await runtime.search.enrichSource(res, proxyUrl);
                    enrichedResults.push(enriched);
                } catch (e) {
                    runtime.logEvent(\`[Enricher] ERROR: Failed to enrich source \${res.link}: \${e.message}\`);
                    enrichedResults.push({ ...res, snippet: \`Fetch failed. Could not retrieve content from the source.\` });
                }
                // Delay to avoid rate-limiting
                await new Promise(resolve => setTimeout(resolve, 350));
            }

            const successfullyEnriched = enrichedResults.filter(res => res.snippet && !res.snippet.startsWith('Fetch failed'));
            if (successfullyEnriched.length < enrichedResults.length) {
                runtime.logEvent(\`[Validator] WARN: Dropped \${enrichedResults.length - successfullyEnriched.length} sources due to fetch/enrichment failures.\`);
            }
            if (successfullyEnriched.length === 0) {
                runtime.logEvent('[Validator] No sources could be successfully enriched. Halting validation.');
                return { success: true, validatedSources: [] };
            }
            
            runtime.logEvent(\`[Validator] Enrichment complete. Sending \${successfullyEnriched.length} sources to AI for validation one-by-one for increased reliability.\`);
            
            const allValidatedSources = [];
            
            for (const source of successfullyEnriched) {
                 try {
                    const validationContext = \`<PRIMARY_SOURCE>\\n<TITLE>\${source.title}</TITLE>\\n<URL>\${source.link}</URL>\\n<SNIPPET>\\n\${source.snippet}\\n</SNIPPET>\\n</PRIMARY_SOURCE>\`;
                    
                    const systemInstruction = \`You are an automated data extraction service. Your SOLE function is to analyze the provided scientific source and call the 'RecordValidatedSource' tool.
- You must provide a concise summary, a reliability score (0.0-1.0), and a justification for the score.
- CRITICAL: Do NOT write ANY text or explanations. Your entire response MUST consist of a single tool call.\`;
                    
                    const validationPrompt = 'Research Objective: "' + researchObjective + '"\\n\\nBased on the objective, assess, summarize, and record the following source by calling the \\'RecordValidatedSource\\' tool.\\n\\n' + validationContext;

                    const recordTool = runtime.tools.list().find(t => t.name === 'RecordValidatedSource');
                    if (!recordTool) throw new Error("Core tool 'RecordValidatedSource' not found.");

                    const aiResponse = await runtime.ai.processRequest(validationPrompt, systemInstruction, [recordTool]);

                    if (!aiResponse || !aiResponse.toolCalls || aiResponse.toolCalls.length !== 1) {
                        let analysis = "AI did not return exactly one tool call for this source.";
                        if (aiResponse && aiResponse.text && aiResponse.text.trim()) {
                            analysis += \` AI's textual response was: "\${aiResponse.text.trim()}"\`;
                        } else if (aiResponse && aiResponse.toolCalls && aiResponse.toolCalls.length > 1) {
                            analysis += \` Instead, it returned \${aiResponse.toolCalls.length} tool calls.\`;
                        } else {
                            analysis += " The AI returned no tool calls and no text.";
                        }
                        throw new Error(analysis);
                    }
                    
                    const toolCall = aiResponse.toolCalls[0];
                    if (toolCall.name === 'RecordValidatedSource') {
                        const executionResult = await runtime.tools.run(toolCall.name, toolCall.arguments);
                        if(executionResult.validatedSource) {
                            allValidatedSources.push({
                                url: executionResult.validatedSource.uri,
                                title: executionResult.validatedSource.title,
                                summary: executionResult.validatedSource.summary,
                                reliabilityScore: executionResult.validatedSource.reliability,
                                justification: executionResult.validatedSource.reliabilityJustification,
                                textContent: source.textContent, // Carry over the full text
                            });
                            runtime.logEvent(\`[Validator] ✅ Validated: \${source.title.substring(0, 50)}...\`);
                        }
                    } else {
                        throw new Error("AI called an unexpected tool: " + toolCall.name);
                    }
                } catch (e) {
                    runtime.logEvent(\`[Validator] ❌ ERROR validating source: \${source.title.substring(0,50)}... Error: \${e.message}. Skipping.\`);
                }
                // Add a delay to avoid rate-limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            runtime.logEvent('[Validator] ✅ Validation finished. ' + allValidatedSources.length + ' of ' + successfullyEnriched.length + ' sources were validated.');

            return {
                success: true,
                message: 'Validation complete. ' + allValidatedSources.length + ' of ' + searchResults.length + ' sources were validated.',
                validatedSources: allValidatedSources,
            };
        `,
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
- Return ONLY a JSON object with a single key "reference_titles", which is an array of strings. Each string must be a single, complete title.
- If no references are found, return an empty array. Do not add any text outside the JSON object.\`;

        const prompt = 'Here is the text of a scientific paper. Please extract the publication titles from its reference list at the end of the document.\\n\\n' + sourceContent.substring(0, 50000); // Truncate to avoid excessive token usage

        const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
        
        let responseJson;
        try {
            const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
            if (!jsonMatch) throw new Error("No JSON object found in the AI's response.");
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