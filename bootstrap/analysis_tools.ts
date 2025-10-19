
import type { ToolCreatorPayload } from '../types';

export const ANALYSIS_TOOLS: ToolCreatorPayload[] = [
    {
        name: 'ExtractKnownAndHypotheticalSynergies',
        description: 'Analyzes a scientific article to extract KNOWN synergies mentioned in the text and generate HYPOTHETICAL synergies based on unstated combinations of interventions. Returns a structured list of these potential synergies.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To separate the complex AI-based extraction of synergies from their subsequent scoring and recording, making the workflow more modular and robust.',
        parameters: [
            { name: 'sourceToAnalyze', type: 'object', description: 'The single validated source object to be analyzed.', required: true },
            { name: 'researchObjective', type: 'string', description: 'The original research objective to focus the analysis.', required: true },
        ],
        implementationCode: `
        const { sourceToAnalyze: source, researchObjective } = args;
        const sourceContext = \`<SOURCE>\\n<TITLE>\${source.title}</TITLE>\\n<RELIABILITY>\${source.reliabilityScore}</RELIABILITY>\\n<SUMMARY>\${source.summary}</SUMMARY>\\n</SOURCE>\`;

        const systemInstruction = \`You are an expert bioinformatics researcher. Your task is to analyze a scientific article to extract both KNOWN and HYPOTHETICAL synergies.

**Analysis Steps:**
1.  **Extract KNOWN Synergies:** Identify every combination of two or more interventions that are explicitly discussed as being used together in the article.
2.  **Generate HYPOTHETICAL Synergies:** List all individual interventions mentioned. Then, identify "knowledge gaps" by finding pairs or triplets that are NOT explicitly discussed as a combination. For each promising unstated combination, formulate a novel hypothesis.

**Response Format:**
- You MUST respond with ONLY a single, valid JSON object.
- The JSON object must contain a single key "synergies", which is an array of synergy objects.
- A "combination" MUST consist of two or more interventions. Never output a combination with only one item.
- Each synergy object must have the following structure:
{
  "combination": [{"name": "Intervention A", "type": "drug"}, {"name": "Intervention B", "type": "behavior"}],
  "status": "Known" or "Hypothesized (De Novo)",
  "synergyType": "Synergistic", "Additive", or "Antagonistic",
  "summary": "For KNOWN, summarize the finding from the paper. For HYPOTHETICAL, provide a plausible scientific rationale.",
  "potentialRisks": "Describe potential risks of the combination."
}
- Do not add any text, explanations, or markdown formatting before or after the JSON object.\`;

        const prompt = \`Based on the research objective "\${researchObjective}" and the following source, identify all potential synergies (both known and hypothetical) and return them as a JSON object.\\n\\nSOURCE TO ANALYZE:\\n\${sourceContext}\`;

        const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
        try {
            const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
            if (!jsonMatch) throw new Error("AI did not return a valid JSON object. Raw response: " + aiResponseText);
            const parsedResult = JSON.parse(jsonMatch[0]);

            if (!parsedResult.synergies || !Array.isArray(parsedResult.synergies)) {
                 throw new Error("AI response did not contain a 'synergies' array.");
            }
            
            // Filter out malformed single-item "synergies" from the AI output.
            const validSynergies = parsedResult.synergies.filter(s => s.combination && Array.isArray(s.combination) && s.combination.length >= 2);
            const removedCount = parsedResult.synergies.length - validSynergies.length;
            if (removedCount > 0) {
                runtime.logEvent(\`[Synergy Extractor] ⚠️ Filtered out \${removedCount} malformed single-item combinations from AI output.\`);
            }

            runtime.logEvent(\`[Synergy Extractor] ✅ Extracted \${validSynergies.length} potential synergies from source.\`);
            return { success: true, synergies: validSynergies };
        } catch(e) {
            runtime.logEvent(\`[Synergy Extractor] ❌ Error parsing synergies from AI: \${e.message}\`);
            throw new Error('Failed to parse synergies from AI: ' + e.message + ' Raw response: ' + aiResponseText);
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
        name: 'Assess Organ-Specific Aging Impact',
        description: "Analyzes a synergy's mechanism of action to predict its potential impact on organ-specific epigenetic clocks (e.g., brain, liver, blood, skin).",
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: "To move beyond a general 'biological age' and provide targeted predictions about which tissues a longevity intervention will rejuvenate, making hypotheses more specific and testable.",
        parameters: [
            { name: 'synergySummary', type: 'string', description: "The scientific rationale or abstract for the synergistic intervention.", "required": true }
        ],
        implementationCode: `
            const { synergySummary } = args;
            const systemInstruction = \`You are an expert in geroscience and epigenetic clocks. Based on the scientific mechanism of a therapy, predict its likely impact on the biological age of specific organs.
    Impact values can be: 'High Positive', 'Moderate Positive', 'Low Positive', 'Negligible', 'Low Negative', 'Moderate Negative', 'High Negative'.
    You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
    {
      "brain_impact": "High Positive",
      "liver_impact": "Moderate Positive",
      "blood_impact": "Low Positive",
      "skin_impact": "Negligible",
      "justification": "The intervention targets neuro-inflammation, strongly affecting brain clocks. Its systemic metabolic effects give it a moderate impact on the liver."
    }\`;
            const prompt = \`Therapy Rationale: "\${synergySummary}"\\n\\nBased on this, evaluate the impact on brain, liver, blood, and skin aging.\`;
            
            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("No valid JSON response from AI. Raw response: " + aiResponseText);
                const parsedResult = JSON.parse(jsonMatch[0]);
                runtime.logEvent(\`[Organ Impact] Assessed organ-specific impact.\`);
                return { success: true, organImpacts: parsedResult };
            } catch(e) {
                throw new Error('Failed to parse organ impact from AI: ' + e.message + ' Raw response: ' + aiResponseText);
            }
        `
    },
    {
        name: "Deconstruct Hypothesis to Experiment Plan",
        description: "Takes a scientific hypothesis and breaks it down into a concrete, step-by-step in vitro experiment plan, listing the necessary assays and measurements.",
        category: "Functional",
        executionEnvironment: "Client",
        purpose: "To translate an abstract idea into a tangible list of scientific tasks required for its initial validation.",
        parameters: [
            { name: "hypotheticalAbstract", type: "string", description: "The abstract of the hypothesis to be tested.", required: true }
        ],
        implementationCode: `
            const { hypotheticalAbstract } = args;
            const systemInstruction = \`You are a principal investigator designing a pilot experiment. Based on the hypothesis in the abstract, define the simplest possible in vitro experiment to get a 'go/no-go' signal.
You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
{
  "cell_model": "Human primary fibroblasts (HDFs)",
  "interventions": ["Compound X (10uM)", "Compound Y (5uM)", "Combination (X+Y)"],
  "key_measurements": [
    "Cell Viability Assay (MTT)",
    "Senescence Staining (SA-β-gal)",
    "qPCR for SIRT1 and p53 genes",
    "Mitochondrial Respiration Assay (Seahorse)"
  ],
  "justification": "This plan directly tests the hypothesis's claims about senescence and metabolism in a standard human cell model."
}\`;
            const prompt = \`Hypothesis: "\${hypotheticalAbstract}"\\n\\nDesign the experimental plan as a JSON object.\`;
    
            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("No valid JSON response from AI for experiment plan. Raw response: " + aiResponseText);
                const parsedResult = JSON.parse(jsonMatch[0]);
                runtime.logEvent('[Experiment Planner] ✅ Deconstructed hypothesis into concrete plan.');
                return { success: true, experimentPlan: parsedResult };
            } catch(e) {
                throw new Error('Failed to parse experiment plan from AI: ' + e.message + ' Raw response: ' + aiResponseText);
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
                            // If not found online, use default
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
        name: "Virtual Cell Validator",
        description: "For a given synergistic intervention, this tool simulates a molecular-level analysis, as if using a 'Virtual Cell'. It generates a detailed, step-by-step mechanistic explanation of how the synergy achieves its effect, referencing specific genes, proteins, and pathways.",
        category: "Functional",
        executionEnvironment: "Client",
        purpose: "To bridge the gap between high-level functional outcomes (e.g., 'reduced inflammation') and the underlying molecular biology, adding deep scientific validation to each generated hypothesis.",
        parameters: [
            { name: "synergyCombination", type: "array", description: "The array of intervention names (e.g., ['Rapamycin', 'Metformin']).", required: true },
            { name: "observedEffect", type: "string", description: "The high-level observed or hypothesized effect (e.g., 'Enhanced autophagy and reduced cellular senescence').", required: true }
        ],
        implementationCode: `
            const { synergyCombination, observedEffect } = args;

            const systemInstruction = \`You are a senior computational biologist with access to a perfect 'Virtual Cell' simulator. Your task is to explain HOW a given drug combination causes a specific biological effect at the molecular level.
- Be specific. Name the key proteins, genes, and signaling pathways involved.
- Describe the step-by-step chain of events.
- Your explanation must be plausible and grounded in known biological principles.
You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
{
  "mechanistic_explanation": "1. Drug A enters the cell and inhibits protein X (e.g., mTORC1). \\\\n2. This inhibition leads to the dephosphorylation of protein Y (e.g., ULK1). \\\\n3. Simultaneously, Drug B activates enzyme Z (e.g., AMPK), which also phosphorylates ULK1 at a different site. \\\\n4. This dual-action on ULK1 hyper-activates the autophagy initiation complex, leading to a synergistic increase in autophagosome formation and enhanced clearance of senescent mitochondria."
}\`;

            const prompt = \`Combination: \${synergyCombination.join(' + ')}\\nObserved Effect: \${observedEffect}\\n\\nProvide the detailed, step-by-step molecular explanation for this synergistic effect.\`;

            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("Virtual Cell Validator AI did not return a valid JSON object. Raw response: " + aiResponseText);
                const parsed = JSON.parse(jsonMatch[0]);
                
                runtime.logEvent(\`[Virtual Cell] ✅ Mechanistic explanation generated for \${synergyCombination.join(' + ')}.\`);
                return { success: true, explanation: parsed.mechanistic_explanation };

            } catch (e) {
                throw new Error(\`Failed to generate mechanistic explanation: \${e.message}\`);
            }
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
        name: 'Embed All Sources',
        description: 'Takes a list of validated scientific sources and generates a vector embedding for the content of each one.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To create a vectorized representation of the entire research corpus, which is the foundation for semantic mapping and analysis.',
        parameters: [
            { name: 'sources', type: 'array', description: 'An array of validated source objects, which must include a `title` and `summary`.', required: true },
        ],
        implementationCode: `
const { sources } = args;
if (!sources || sources.length === 0) {
    return { success: true, embeddedSources: [] };
}

runtime.logEvent(\`[Embedder] Generating embeddings for \${sources.length} sources in batches...\`);

const batchSize = 10; // Process in smaller chunks to avoid GPU memory limits
const embeddedSources = [];

for (let i = 0; i < sources.length; i += batchSize) {
    const batchSources = sources.slice(i, i + batchSize);
    const textsToEmbed = batchSources.map(source => \`\${source.title}: \${source.summary}\`);
    
    runtime.logEvent(\`[Embedder] ...processing batch \${Math.floor(i/batchSize) + 1} (\${batchSources.length} sources)\`);
    
    const batchEmbeddings = await runtime.ai.generateEmbeddings(textsToEmbed);
    
    const newEmbeddedSources = batchSources.map((source, index) => ({
        ...source,
        embedding: batchEmbeddings[index],
    }));
    
    embeddedSources.push(...newEmbeddedSources);
}

runtime.logEvent(\`[Embedder] ✅ Successfully embedded \${embeddedSources.length} sources.\`);
return { success: true, embeddedSources };
`
    },
    {
        name: 'Generate 2D Map Coordinates',
        description: 'Reduces the dimensionality of high-dimensional source embeddings to 2D coordinates (x, y) using Principal Component Analysis (PCA).',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To project the semantic relationships from a high-dimensional vector space onto a 2D map for visualization, making the distance between points meaningful.',
        parameters: [
            { name: 'embeddedSources', type: 'array', description: 'An array of source objects, each of which must have an `embedding` field.', required: true },
        ],
        implementationCode: `
    const { embeddedSources } = args;
    if (!embeddedSources || embeddedSources.length < 3 || !embeddedSources[0].embedding) {
        runtime.logEvent('[Mapper] Not enough embedded sources to generate a map (requires at least 3).');
        return { success: true, mapData: [] };
    }

    // Dynamically import ml-pca
    const { PCA } = await import('https://esm.sh/ml-pca');

    const vectors = embeddedSources.map(source => source.embedding);

    const pca = new PCA(vectors);
    const coordinates = pca.predict(vectors, { nComponents: 2 }).to2DArray();
    
    // Add a check to ensure coordinates were computed correctly.
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== vectors.length || (coordinates.length > 0 && coordinates[0].length !== 2)) {
        runtime.logEvent('[Mapper] ❌ PCA computation failed to return valid 2D coordinates.');
        console.error('PCA result was invalid:', coordinates);
        throw new Error("PCA computation failed to return valid 2D coordinates.");
    }
    
    // Find min/max for normalization
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const coord of coordinates) {
        if (coord[0] < minX) minX = coord[0];
        if (coord[0] > maxX) maxX = coord[0];
        if (coord[1] < minY) minY = coord[1];
        if (coord[1] > maxY) maxY = coord[1];
    }

    const mapSize = 500; // The target size of the map canvas
    const padding = mapSize * 0.05; // 5% padding

    const mapData = embeddedSources.map((source, index) => {
        const [x, y] = coordinates[index];
        
        // Normalize and scale coordinates to fit the map
        const normalizedX = (x - minX) / (maxX - minX || 1);
        const normalizedY = (y - minY) / (maxY - minY || 1);
        
        return {
            source: source, // Keep the full source object including embedding
            x: normalizedX * (mapSize - 2 * padding) + padding,
            y: normalizedY * (mapSize - 2 * padding) + padding,
        };
    });
    
    runtime.logEvent(\`[Mapper] ✅ Generated 2D coordinates for \${mapData.length} sources.\`);
    return { success: true, mapData };
`
    },
    {
        name: 'Chunk and Embed Scientific Articles',
        description: 'Processes the full text of validated scientific articles, breaking them into smaller, semantically meaningful chunks and converting each chunk into a vector embedding. This creates a "Semantic Knowledge Space" for conceptual search.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To transform a corpus of text documents into a machine-readable vector database, enabling similarity searches based on meaning rather than keywords.',
        parameters: [
            { name: 'validatedSources', type: 'array', description: 'An array of validated source objects, which must include a `textContent` field.', required: true },
        ],
        implementationCode: `
    const { validatedSources } = args;
    if (!validatedSources || validatedSources.length === 0) {
        return { success: true, vectorDB: [] };
    }

    const allChunks = [];
    const minChunkSize = 200; // characters
    const maxChunkSize = 800; // characters

    for (const source of validatedSources) {
        if (!source.textContent) continue;

        const paragraphs = source.textContent.split(/\\n\\s*\\n/);
        for (const para of paragraphs) {
            if (para.length < minChunkSize) continue;
            
            // If paragraph is too long, split it into sentences
            if (para.length > maxChunkSize) {
                const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
                let currentChunk = '';
                for (const sentence of sentences) {
                    if (currentChunk.length + sentence.length > maxChunkSize) {
                        allChunks.push({ text: currentChunk.trim(), sourceUri: source.url });
                        currentChunk = '';
                    }
                    currentChunk += sentence + ' ';
                }
                if (currentChunk.trim().length > minChunkSize) {
                    allChunks.push({ text: currentChunk.trim(), sourceUri: source.url });
                }
            } else {
                allChunks.push({ text: para.trim(), sourceUri: source.url });
            }
        }
    }

    if (allChunks.length === 0) {
        runtime.logEvent('[Embedder] No suitable text chunks found in sources for embedding.');
        return { success: true, vectorDB: [] };
    }
    
    runtime.logEvent(\`[Embedder] Created \${allChunks.length} text chunks. Now generating embeddings in batches...\`);

    const batchSize = 100; // Process in smaller chunks to avoid GPU memory limits
    const vectorDB = [];

    for (let i = 0; i < allChunks.length; i += batchSize) {
        const batchChunks = allChunks.slice(i, i + batchSize);
        const chunkTexts = batchChunks.map(c => c.text);
        
        runtime.logEvent(\`[Embedder] ...processing batch \${Math.floor(i/batchSize) + 1} of \${Math.ceil(allChunks.length / batchSize)} (\${batchChunks.length} chunks)\`);
        
        const batchEmbeddings = await runtime.ai.generateEmbeddings(chunkTexts);
        
        const newEmbeddedEntries = batchChunks.map((chunk, index) => ({
            ...chunk,
            embedding: batchEmbeddings[index],
        }));
        
        vectorDB.push(...newEmbeddedEntries);
    }

    runtime.logEvent(\`[Embedder] ✅ Successfully created vector database with \${vectorDB.length} entries.\`);
    return { success: true, vectorDB };
    `
    },
    {
        name: 'Hypothesis Generator via Conceptual Search',
        description: 'Performs a semantic search over a vector database of scientific text to find text chunks related to a conceptual query. It then uses an AI to synthesize a novel, de novo hypothesis from these disparate chunks and records it.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To generate completely new scientific hypotheses by finding non-obvious connections between pieces of information that may not be co-located in any single document.',
        parameters: [
            { name: 'conceptualQuery', type: 'string', description: 'The high-level conceptual question to investigate (e.g., "Find interventions that boost autophagy without affecting mTOR").', required: true },
            { name: 'vectorDB', type: 'array', description: 'The vector database created by the "Chunk and Embed" tool.', required: true },
        ],
        implementationCode: `
    const { conceptualQuery, vectorDB } = args;

    if (!vectorDB || vectorDB.length === 0) {
        throw new Error("Vector database is empty or not provided.");
    }

    const cosineSimilarity = (vecA, vecB) => {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
        let dotProduct = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
        }
        return dotProduct;
    };

    runtime.logEvent(\`[Hypothesizer] Searching for concepts related to: "\${conceptualQuery}"\`);
    const [queryEmbedding] = await runtime.ai.generateEmbeddings([conceptualQuery]);

    const scoredChunks = vectorDB.map(chunk => ({
        ...chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
    })).sort((a, b) => b.score - a.score);

    const topK = 10;
    const similarityThreshold = 0.5;
    const relevantChunks = scoredChunks.filter(c => c.score > similarityThreshold).slice(0, topK);

    if (relevantChunks.length < 3) {
        runtime.logEvent(\`[Hypothesizer] Found only \${relevantChunks.length} relevant chunks. Not enough to form a strong hypothesis. Skipping.\`);
        return { success: true, synergy: null };
    }
    
    runtime.logEvent(\`[Hypothesizer] Found \${relevantChunks.length} relevant text chunks. Synthesizing hypothesis...\`);

    const contextForSynthesis = relevantChunks.map((c, i) => \`EVIDENCE \${i+1} (Source: \${c.sourceUri}, Similarity: \${c.score.toFixed(3)}):\\n"\${c.text}"\`).join('\\n\\n');

    const systemInstruction = \`You are an expert bioinformatics researcher with a talent for synthesizing novel hypotheses from disparate data.
Your task is to analyze the provided text fragments from multiple scientific papers and formulate a NEW synergistic therapeutic hypothesis that addresses the user's conceptual query.
You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
{
  "combination": [{"name": "Compound A", "type": "drug"}, {"name": "Lifestyle B", "type": "behavior"}],
  "summary": "The novel hypothesis is that combining Compound A, which targets pathway X, with Lifestyle B, which enhances process Y, will synergistically reduce Z.",
  "potentialRisks": "Potential risks include off-target effects of Compound A and adherence issues with Lifestyle B."
}\`;
    
    const prompt = \`Conceptual Query: "\${conceptualQuery}"\\n\\nRelevant Evidence from Literature:\\n\${contextForSynthesis}\`;
    
    const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
    const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
    if (!jsonMatch) throw new Error("Hypothesis synthesis AI did not return a valid JSON object. Raw: " + aiResponseText);
    const hypothesisData = JSON.parse(jsonMatch[0]);

    if (!hypothesisData.combination || !hypothesisData.summary || !Array.isArray(hypothesisData.combination) || hypothesisData.combination.length === 0) {
        throw new Error("Generated hypothesis is missing required 'combination' or 'summary' fields.");
    }

    // The RecordSynergy tool will log the data. We return its result.
    const result = await runtime.tools.run('RecordSynergy', {
        ...hypothesisData,
        status: "Hypothesized (De Novo)",
        synergyType: "Synergistic",
    });
    
    runtime.logEvent(\`[Hypothesizer] ✅ Successfully generated and recorded new de novo hypothesis.\`);
    return result;
    `
    },
    {
        name: 'Identify Meta-Analyses',
        description: 'Analyzes a list of validated scientific sources to classify them as either meta-analyses/reviews or primary studies by calling the appropriate recording tool for each source.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To identify high-level summary articles (meta-analyses, systematic reviews) which can serve as a foundation for further "cutting-edge" research by classifying each source individually via tool calls.',
        parameters: [
            { name: 'validatedSources', type: 'array', description: 'The array of validated source objects to classify.', required: true },
        ],
        implementationCode: `
        const { validatedSources } = args;
        if (!validatedSources || validatedSources.length === 0) {
            return { success: true, metaAnalyses: [], primaryStudies: [] };
        }

        runtime.logEvent(\`[Classifier] Starting classification for \${validatedSources.length} sources one-by-one...\`);
        const metaAnalyses = [];
        const primaryStudies = [];
        const failedSources = [];

        const recordMetaTool = runtime.tools.list().find(t => t.name === 'RecordMetaAnalysis');
        const recordPrimaryTool = runtime.tools.list().find(t => t.name === 'RecordPrimaryStudy');
        if (!recordMetaTool || !recordPrimaryTool) throw new Error("Core classification recorder tools not found.");

        const systemInstruction = \`You are a binary classification expert. Your task is to classify a scientific article as either a "Meta-Analysis/Review" or a "Primary Study".
- "Meta-Analysis/Review" summarizes existing research (e.g., titles with "review", "meta-analysis", "systematic review").
- "Primary Study" presents new data from a specific experiment.
- You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
{ "classification": "Meta-Analysis/Review" } OR { "classification": "Primary Study" }\`;

        for (const source of validatedSources) {
            try {
                const sourceContext = \`<SOURCE>\\n<TITLE>\${source.title}</TITLE>\\n<SUMMARY>\${source.summary}</SUMMARY>\\n</SOURCE>\`;
                const prompt = \`Classify the following article:\\n\\n\${sourceContext}\`;
                
                const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("No JSON object found in response. Raw response: " + aiResponseText);
                
                const parsed = JSON.parse(jsonMatch[0]);
                const classification = parsed.classification;

                if (classification === 'Meta-Analysis/Review') {
                    const result = await runtime.tools.run('RecordMetaAnalysis', { source });
                    metaAnalyses.push(result.metaAnalysis);
                } else if (classification === 'Primary Study') {
                    const result = await runtime.tools.run('RecordPrimaryStudy', { source });
                    primaryStudies.push(result.primaryStudy);
                } else {
                    throw new Error(\`Unexpected classification value: \${classification}\`);
                }
            } catch (e) {
                runtime.logEvent(\`[Classifier] ⚠️ Error classifying source "\${source.title.substring(0, 40)}...": \${e.message}. Defaulting to Primary Study.\`);
                // Fallback: Assume it's a primary study if classification fails
                const result = await runtime.tools.run('RecordPrimaryStudy', { source });
                primaryStudies.push(result.primaryStudy);
                failedSources.push(source);
            }
            await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
        }

        runtime.logEvent(\`[Classifier] ✅ Classified sources: \${metaAnalyses.length} meta-analyses, \${primaryStudies.length} primary studies. (\${failedSources.length} failed classification and defaulted).\`);
        return { success: true, metaAnalyses, primaryStudies };
    `
    },
    {
        name: 'Analyze Single Source for Synergies',
        description: 'Acts as a workflow to fully analyze a single scientific source. It first extracts all known and hypothetical synergies, then iterates through each one to score it, estimate its cost, and record the final, enriched result.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To perform focused, granular scientific analysis on one source at a time by orchestrating a sequence of specialized tools, enabling a streaming research workflow.',
        parameters: [
            { name: 'sourceToAnalyze', type: 'object', description: 'The single validated source object to be analyzed.', required: true },
            { name: 'researchObjective', type: 'string', description: 'The original research objective to focus the analysis.', required: true },
            { name: 'metaAnalyses', type: 'array', description: 'Optional array of sources identified as meta-analyses, to provide context.', required: false },
        ],
        implementationCode: `
        const { sourceToAnalyze: source, researchObjective, metaAnalyses = [] } = args;
        const foundSynergies = [];
        runtime.logEvent(\`[Synergy Workflow] Starting analysis for: \${source.title.substring(0,50)}...\`);

        try {
            // Step 1: Extract all potential synergies using the dedicated tool.
            const extractionResult = await runtime.tools.run('ExtractKnownAndHypotheticalSynergies', {
                sourceToAnalyze: source,
                researchObjective,
            });

            const potentialSynergies = extractionResult.synergies || [];

            if (potentialSynergies.length === 0) {
                runtime.logEvent(\`[Synergy Workflow] ⚪️ No synergies found in source: \${source.title.substring(0,50)}...\`);
                return { success: true, synergies: [] };
            }

            runtime.logEvent(\`[Synergy Workflow] Extracted \${potentialSynergies.length} synergies. Now scoring and recording each one...\`);
            const allSourcesForContext = [...metaAnalyses, source];

            // Step 2: Loop through each extracted synergy and enrich it with scores and costs.
            for (const synergyToScore of potentialSynergies) {
                try {
                    // Defensively check the combination structure
                    if (!Array.isArray(synergyToScore.combination) || synergyToScore.combination.length < 2 || synergyToScore.combination.some(c => !c.name || !c.type)) {
                        runtime.logEvent(\`[Synergy Workflow] ⚠️ Skipping malformed synergy from extractor: \${JSON.stringify(synergyToScore.combination)}\`);
                        continue;
                    }
                
                    // Step 2a: Get cost
                    const costResult = await runtime.tools.run('Estimate Synergy Validation Cost', { combination: synergyToScore.combination });
                    
                    // Step 2b: Get scientific scores
                    const scoringResult = await runtime.tools.run('Score Single Synergy', {
                        synergyToScore: synergyToScore,
                        backgroundSources: allSourcesForContext
                    });
                    
                    // Step 2c: Get organ impact
                    const organImpactResult = await runtime.tools.run('Assess Organ-Specific Aging Impact', { synergySummary: scoringResult.updatedSynergy.summary });
                    
                    // Step 2d: Assemble and record the final, enriched synergy object
                    if (scoringResult.updatedSynergy) {
                         const finalSynergyData = { 
                            ...scoringResult.updatedSynergy, 
                            organImpacts: organImpactResult.organImpacts,
                            sourceUri: source.url || source.uri, 
                            sourceTitle: source.title,
                            estimatedCost: costResult.estimatedCost,
                            costBreakdown: costResult.costBreakdown,
                        };
                        const executionResult = await runtime.tools.run('RecordSynergy', finalSynergyData);
                        if (executionResult.synergy) {
                            foundSynergies.push(executionResult.synergy);
                        }
                    }
                } catch (innerError) {
                    runtime.logEvent(\`[Synergy Workflow] ❌ Error processing a single synergy: \${innerError.message}\`);
                    // Continue to the next synergy
                }
            }

        } catch (e) {
             runtime.logEvent(\`[Synergy Workflow] ❌ CRITICAL ERROR during synergy analysis for \${source.title.substring(0,50)}...: \${e.message}\`);
             // Re-throwing so the main workflow can catch it.
             throw e;
        }
        
        runtime.logEvent(\`[Synergy Workflow] ✅ Finished analysis for source. Recorded \${foundSynergies.length} synergies.\`);
        return {
            success: true,
            synergies: foundSynergies,
        };
    `
    },
    {
        name: 'Score Single Synergy',
        description: 'Performs a multi-layered scoring analysis on a single synergistic combination, including Mechanism of Action (MoA) complementarity and alignment with biological aging theories, to calculate a final "Trial Priority Score".',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To provide a reusable, focused function for scoring or re-scoring a single synergy based on the latest available scientific context.',
        parameters: [
            { name: 'synergyToScore', type: 'object', description: 'The synergy object to be scored. Must contain at least a "combination" array and a "summary".', required: true },
            { name: 'backgroundSources', type: 'array', description: 'An array of all validated source objects to provide context for the scoring.', required: true },
        ],
        implementationCode: `
            const { synergyToScore, backgroundSources } = args;
            const getComboString = (combination) => {
                if (!Array.isArray(combination)) return 'Unknown Combination';
                if (typeof combination[0] === 'string') return combination.join(' + ');
                if (typeof combination[0] === 'object' && combination[0].name) return combination.map(c => c.name).join(' + ');
                return 'Unknown Combination';
            };
            const comboString = getComboString(synergyToScore.combination);
            runtime.logEvent(\`[Scoring] Starting detailed scoring for: \${comboString}\`);

            // --- Step 1: Get MoA Complementarity Score ---
            const moaScoringSystemInstruction = \`You are an expert pharmacologist. Analyze the provided synergy information and its scientific context. Score the Mechanism of Action (MoA) complementarity on a scale of 0-100.
            You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
            {
              "score": 85,
              "justification": "Component A targets the mTOR pathway, while Component B enhances autophagy via AMPK activation. This is highly complementary."
            }\`;
            
            const moaScoringPrompt = \`Analyze the following synergy and provide an MoA complementarity score based on the background literature.\\n\\nSynergy: \${JSON.stringify(synergyToScore)}\\n\\nBackground Summaries: \${JSON.stringify(backgroundSources.map(s => s.summary))}\`;
            
            let moaScore = 0;
            let moaJustification = 'N/A';
            
            try {
                const scoringResponseText = await runtime.ai.generateText(moaScoringPrompt, moaScoringSystemInstruction);
                const jsonMatch = scoringResponseText.match(/\\{[\\s\\S]*\\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    moaScore = parsed.score || 0;
                    moaJustification = parsed.justification || 'N/A';
                }
            } catch(e) {
                runtime.logEvent(\`[MoA Score] ⚠️ Could not determine MoA score for \${comboString}. Defaulting to 0. Error: \${e.message}\`);
            }

            // --- Step 2: Get Theory Alignment & Trial Priority Score ---
            const AGING_THEORIES_CONTEXT = \`
    - Stochastic Damage: Accumulating random molecular damage.
    - Programmed Hyperfunction: Harmful continuation of developmental programs.
    - Information Entropy: Loss of epigenetic information.
    - Cellular Society Collapse: Disruption by "bad actor" cells like senescent cells.
            \`;

            const theoryScoringSystemInstruction = \`You are an expert longevity scientist and VC. Analyze a therapeutic synergy to evaluate its clinical trial potential.
    Calculate a final "Trial Priority Score" based on all available data.
    You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
    {
      "trialPriorityScore": 88,
      "theoryAlignmentScores": { "stochastic": 90, "hyperfunction": 75, "information": 50, "social": 95 },
      "scoringJustification": "The combination strongly addresses stochastic damage and cellular society collapse..."
    }\`;

            const theoryScoringPrompt = \`Evaluate the following therapeutic synergy for clinical trial potential.
    AGING THEORIES CONTEXT: \${AGING_THEORIES_CONTEXT}
    SYNERGY TO EVALUATE: \${JSON.stringify(synergyToScore)}
    MoA Score Justification: \${moaJustification}
    BACKGROUND LITERATURE: \${JSON.stringify(backgroundSources.map(s => s.summary))}
    Based on all this information, provide the trial priority score and theory alignment scores as a JSON object.\`;

            let trialPriorityScore = 0;
            let theoryAlignmentScores = {};
            
            try {
                const theoryResponseText = await runtime.ai.generateText(theoryScoringPrompt, theoryScoringSystemInstruction);
                const jsonMatch = theoryResponseText.match(/\\{[\\s\\S]*\\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    trialPriorityScore = parsed.trialPriorityScore || 0;
                    theoryAlignmentScores = parsed.theoryAlignmentScores || {};
                }
            } catch (e) {
                runtime.logEvent(\`[Trial Score] ⚠️ Could not determine trial priority score for \${comboString}. Defaulting to 0. Error: \${e.message}\`);
            }
            
            const updatedSynergy = { 
                ...synergyToScore, 
                moaComplementarityScore: moaScore, 
                moaJustification: moaJustification,
                trialPriorityScore,
                theoryAlignmentScores
            };
            
            runtime.logEvent(\`[Scoring] ✅ Finished scoring for \${comboString}. Trial Priority: \${trialPriorityScore}, MoA: \${moaScore}.\`);
            
            return { success: true, updatedSynergy };
        `
    },
    {
        name: 'GenerateDossierNarrative',
        description: 'Generates the core narrative sections (Executive Summary, Scientific Rationale) for an investment dossier based on a synergy and background literature.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To break down dossier creation into a manageable, text-focused generation task for the AI, improving reliability.',
        parameters: [
            { name: 'synergy', type: 'object', description: 'The synergy object to generate a proposal for.', required: true },
            { name: 'backgroundSources', type: 'array', description: 'The full list of validated scientific sources to use as background context.', required: true },
        ],
        implementationCode: `
            const { synergy, backgroundSources } = args;
            const systemInstruction = \`You are a senior biotech investment analyst. Create the core narrative for an investment dossier.
You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
{
  "executiveSummary": "A high-level summary for investors.",
  "scientificRationale": "A detailed explanation of the biological mechanism and synergy, grounded in the provided literature."
}\`;
            const prompt = \`SYNERGY TO PROPOSE: \${JSON.stringify(synergy)}\\n\\nBACKGROUND LITERATURE: \${JSON.stringify(backgroundSources.map(s => s.summary))}\\n\\nGenerate the narrative sections.\`;

            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("Narrative generation AI did not return valid JSON. Raw response: " + aiResponseText);
                return JSON.parse(jsonMatch[0]);
            } catch (e) {
                throw new Error(\`Failed to parse narrative sections: \${e.message}\`);
            }
        `
    },
    {
        name: 'AnalyzeDossierRisks',
        description: 'Performs a structured risk analysis for a scientific proposal, generating scores and summaries for scientific, commercial, and safety risks.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To isolate the complex task of risk assessment into a single, focused AI call, improving reliability.',
        parameters: [
            { name: 'synergy', type: 'object', description: 'The synergy object being analyzed.', required: true },
            { name: 'scientificRationale', type: 'string', description: 'The generated scientific rationale for context.', required: true },
            { name: 'backgroundSources', type: 'array', description: 'The full list of validated scientific sources to use as background context.', required: true },
        ],
        implementationCode: `
            const { synergy, scientificRationale, backgroundSources } = args;
            const systemInstruction = \`You are a skeptical biotech risk analyst. Your task is to perform a structured risk analysis.
You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
{
  "riskAnalysis": {
    "scientificRisk": 30,
    "commercialRisk": 50,
    "safetyRisk": 60,
    "overallRiskScore": 45,
    "riskSummary": "Primary risk is potential for off-target effects of Compound A..."
  }
}\`;
            const prompt = \`PROPOSAL RATIONALE: \${scientificRationale}\\n\\nSYNERGY: \${JSON.stringify(synergy)}\\n\\nBACKGROUND: \${JSON.stringify(backgroundSources.map(s => s.summary))}\\n\\nGenerate the structured risk analysis.\`;

            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("Risk analysis AI did not return valid JSON. Raw response: " + aiResponseText);
                return JSON.parse(jsonMatch[0]);
            } catch (e) {
                throw new Error(\`Failed to parse risk analysis: \${e.message}\`);
            }
        `
    },
    {
        name: 'CreateMitigationPlanAndRoadmap',
        description: 'Generates a concrete mitigation plan, a cost estimate for that plan, and a high-level development roadmap based on identified risks and a scientific proposal.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To separate the "planning" and "costing" phase of dossier creation into a dedicated AI task.',
        parameters: [
            { name: 'riskSummary', type: 'string', description: 'The summary of the key risks to address.', required: true },
            { name: 'synergy', type: 'object', description: 'The synergy object being analyzed.', required: true },
        ],
        implementationCode: `
            const { riskSummary, synergy } = args;
            const systemInstruction = \`You are a biotech project manager. Based on the key risks, create a de-risking plan and roadmap.
You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
{
  "mitigationPlan": "Conduct 12-month mouse longevity study and advanced toxicology screens.",
  "estimatedCostUSD": 150000,
  "roadmap": "Phase 1: Preclinical toxicology (6 months). Phase 2: Mouse efficacy studies (12 months)."
}\`;
            const prompt = \`SYNERGY: \${JSON.stringify(synergy)}\\n\\nKEY RISKS: "\${riskSummary}"\\n\\nGenerate the mitigation plan, cost, and roadmap.\`;

            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("Mitigation plan AI did not return valid JSON. Raw response: " + aiResponseText);
                return JSON.parse(jsonMatch[0]);
            } catch (e) {
                throw new Error(\`Failed to parse mitigation plan: \${e.message}\`);
            }
        `
    },
    {
        name: 'GenerateMarketAnalysis',
        description: 'Generates an analysis of the market opportunity and potential intellectual property (IP) for a given synergistic intervention.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To handle the business and commercial analysis portion of the dossier in a separate, focused AI call.',
        parameters: [
            { name: 'synergy', type: 'object', description: 'The synergy object being analyzed.', required: true },
            { name: 'researchObjective', type: 'string', description: 'The overall research objective for market context.', required: true },
        ],
        implementationCode: `
            const { synergy, researchObjective } = args;
            const systemInstruction = \`You are a biotech market analyst. Analyze the market and IP landscape.
You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
{
  "marketAndIP": "The market for [\${researchObjective}] is estimated at $XB. While Compound A is off-patent, the combination therapy could be patentable via a new use-case or formulation patent..."
}\`;
            const prompt = \`RESEARCH OBJECTIVE: \${researchObjective}\\n\\nSYNERGY: \${JSON.stringify(synergy)}\\n\\nGenerate the Market & IP analysis.\`;

            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("Market analysis AI did not return valid JSON. Raw response: " + aiResponseText);
                return JSON.parse(jsonMatch[0]);
            } catch (e) {
                throw new Error(\`Failed to parse market analysis: \${e.message}\`);
            }
        `
    },
    {
        name: 'Generate Proposal for Single Synergy',
        description: 'Acts as a workflow orchestrator to generate a full, investment-ready trial dossier and a critical review by calling a sequence of specialized, granular tools.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To reliably encapsulate the complex, multi-step process of proposal generation and critique into a single, callable tool.',
        parameters: [
            { name: 'synergy', type: 'object', description: 'The synergy object to generate a proposal for. Must include combination, summary, etc.', required: true },
            { name: 'backgroundSources', type: 'array', description: 'The full list of validated scientific sources to use as background context for the proposal.', required: true },
        ],
        implementationCode: `
        const { synergy, backgroundSources } = args;
        const comboString = synergy.combination.map(c => c.name).join(' + ');
        runtime.logEvent(\`[Dossier Workflow] Starting dossier assembly for: \${comboString}\`);

        try {
            // Step 1: Generate core narrative
            runtime.logEvent(\`[Dossier Workflow] ...step 1: generating narrative.\`);
            const narrativeResult = await runtime.tools.run('GenerateDossierNarrative', { synergy, backgroundSources });

            // Step 2: Generate risk analysis
            runtime.logEvent(\`[Dossier Workflow] ...step 2: analyzing risks.\`);
            const riskResult = await runtime.tools.run('AnalyzeDossierRisks', {
                synergy,
                scientificRationale: narrativeResult.scientificRationale,
                backgroundSources,
            });

            // Step 3: Generate mitigation plan & roadmap
            runtime.logEvent(\`[Dossier Workflow] ...step 3: creating mitigation plan.\`);
            const mitigationResult = await runtime.tools.run('CreateMitigationPlanAndRoadmap', {
                riskSummary: riskResult.riskAnalysis.riskSummary,
                synergy,
            });

            // Step 4: Generate market analysis
            runtime.logEvent(\`[Dossier Workflow] ...step 4: generating market analysis.\`);
            const { taskPrompt } = runtime.getState(); // Get current research objective from state
            const marketResult = await runtime.tools.run('GenerateMarketAnalysis', {
                synergy,
                researchObjective: taskPrompt,
            });

            // Step 5: Validate molecular mechanism
            runtime.logEvent(\`[Dossier Workflow] ...step 5: validating molecular mechanism.\`);
            const validationResult = await runtime.tools.run('Virtual Cell Validator', {
                synergyCombination: synergy.combination.map(c => c.name),
                observedEffect: synergy.summary,
            });

            // Final Step: Assemble and record the dossier
            runtime.logEvent(\`[Dossier Workflow] ...final step: assembling and recording dossier.\`);
            const finalDossierData = {
                combination: synergy.combination,
                executiveSummary: narrativeResult.executiveSummary,
                scientificRationale: narrativeResult.scientificRationale,
                inSilicoValidation: "Predicted via Organoid Odyssey simulation. Further in vitro validation required.", // This can be a standard string
                marketAndIP: marketResult.marketAndIP,
                roadmap: mitigationResult.roadmap,
                riskAnalysis: riskResult.riskAnalysis,
                mitigationPlan: mitigationResult.mitigationPlan,
                estimatedCostUSD: mitigationResult.estimatedCostUSD,
                molecularMechanism: validationResult.explanation,
            };

            const recordResult = await runtime.tools.run('RecordTrialDossier', finalDossierData);
            const generatedDossier = recordResult.dossier;

            runtime.logEvent(\`[Dossier Workflow] ✅ Dossier for \${comboString} assembled and recorded.\`);
            
            // Post-generation critique
            runtime.logEvent(\`[Dossier Workflow] ...subjecting dossier to critical review.\`);
            const critiqueResult = await runtime.tools.run('Critique Investment Proposal', { dossier: generatedDossier });

            // The RecordTrialDossier tool will have already added the dossier to the feed.
            // We can optionally add the critique to the generated dossier object.
             if (generatedDossier && critiqueResult.critique) {
                generatedDossier.critique = critiqueResult.critique;
            }

            return { success: true, dossier: generatedDossier, critique: critiqueResult.critique };

        } catch (e) {
            runtime.logEvent(\`[Dossier Workflow] ❌ FAILED to assemble dossier for \${comboString}. Error: \${e.message}\`);
            throw new Error(\`Dossier assembly workflow failed: \${e.message}\`);
        }
    `
    },
    {
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
        const comboString = dossier.combination.map(c => c.name).join(' + ');
        runtime.logEvent('[Critique] Starting critical analysis for: ' + comboString);

        const queries = [
            comboString + ' risks side effects contraindications',
            '"' + comboString + '" failed trial',
            'problems with combining ' + dossier.combination.map(c => c.name).join(' and '),
            'evidence against ' + dossier.scientificRationale.substring(0, 150)
        ];
        
        runtime.logEvent('[Critique] Searching for counter-evidence...');
        const searchResult = await runtime.tools.run('Federated Scientific Search', { query: queries.join('; '), maxResultsPerSource: 3 });
        const searchResults = searchResult.searchResults || [];

        let context = 'CRITIQUE THE FOLLOWING INVESTMENT PROPOSAL:\\n' + JSON.stringify(dossier, null, 2);
        if (searchResults.length > 0) {
            const searchContext = searchResults.map(r => '<EVIDENCE>\\n<TITLE>' + r.title + '</TITLE>\\n<SNIPPET>' + r.snippet + '</SNIPPET>\\n<URL>' + r.link + '</URL>\\n</EVIDENCE>').join('\\n\\n');
            context += '\\n\\nPOTENTIAL CONTRADICTORY EVIDENCE FOUND:\\n' + searchContext;
        } else {
            context += '\\n\\nNo direct contradictory evidence was found in a preliminary search.';
        }

        const systemInstruction = \`You are a highly skeptical and meticulous scientific peer reviewer. Your job is to find flaws in investment proposals.
- Analyze the provided dossier and any search evidence.
- Your tone should be critical, professional, and evidence-based. Be concise.
- Focus on: 1) Understated risks. 2) Weaknesses in the scientific rationale. 3) Contradictory evidence. 4) Feasibility.
- You MUST respond with ONLY a single, valid JSON object. Do not add any text, explanations, or markdown formatting before or after the JSON object. The format must be:
{
  "strengths": "A summary of the proposal's strong points.",
  "weaknesses": "A summary of the proposal's weaknesses and understated risks.",
  "contradictoryEvidence": ["A list of strings, where each string is a piece of evidence that contradicts the proposal."],
  "overallVerdict": "One of: 'Sound', 'Needs Revision', or 'High Risk'."
}\`;

        let critiqueData;
        let lastError = null;
        let lastRawResponse = '';
        const maxRetries = 2;

        for (let i = 0; i < maxRetries; i++) {
            try {
                let currentPrompt = context;
                if (i > 0 && lastError) {
                    currentPrompt = \`Your previous attempt to generate a critique failed.
        ERROR: \${lastError.message}
        PREVIOUS (INVALID) RESPONSE:
        \${lastRawResponse}

        Please correct your output and provide ONLY a single, valid JSON object that strictly adheres to the requested format.

        ORIGINAL REQUEST:
        \${context}\`;
                }

                runtime.logEvent(\`[Critique] Generating critique for \${comboString} (Attempt \${i + 1}/\${maxRetries})...\`);
                const aiResponseText = await runtime.ai.generateText(currentPrompt, systemInstruction);
                lastRawResponse = aiResponseText;

                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) {
                    throw new Error("AI did not return a valid JSON object.");
                }
                
                const parsedJson = JSON.parse(jsonMatch[0]);

                const strengths = parsedJson.strengths;
                const weaknesses = parsedJson.weaknesses;
                const contradictoryEvidence = parsedJson.contradictoryEvidence || parsedJson.contradictions || [];
                const overallVerdict = parsedJson.overallVerdict;

                if (!strengths || !weaknesses || !overallVerdict) {
                    throw new Error("Parsed JSON is missing one or more required fields: 'strengths', 'weaknesses', 'overallVerdict'.");
                }
                
                critiqueData = { strengths, weaknesses, contradictoryEvidence, overallVerdict };
                lastError = null;
                break; 
            } catch (e) {
                lastError = e;
                runtime.logEvent(\`[Critique] ⚠️ Attempt \${i + 1} failed: \${e.message}\`);
            }
        }

        if (lastError) {
            runtime.logEvent(\`[Critique] ❌ Error parsing JSON from critique AI after \${maxRetries} attempts. Generating a fallback critique. Final error: \${lastError.message}\`);
            critiqueData = {
                strengths: "Critique generation failed.",
                weaknesses: \`The AI model failed to return a valid structured critique after \${maxRetries} attempts. This may indicate a model limitation or a persistent error. Final error: \${lastError.message}\`,
                contradictoryEvidence: [],
                overallVerdict: "Needs Revision"
            };
        }

        const fullCritiqueArgs = { ...critiqueData, combination: dossier.combination };
        const critiqueResult = await runtime.tools.run('RecordCritique', fullCritiqueArgs);

        return { success: true, message: 'Critique generated for ' + comboString, critique: critiqueResult.critique };
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