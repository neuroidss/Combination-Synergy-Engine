import type { ToolCreatorPayload } from '../types';

export const COMMERCIAL_TOOLS: ToolCreatorPayload[] = [
    {
        name: 'FindPotentialIndications',
        description: 'Analyzes a synergy\'s mechanism of action and proposes 3-5 commercially viable target indications (diseases).',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To identify specific, marketable diseases for a given therapeutic mechanism, moving from general longevity to concrete clinical targets.',
        parameters: [
            { name: 'synergySummary', type: 'string', description: 'A summary of the synergy\'s mechanism of action.', required: true },
            { name: 'combination', type: 'array', description: 'The array of intervention objects, each with a "name".', required: true }
        ],
        implementationCode: `
            const { synergySummary, combination } = args;
            const comboString = combination.map(c => c.name).join(' + ');
    
            const systemInstruction = \`You are a biopharmaceutical strategy consultant. Based on a therapeutic mechanism, identify the top 3-5 commercially viable disease indications.
- Prioritize indications with high unmet medical need.
- Prefer indications with clear, measurable clinical endpoints.
- Avoid overly broad terms like "aging". Focus on specific, recognized diseases (e.g., "Sarcopenia", "Idiopathic Pulmonary Fibrosis", "Alzheimer's Disease").
You MUST respond with ONLY a single, valid JSON object in the format:
{
  "indications": [
    { "indication": "Sarcopenia", "justification": "The mechanism's effect on autophagy is directly relevant to muscle cell health, and there are no approved treatments." },
    { "indication": "Non-alcoholic fatty liver disease (NAFLD)", "justification": "Metabolic regulation via AMPK/mTOR is a key therapeutic target for NAFLD." }
  ]
}\`;
            
            const prompt = \`The therapeutic combination of \${comboString} has the following mechanism/summary: "\${synergySummary}". Identify the top potential disease indications.\`;
    
            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("AI did not return a valid JSON object for indications. Raw: " + aiResponseText);
                const parsed = JSON.parse(jsonMatch[0]);
                if (!parsed.indications || !Array.isArray(parsed.indications)) {
                    throw new Error("AI response did not contain an 'indications' array.");
                }
                return { success: true, indications: parsed.indications };
            } catch(e) {
                throw new Error('Failed to find potential indications: ' + e.message);
            }
        `
    },
    {
        name: 'AnalyzeMarketData',
        description: 'For a given disease, performs web searches to find market size, CAGR, and key competitors, then synthesizes the findings.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To gather and structure essential market intelligence for a specific therapeutic area.',
        parameters: [
            { name: 'indication', type: 'string', description: 'The specific disease or medical condition to analyze (e.g., "Sarcopenia").', required: true }
        ],
        implementationCode: `
            const { indication } = args;
            runtime.logEvent(\`[Market Analysis] Analyzing market for: \${indication}\`);
            
            const queries = [
                \`"\${indication}" market size forecast 2030\`,
                \`"\${indication}" treatment market CAGR\`,
                \`"\${indication}" pharmaceutical competitors pipeline\`
            ];
    
            const searchResult = await runtime.tools.run('Federated Scientific Search', { query: queries.join('; '), maxResultsPerSource: 3 });
            const sources = searchResult.searchResults || [];
            
            if (sources.length === 0) {
                throw new Error(\`Web search returned no results for market analysis of '\${indication}'.\`);
            }
    
            const context = sources.map(s => \`SOURCE: \${s.title}\\nSNIPPET: \${s.snippet}\`).join('\\n\\n');
    
            const systemInstruction = \`You are a biotech market analyst. From the provided search snippets, extract the Total Addressable Market (TAM), Compound Annual Growth Rate (CAGR), and a list of key competitors or drug classes in development.
- Market size should be in USD.
- If multiple values are present, cite the most recent or credible one.
- If a value is not found, state "Not found".
You MUST respond with ONLY a single, valid JSON object in the format:
{
  "tam": "$4.5 Billion by 2028",
  "cagr": "approx. 8.5%",
  "competitors": ["Inhibitors of myostatin (e.g., Apitegromab)", "Selective androgen receptor modulators (SARMs)"],
  "summary": "The market is growing steadily with a high unmet need, but several late-stage competitors are emerging."
}\`;
    
            const prompt = \`Based on these search results for '\${indication}', provide a market analysis.\\n\\nSEARCH RESULTS:\\n\${context}\`;
    
            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("AI did not return valid JSON for market data. Raw: " + aiResponseText);
                const parsed = JSON.parse(jsonMatch[0]);
                return { success: true, marketData: parsed };
            } catch(e) {
                throw new Error('Failed to analyze market data: ' + e.message);
            }
        `
    },
    {
        name: 'AnalyzeCompetitors',
        description: 'For a given disease indication, performs web searches to identify key pharmaceutical competitors and drugs in development.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To gather essential competitive intelligence for a specific therapeutic area.',
        parameters: [
            { name: 'indication', type: 'string', description: 'The specific disease to analyze (e.g., "Sarcopenia").', required: true }
        ],
        implementationCode: `
        const { indication } = args;
        runtime.logEvent(\`[Competitor Analysis] Analyzing competitors for: \${indication}\`);
        
        const queries = [
            \`"\${indication}" pharmaceutical competitors pipeline\`,
            \`"\${indication}" clinical trials drugs\`,
            \`companies developing treatments for "\${indication}"\`
        ];

        const searchResult = await runtime.tools.run('Federated Scientific Search', { query: queries.join('; '), maxResultsPerSource: 3 });
        const sources = searchResult.searchResults || [];
        
        if (sources.length === 0) {
            return { success: true, competitors: ["No direct competitors found in a quick search."] };
        }

        const context = sources.map(s => \`SOURCE: \${s.title}\\nSNIPPET: \${s.snippet}\`).join('\\n\\n');

        const systemInstruction = \`You are a biotech market analyst. From the provided search snippets, extract a list of key competitors (companies) and specific drugs or drug classes in development for the given indication.
You MUST respond with ONLY a single, valid JSON object in the format:
{
  "competitors": ["Company A (Drug: drug-123, Phase II)", "Company B (Drug Class: XYZ inhibitors)"]
}\`;

        const prompt = \`Based on these search results for '\${indication}', provide a list of competitors.\\n\\nSEARCH RESULTS:\\n\${context}\`;

        const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
        try {
            const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
            if (!jsonMatch) throw new Error("AI did not return valid JSON for competitor data. Raw: " + aiResponseText);
            const parsed = JSON.parse(jsonMatch[0]);
            return { success: true, competitors: parsed.competitors || [] };
        } catch(e) {
            throw new Error('Failed to analyze competitor data: ' + e.message);
        }
    `
    },
    {
        name: 'ProposeIntellectualPropertyStrategy',
        description: 'Analyzes intervention components and proposes realistic IP strategies (e.g., method-of-use, formulation patents).',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To identify viable pathways for creating a defensible intellectual property position around a therapeutic combination.',
        parameters: [
            { name: 'components', type: 'array', description: 'An array of intervention objects, each with a "name".', required: true },
            { name: 'indication', type: 'string', description: 'The specific disease being targeted.', required: true }
        ],
        implementationCode: `
            const { components, indication } = args;
            const componentNames = components.map(c => c.name);
    
            const systemInstruction = \`You are a patent attorney specializing in pharmaceuticals. For the given combination and indication, propose the most viable intellectual property (IP) strategies.
- First, determine if the components are likely generic or proprietary.
- If generic, focus on "Method-of-Use" and "Formulation" patents.
- Be specific in your descriptions.
You MUST respond with ONLY a single, valid JSON object in the format:
{
  "strategies": [
    { "type": "Method-of-Use Patent", "description": "Patenting the specific dosing regimen (e.g., cyclical administration on non-training days) for treating '\${indication}'. This is the strongest strategy if the protocol is novel and non-obvious." },
    { "type": "Formulation Patent", "description": "Developing a novel co-formulation, such as a single pill with controlled-release layers for each component, to improve bioavailability or patient compliance." }
  ]
}\`;
    
            const prompt = \`The therapeutic combination is \${componentNames.join(' + ')} for the treatment of \${indication}. Propose IP strategies.\`;
            
            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("AI did not return valid JSON for IP strategy. Raw: " + aiResponseText);
                const parsed = JSON.parse(jsonMatch[0]);
                if (!parsed.strategies || !Array.isArray(parsed.strategies)) {
                    throw new Error("AI response did not contain a 'strategies' array.");
                }
                return { success: true, strategies: parsed.strategies };
            } catch(e) {
                throw new Error('Failed to propose IP strategy: ' + e.message);
            }
        `
    },
    {
        name: "FindMarketPriceForLabItem",
        description: "Searches major lab suppliers for a specific lab item (chemical, kit) and attempts to extract its price in USD using web scraping and AI analysis. This tool is designed to be updatable.",
        category: "Functional",
        executionEnvironment: "Client",
        purpose: "To dynamically fetch real-world cost data for scientific materials, enabling on-the-fly, evidence-based cost estimation. Its implementation can be updated by the 'UpdatePricingModel' workflow.",
        parameters: [
            { name: "itemName", type: "string", description: "The name of the chemical, kit, or material to search for.", required: true }
        ],
        implementationCode: `
            const { itemName } = args;
            runtime.logEvent(\`[Price Finder] Searching market price for: \${itemName}\`);
    
            const VENDORS = ['sigmaaldrich.com', 'fisherscientific.com', 'thermofisher.com', 'scbt.com', 'vwr.com'];

            try {
                // Stage 1: Search for the product page across multiple trusted vendors
                const searchResults = await runtime.search.web(\`"\${itemName}" price site:\${VENDORS.join(' OR site:')}\`, 5);
                
                let productUrl = null;
                if (searchResults && searchResults.length > 0) {
                    for (const result of searchResults) {
                        try {
                             if (result.link.toLowerCase().endsWith('.pdf')) {
                                continue;
                            }
                            const hostname = new URL(result.link).hostname;
                            if (VENDORS.some(v => hostname.includes(v))) {
                                productUrl = result.link;
                                break; // Found a valid vendor link
                            }
                        } catch (e) { /* ignore invalid URLs */ }
                    }
                }

                if (!productUrl) {
                    runtime.logEvent(\`[Price Finder] Could not find a product page on trusted vendors for \${itemName}.\`);
                    return { price: null };
                }

                runtime.logEvent(\`[Price Finder] Found potential product page: \${productUrl}\`);

                // Stage 2: "Read" the page using the mandatory web proxy
                const proxyUrl = 'http://localhost:3002'; // Hardcoded as this is a known, bootstrapped service
                const pageContentResult = await runtime.tools.run('Read Webpage Content', { url: productUrl, proxyUrl });
                const pageContent = pageContentResult.textContent;

                if (!pageContent) {
                    throw new Error("Failed to read content from product page.");
                }
                
                // Stage 3: Ask the AI to extract the price from the text
                const systemInstruction = \`You are an expert data extraction bot. Your only task is to find the price in USD from the provided text of a product webpage. Look for patterns like "$123.45" or "Price: 123.45 USD". If there are multiple prices for different quantities, pick the smallest one. You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown. Your response format must be: {"price": 123.45} or {"price": null} if not found.\`;
                const prompt = \`Extract the price in USD from this text:\\n\\n\${pageContent.substring(0, 15000)}\`;

                const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
                
                let parsedResult;
                try {
                    const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                    if (!jsonMatch) throw new Error("AI did not return a valid JSON object.");
                    parsedResult = JSON.parse(jsonMatch[0]);
                } catch(e) {
                    runtime.logEvent(\`[Price Finder] ⚠️ Failed to parse price from AI for \${itemName}. AI response: \${aiResponseText}\`);
                    return { price: null };
                }

                if (parsedResult && typeof parsedResult.price === 'number') {
                    runtime.logEvent(\`[Price Finder] ✅ Found price for \${itemName}: $\${parsedResult.price}\`);
                    return { price: parsedResult.price };
                }
                
                runtime.logEvent(\`[Price Finder] Could not determine a price for \${itemName}.\`);
                return { price: null };

            } catch (e) {
                runtime.logEvent(\`[Price Finder] ❌ Error fetching price for \${itemName}: \${e.message}\`);
                return { price: null }; // Never break the main process
            }
        `
    },
    {
        name: "Price Experiment Plan",
        description: "Calculates the estimated cost of a full in vitro experiment plan by querying a knowledge base of market prices for lab consumables and services.",
        category: "Functional",
        executionEnvironment: "Client",
        purpose: "To assign a real-world cost to a detailed, multi-step scientific research plan, enabling economic prioritization of hypotheses.",
        parameters: [
            { name: "experimentPlan", type: "object", description: "The JSON object defining the experiment from the 'DeconstructHypothesisToExperimentPlan' tool.", required: true }
        ],
        implementationCode: `
            const { experimentPlan } = args;
            const COST_DATABASE = {
                // Cell Lines
                "Human primary fibroblasts (HDFs)": { "cost": 800, "unit": "per vial" },
                "HEK293 cells": { "cost": 450, "unit": "per vial" },
                "SH-SY5Y neuroblastoma cells": { "cost": 550, "unit": "per vial" },
                // Basic Assays & Kits
                "Cell Viability Assay (MTT)": { "cost": 350, "unit": "per 96-well plate" },
                "Senescence Staining (SA-β-gal)": { "cost": 400, "unit": "per kit (20-50 samples)" },
                "ATP Luminescence Assay": { "cost": 450, "unit": "per 96-well plate kit" },
                "ELISA (Cytokine Panel)": { "cost": 900, "unit": "per 96-well plate kit" },
                "Basic Toxicology Panel": { "cost": 1200, "unit": "per compound" },
                // Molecular Biology
                "qPCR for SIRT1 and p53 genes": { "cost": 200, "unit": "per gene, per plate" },
                "Western Blot for mTOR protein": { "cost": 650, "unit": "per protein target" },
                // Advanced Assays
                "Mitochondrial Respiration Assay (Seahorse)": { "cost": 2500, "unit": "per plate, full run" },
                "High-Content Imaging Screen": { "cost": 3000, "unit": "per plate, per marker" },
                // General & Overhead
                "Cell Culture Maintenance": { "cost": 500, "unit": "per month" },
                "Overhead & Consumables": { "cost_multiplier": 1.5, "unit": "factor on subtotal" },
                "Default Assay": { "cost": 700, "unit": "per plate/kit" }, // Price for any unlisted assay
            };
    
            let subTotal = 0;
            const costBreakdown = [];
    
            // Cost of cell model
            if (experimentPlan.cell_model) {
                const cellModelCost = COST_DATABASE[experimentPlan.cell_model]?.cost || 500;
                subTotal += cellModelCost;
                costBreakdown.push({ item: experimentPlan.cell_model, cost: cellModelCost });
            }
    
            // Cost of measurements/assays
            if (experimentPlan.key_measurements) {
                for (const measurement of experimentPlan.key_measurements) {
                    const matchedKey = Object.keys(COST_DATABASE).find(key => measurement.toLowerCase().includes(key.toLowerCase().split(' for ')[0]));
                    if (matchedKey) {
                        const costItem = COST_DATABASE[matchedKey];
                        subTotal += costItem.cost;
                        costBreakdown.push({ item: measurement, cost: costItem.cost });
                    } else {
                        // If not found in DB, search online
                        const marketPriceResult = await runtime.tools.run('FindMarketPriceForLabItem', { itemName: measurement });
                        if (marketPriceResult && marketPriceResult.price !== null) {
                            subTotal += marketPriceResult.price;
                            costBreakdown.push({ item: measurement, cost: marketPriceResult.price });
                        } else {
                            // If still not found, use default
                            const defaultCostItem = COST_DATABASE["Default Assay"];
                            subTotal += defaultCostItem.cost;
                            costBreakdown.push({ item: \`\${measurement} (Unlisted)\`, cost: defaultCostItem.cost });
                        }
                    }
                }
            }
            
            subTotal += COST_DATABASE["Cell Culture Maintenance"].cost;
            costBreakdown.push({ item: "Cell Culture Maintenance", cost: COST_DATABASE["Cell Culture Maintenance"].cost });

            const totalCost = subTotal * COST_DATABASE['Overhead & Consumables'].cost_multiplier;
    
            runtime.logEvent(\`[Cost Engine] ✅ Estimated cost for plan: $\\\${totalCost.toFixed(0)}\`);
            return { success: true, estimatedCost: Math.round(totalCost), costBreakdown: costBreakdown };
        `
    },
    {
        name: "Estimate Synergy Validation Cost",
        description: "Provides a rapid, first-pass cost estimate for validating a synergistic combination by summing the known costs of its individual interventions.",
        category: "Functional",
        executionEnvironment: "Client",
        purpose: "To immediately attach a cost to a newly discovered synergy, enabling rapid financial prioritization without needing a full, detailed experiment plan.",
        parameters: [
            { name: "combination", type: "array", description: "The array of intervention objects, each with a 'name' and 'type'.", required: true }
        ],
        implementationCode: `
            const { combination } = args;
            
            // This internal DB acts as a cache and source for common items
            const INTERVENTION_COST_DB = {
                // Common Drugs & Supplements
                "Metformin": { cost: 1200, note: "Standard in vitro screening package" },
                "Rapamycin": { cost: 1800, note: "mTOR pathway analysis" },
                "Resveratrol": { cost: 1000, note: "Basic sirtuin activity assays" },
                "NMN": { cost: 1500, note: "NAD+ level measurement and metabolic assays" },
                "Dasatinib": { cost: 2500, note: "Senolytic activity and toxicity screen" },
                "Quercetin": { cost: 1000, note: "Basic antioxidant and senolytic assays" },
                "Fisetin": { cost: 1300, note: "Advanced senolytic and antioxidant assays" },
                // Lifestyle (cost of measuring effects)
                "Exercise": { cost: 2000, note: "Simulated via myokine application, includes metabolic assays" },
                "Caloric Restriction": { cost: 1500, note: "Nutrient-deprived media, includes mTOR/AMPK analysis" },
                // Other
                "Unknown Compound": { cost: 3000, note: "Default for unlisted/unfound compounds" },
                "Base Assay Suite": { cost: 2500, note: "Core set of assays (viability, senescence, qPCR) for any synergy" }
            };

            let totalCost = INTERVENTION_COST_DB["Base Assay Suite"].cost;
            const costBreakdown = [{ item: "Base Assay Suite", cost: totalCost, note: INTERVENTION_COST_DB["Base Assay Suite"].note }];

            for (const intervention of combination) {
                let foundCost = false;
                let interventionCost = 0;
                let itemNote = '';

                // First, check the quick internal database
                const dbKey = Object.keys(INTERVENTION_COST_DB).find(k => intervention.name.toLowerCase().includes(k.toLowerCase()));
                if (dbKey) {
                    const item = INTERVENTION_COST_DB[dbKey];
                    interventionCost = item.cost;
                    itemNote = item.note;
                    foundCost = true;
                }
                
                // If not found, search online
                if (!foundCost) {
                    const marketPriceResult = await runtime.tools.run('FindMarketPriceForLabItem', { itemName: intervention.name });
                    if (marketPriceResult && marketPriceResult.price !== null) {
                        // Multiply by a factor, since the substance cost is not the full analysis cost
                        interventionCost = marketPriceResult.price * 5 + 500; 
                        itemNote = 'Price estimated from market rate + analysis overhead';
                        foundCost = true;
                    }
                }

                // If still not found anywhere, use the default
                if (!foundCost) {
                    const unknown = INTERVENTION_COST_DB["Unknown Compound"];
                    interventionCost = unknown.cost;
                    itemNote = unknown.note;
                }

                totalCost += interventionCost;
                costBreakdown.push({ item: intervention.name, cost: Math.round(interventionCost), note: itemNote });
            }

            const finalCost = Math.round(totalCost);
            runtime.logEvent(\`[Fast Cost] Estimated cost for \${combination.map(c=>c.name).join(' + ')}: $\\\${finalCost}\`);
            return { success: true, estimatedCost: finalCost, costBreakdown };
        `
    },
    {
        name: 'Prioritize Hypotheses by ROI',
        description: "Ranks a list of hypotheses/synergies based on their 'Scientific ROI', calculated from their scientific promise (Trial Priority Score) and estimated validation cost.",
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: "To create a final, venture-capital-ready list of the most promising and cost-effective research projects to pursue.",
        parameters: [
            { name: 'hypotheses', type: 'array', description: 'An array of hypothesis/synergy objects, each needing trialPriorityScore and estimatedTestCost properties.', required: true },
        ],
        implementationCode: `
            const { hypotheses } = args;
            if (!hypotheses || hypotheses.length === 0) {
                return { success: true, rankedHypotheses: [] };
            }
            
            const ranked = hypotheses.map(h => {
                const score = (h.data.trialPriorityScore || (h.data.synergyData && h.data.synergyData.trialPriorityScore) || 50);
                const cost = h.data.estimatedCost || 2500; // Use default cost if not present
                return {
                    ...h,
                    scientificROI: score * 100 / cost,
                };
            }).sort((a, b) => b.scientificROI - a.scientificROI);
            
            runtime.logEvent(\`[Prioritizer] ✅ Ranked \${ranked.length} hypotheses by Scientific ROI.\`);
            return { success: true, rankedHypotheses: ranked };
        `
    },
    {
        name: 'Rank Synergies by Promise',
        description: 'Ranks a list of identified synergies based on their pre-calculated "Trial Priority Score" to identify the most promising combinations for investment.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To efficiently prioritize the most valuable synergistic combinations from a large pool of candidates, enabling focused proposal generation.',
        parameters: [
            { name: 'synergies', type: 'array', description: 'The full array of synergy objects discovered during research, which must include a `trialPriorityScore`.', required: true },
            { name: 'topN', type: 'number', description: 'The number of top-ranked synergies to return.', required: true },
        ],
        implementationCode: `
            const { synergies, topN } = args;
            if (!synergies || synergies.length === 0) {
                return { success: true, rankedSynergies: [] };
            }

            // Sort the synergies array in place, in descending order of trialPriorityScore
            const sortedSynergies = [...synergies].sort((a, b) => {
                const scoreA = a.trialPriorityScore || 0;
                const scoreB = b.trialPriorityScore || 0;
                return scoreB - scoreA;
            });

            const rankedSynergies = sortedSynergies.slice(0, topN);

            runtime.logEvent(\`[Ranking] ✅ Successfully ranked \${synergies.length} synergies by score. Top contender: \${rankedSynergies[0]?.combination.map(c=>c.name).join(' + ')} (Score: \${rankedSynergies[0]?.trialPriorityScore})\`);
            
            return { success: true, rankedSynergies };
        `
    },
];