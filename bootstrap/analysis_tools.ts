import type { ToolCreatorPayload } from '../types';

export const ANALYSIS_TOOLS: ToolCreatorPayload[] = [
    {
        name: "FindMarketPriceForLabItem",
        description: "Searches a major lab supplier (e.g., Sigma-Aldrich) for a specific lab item (chemical, kit) and attempts to extract its price in USD using web scraping and AI analysis. This tool is designed to be updatable.",
        category: "Functional",
        executionEnvironment: "Client",
        purpose: "To dynamically fetch real-world cost data for scientific materials, enabling on-the-fly, evidence-based cost estimation. Its implementation can be updated by the 'UpdatePricingModel' workflow.",
        parameters: [
            { name: "itemName", type: "string", description: "The name of the chemical, kit, or material to search for.", required: true }
        ],
        implementationCode: `
            const { itemName } = args;
            runtime.logEvent(\`[Price Finder] Searching market price for: \${itemName}\`);
    
            try {
                // Stage 1: Search for the product page, starting with Sigma-Aldrich
                const searchResults = await runtime.search.web(\`"sigma aldrich" \${itemName} price\`, 1);
                if (!searchResults || searchResults.length === 0 || !searchResults[0].link.includes('sigmaaldrich.com')) {
                    runtime.logEvent(\`[Price Finder] Could not find a product page on Sigma-Aldrich for \${itemName}.\`);
                    return { price: null };
                }
    
                const productUrl = searchResults[0].link;
                runtime.logEvent(\`[Price Finder] Found potential product page: \${productUrl}\`);
    
                // Stage 2: "Read" the page
                const pageContentResult = await runtime.tools.run('Read Webpage Content', { url: productUrl });
                const pageContent = pageContentResult.textContent;
    
                if (!pageContent) {
                    throw new Error("Failed to read content from product page.");
                }
                
                // Stage 3: Ask the AI to extract the price from the text
                const systemInstruction = \`You are an expert data extraction bot. Your only task is to find the price in USD from the provided text of a product webpage. Look for patterns like "$123.45" or "Price: 123.45 USD". If there are multiple prices, pick the smallest one. Respond with ONLY a single JSON object: {"price": 123.45} or {"price": null} if not found.\`;
                const prompt = \`Extract the price in USD from this text:\\n\\n\${pageContent.substring(0, 15000)}\`;
    
                const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
    
                if (jsonMatch) {
                    const parsedResult = JSON.parse(jsonMatch[0]);
                    if (parsedResult && typeof parsedResult.price === 'number') {
                        runtime.logEvent(\`[Price Finder] ✅ Found price for \${itemName}: $\${parsedResult.price}\`);
                        return { price: parsedResult.price };
                    }
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
    Respond with ONLY a single, valid JSON object in the following format:
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
                if (!jsonMatch) throw new Error("No valid JSON response from AI.");
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
You MUST respond with ONLY a single, valid JSON object in the following format:
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
                if (!jsonMatch) throw new Error("No valid JSON response from AI for experiment plan.");
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
You MUST respond with ONLY a single, valid JSON object in the following format:
{
  "mechanistic_explanation": "1. Drug A enters the cell and inhibits protein X (e.g., mTORC1). \\\\n2. This inhibition leads to the dephosphorylation of protein Y (e.g., ULK1). \\\\n3. Simultaneously, Drug B activates enzyme Z (e.g., AMPK), which also phosphorylates ULK1 at a different site. \\\\n4. This dual-action on ULK1 hyper-activates the autophagy initiation complex, leading to a synergistic increase in autophagosome formation and enhanced clearance of senescent mitochondria."
}\`;

            const prompt = \`Combination: \${synergyCombination.join(' + ')}\\nObserved Effect: \${observedEffect}\\n\\nProvide the detailed, step-by-step molecular explanation for this synergistic effect.\`;

            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            try {
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("Virtual Cell Validator AI did not return a valid JSON object.");
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
    
    runtime.logEvent(\`[Embedder] Created \${allChunks.length} text chunks. Now generating embeddings...\`);

    // Batch embedding for efficiency
    const chunkTexts = allChunks.map(c => c.text);
    const embeddings = await runtime.ai.generateEmbeddings(chunkTexts);

    const vectorDB = allChunks.map((chunk, index) => ({
        ...chunk,
        embedding: embeddings[index],
    }));

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
Then, you MUST call the 'RecordSynergy' tool to record your finding.

**CRITICAL INSTRUCTIONS for the tool call:**
1.  **combination**: Propose a specific combination of interventions (drugs, behaviors, etc.).
2.  **status**: This MUST be set to "Hypothesized (De Novo)".
3.  **summary**: Clearly explain your novel hypothesis and the scientific rationale based on the provided evidence.
4.  **potentialRisks**: Extrapolate potential risks based on the mechanisms discussed in the evidence.

Your entire response MUST be a single 'RecordSynergy' tool call. Do not add any other text.\`;
    
    const prompt = \`Conceptual Query: "\${conceptualQuery}"\\n\\nRelevant Evidence from Literature:\\n\${contextForSynthesis}\`;
    
    const recordSynergyTool = runtime.tools.list().find(t => t.name === 'RecordSynergy');
    if (!recordSynergyTool) throw new Error("Core tool 'RecordSynergy' not found.");

    const aiResponse = await runtime.ai.processRequest(prompt, systemInstruction, [recordSynergyTool]);
    
    const toolCall = aiResponse?.toolCalls?.[0];
    if (!toolCall || toolCall.name !== 'RecordSynergy') {
        let errorMsg = "Hypothesis synthesis AI failed to call 'RecordSynergy' tool.";
        if (aiResponse && aiResponse.text) errorMsg += \` AI Response: \${aiResponse.text}\`;
        throw new Error(errorMsg);
    }
    
    // The RecordSynergy tool will log the data. We return its result.
    const result = await runtime.tools.run('RecordSynergy', toolCall.arguments);
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
- You MUST respond with ONLY a single, valid JSON object in the following format:
{ "classification": "Meta-Analysis/Review" } OR { "classification": "Primary Study" }
Do not add any other text or markdown.\`;

        for (const source of validatedSources) {
            try {
                const sourceContext = \`<SOURCE>\\n<TITLE>\${source.title}</TITLE>\\n<SUMMARY>\${source.summary}</SUMMARY>\\n</SOURCE>\`;
                const prompt = \`Classify the following article:\\n\\n\${sourceContext}\`;
                
                const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
                const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
                if (!jsonMatch) throw new Error("No JSON object found in response.");
                
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
        description: 'Analyzes a single validated scientific source to identify potential synergistic combinations. It then performs a multi-layered scoring analysis, including Mechanism of Action (MoA) complementarity and alignment with biological aging theories, to calculate a final "Trial Priority Score".',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To perform focused, granular scientific analysis on one source at a time, including multi-faceted scoring, enabling a streaming research workflow that prioritizes the most promising interventions.',
        parameters: [
            { name: 'sourceToAnalyze', type: 'object', description: 'The single validated source object to be analyzed.', required: true },
            { name: 'researchObjective', type: 'string', description: 'The original research objective to focus the analysis.', required: true },
            { name: 'metaAnalyses', type: 'array', description: 'Optional array of sources identified as meta-analyses, to provide context.', required: false },
        ],
        implementationCode: `
        const { sourceToAnalyze: source, researchObjective, metaAnalyses = [] } = args;
        if (!source || !source.title) {
            return { success: true, synergies: [] };
        }
        
        const foundSynergies = [];

        try {
            const sourceContext = \`<SOURCE>\\n<TITLE>\${source.title}</TITLE>\\n<RELIABILITY>\${source.reliabilityScore}</RELIABILITY>\\n<SUMMARY>\${source.summary}</SUMMARY>\\n</SOURCE>\`;

            let systemInstruction = \`You are an expert bioinformatics researcher tasked with **extracting any and all potential combinations of interventions** from a scientific article. Your goal is to maximize recall; subsequent steps will filter for quality.

**Intervention Categories:**
- **Drug**: Molecules, supplements, organic compounds.
- **Device**: Hardware, inorganic tools, mechanical/electronic devices.
- **Behavior**: Lifestyle changes, habits, diets, exercise.

**Your Task:**
Read the provided source and identify **every mention** of two or more interventions being used together, discussed in combination, or proposed as a combined therapy. Look for keywords like "combination", "co-administration", "adjunctive", "and", "with", "plus".

For **each distinct combination** you find, you MUST call the 'RecordSynergy' tool. You are expected to call this tool multiple times if multiple combinations are found. This is a core requirement.

**For each \\\`RecordSynergy\\\` tool call:**
1.  **Combination**: Identify the interventions by name AND type. This MUST be an array of objects. Example: \\\`[{"name": "Metformin", "type": "drug"}, {"name": "Exercise", "type": "behavior"}]\\\`.
2.  **Interaction Type**: Determine if the source describes the interaction as 'Synergistic' (effect is greater than sum of parts), 'Additive' (effects sum up), or 'Antagonistic' (effects cancel out). If the nature isn't specified, default to 'Additive'.
3.  **Status**: Determine if the source presents this as a 'Known' combination (already studied) or a 'Hypothesized' one (a proposal for future study). If unsure, default to 'Hypothesized'.
4.  **Rationale**: Provide a scientific rationale based *directly* on the text in the source.
5.  **Risks**: CRITICALLY ASSESS and clearly state any potential risks or contraindications mentioned in the source. If none are mentioned, state "None mentioned in source".

**CRITICAL RULES:**
1. If you find no combinations, do not call any tools and respond with an empty text message.
2. If you find one or more combinations, your entire response MUST consist of only tool calls. Do not add any text before, between, or after the tool calls. For example, if you find three combinations, your response must be three separate calls to the 'RecordSynergy' tool.\`;

            let analysisPrompt = 'Based on the research objective "' + researchObjective + '" and the following source, identify all potential synergies and call the \\'RecordSynergy\\' tool for each one.\\n\\n';
            if (metaAnalyses.length > 0) {
                analysisPrompt += 'FOUNDATIONAL META-ANALYSES (for context only):\\n' + JSON.stringify(metaAnalyses.map(s => s.summary)) + '\\n\\n';
            }
            analysisPrompt += 'SOURCE TO ANALYZE:\\n' + sourceContext;

            const recordSynergyTool = runtime.tools.list().find(t => t.name === 'RecordSynergy');
            if (!recordSynergyTool) throw new Error("Core tool 'RecordSynergy' not found.");

            const aiResponse = await runtime.ai.processRequest(analysisPrompt, systemInstruction, [recordSynergyTool]);

            if (aiResponse && aiResponse.toolCalls) {
                const allSourcesForContext = [...metaAnalyses, source];
                for (const toolCall of aiResponse.toolCalls) {
                    if (toolCall.name === 'RecordSynergy') {
                        const synergyData = toolCall.arguments;

                        let combination = synergyData.combination;
                        if (typeof combination === 'string') {
                            try { combination = JSON.parse(combination); } catch (e) {
                                runtime.logEvent(\`[Synergy Analysis] ⚠️ WARNING: Could not parse 'combination' string from AI. Skipping.\`);
                                continue;
                            }
                        }

                        if (!Array.isArray(combination) || combination.length === 0 || combination.some(c => typeof c !== 'object' || !c.name || !c.type)) {
                            runtime.logEvent(\`[Synergy Analysis] ⚠️ WARNING: AI returned a malformed 'combination' structure. Skipping.\`);
                            continue;
                        }
                        
                        const synergyToScore = { ...synergyData, combination };

                        // --- NEW: INSTANT COST ESTIMATION ---
                        const costResult = await runtime.tools.run('Estimate Synergy Validation Cost', { combination });
                        
                        const scoringResult = await runtime.tools.run('Score Single Synergy', {
                            synergyToScore: synergyToScore,
                            backgroundSources: allSourcesForContext
                        });

                        const organImpactResult = await runtime.tools.run('Assess Organ-Specific Aging Impact', { synergySummary: scoringResult.updatedSynergy.summary });
                        
                        if (scoringResult.updatedSynergy) {
                             const finalSynergyData = { 
                                ...scoringResult.updatedSynergy, 
                                organImpacts: organImpactResult.organImpacts,
                                sourceUri: source.url, 
                                sourceTitle: source.title,
                                estimatedCost: costResult.estimatedCost,
                                costBreakdown: costResult.costBreakdown,
                            };
                            const executionResult = await runtime.tools.run('RecordSynergy', finalSynergyData);
                            if (executionResult.synergy) {
                                foundSynergies.push(executionResult.synergy);
                            }
                        }
                    }
                }
                 runtime.logEvent(\`[Synergy Analysis] ✅ Processed source: \${source.title.substring(0,50)}... Found \${(aiResponse.toolCalls || []).length} synergies.\`);
            } else {
                 runtime.logEvent(\`[Synergy Analysis] ⚪️ No synergies found in source: \${source.title.substring(0,50)}...\`);
            }
        } catch (e) {
             runtime.logEvent(\`[Synergy Analysis] ❌ ERROR processing source \${source.title.substring(0,50)}...: \${e.message}\`);
             return { success: false, error: e.message, synergies: [] };
        }
        
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
            You MUST respond with ONLY a single, valid JSON object in the following format:
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
    You MUST respond with ONLY a single, valid JSON object in the following format:
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
        name: 'Generate Proposal for Single Synergy',
        description: 'Generates a full, investment-ready trial dossier and a critical review for a single promising synergistic combination.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To encapsulate the complex, multi-step process of proposal generation and critique into a single, callable tool for a streaming workflow.',
        parameters: [
            { name: 'synergy', type: 'object', description: 'The synergy object to generate a proposal for. Must include combination, summary, etc.', required: true },
            { name: 'backgroundSources', type: 'array', description: 'The full list of validated scientific sources to use as background context for the proposal.', required: true },
        ],
        implementationCode: `
        const { synergy, backgroundSources } = args;
        const comboString = synergy.combination.map(c => c.name).join(' + ');
        runtime.logEvent(\`[Proposal] Generating dossier for: \${comboString}\`);

        const dossierTool = runtime.tools.list().find(t => t.name === 'RecordTrialDossier');
        if (!dossierTool) throw new Error("Core tool 'RecordTrialDossier' not found.");

        const dossierGenPrompt = \`You are a senior biotech investment analyst. Create a comprehensive investment dossier for the synergistic combination provided.
Your analysis MUST be grounded in the BACKGROUND LITERATURE.
You MUST call the 'RecordTrialDossier' tool with all the required information.

**CRITICAL INSTRUCTIONS for Risk & Mitigation Section:**
1.  **Risk Analysis:** You must provide a structured 'riskAnalysis' object.
    -   **scientificRisk (0-100):** How likely is the core scientific hypothesis to be wrong?
    -   **commercialRisk (0-100):** How significant are market, IP, or competitive risks?
    -   **safetyRisk (0-100):** What is the risk of unforeseen toxicity or adverse effects?
    -   **overallRiskScore (0-100):** Your blended assessment of all risks.
    -   **riskSummary (string):** A brief text summary of the primary risks.
2.  **Mitigation (Risk Insurance):** You must define a clear 'mitigationPlan' and 'estimatedCostUSD'.
    -   **mitigationPlan:** Propose concrete next steps to de-risk the project (e.g., "Conduct 12-month mouse longevity study and advanced toxicology screens."). This is the "insurance policy".
    -   **estimatedCostUSD:** Estimate the cost of this plan in USD. This is the "insurance premium".

SYNERGY TO PROPOSE: \${JSON.stringify(synergy)}
BACKGROUND LITERATURE: \${JSON.stringify(backgroundSources.map(s => s.summary))}\`;
        
        const dossierSystemInstruction = "You are an expert system that generates a detailed investment dossier, including a structured risk analysis and mitigation plan, then calls the 'RecordTrialDossier' tool with the results.";
        
        let generatedDossier = null;
        try {
            const dossierAiResponse = await runtime.ai.processRequest(dossierGenPrompt, dossierSystemInstruction, [dossierTool]);
            if (dossierAiResponse && dossierAiResponse.toolCalls && dossierAiResponse.toolCalls.length > 0) {
                const toolCall = dossierAiResponse.toolCalls[0];
                if (toolCall.name === 'RecordTrialDossier') {
                    // --- VIRTUAL CELL VALIDATION STEP ---
                    runtime.logEvent(\`[Proposal] ...generating molecular mechanism validation for \${comboString}.\`);
                    let molecularMechanism = 'Analysis could not be performed.';
                    try {
                        const validationResult = await runtime.tools.run('Virtual Cell Validator', {
                            synergyCombination: synergy.combination.map(c => c.name),
                            observedEffect: synergy.summary
                        });
                        if (validationResult.explanation) {
                            molecularMechanism = validationResult.explanation;
                        }
                    } catch (e) {
                         runtime.logEvent(\`[Proposal] ⚠️ Virtual Cell Validator failed: \${e.message}\`);
                    }
                    
                    // Add the mechanism to the dossier arguments before recording
                    const finalDossierArgs = { ...toolCall.arguments, molecularMechanism };

                    const dossierResult = await runtime.tools.run(toolCall.name, finalDossierArgs);
                    if (dossierResult.dossier) {
                        generatedDossier = dossierResult.dossier;
                        runtime.logEvent(\`[Proposal] ...successfully wrote dossier for \${comboString}.\`);
                    }
                }
            } else {
                 throw new Error("AI did not generate a dossier tool call.");
            }
        } catch(e) {
             runtime.logEvent(\`[Proposal] ❌ Dossier generation failed for \${comboString}. Error: \${e.message}\`);
             return { success: false, error: 'Dossier generation failed.' };
        }

        if (!generatedDossier) {
            return { success: true, message: 'Dossier was not generated by the AI.' };
        }
        
        // Step 2: Critique Generated Dossier
        runtime.logEvent(\`[Proposal] Subjecting \${comboString} proposal to critical review...\`);
        let critiqueResult = null;
        try {
            critiqueResult = await runtime.tools.run('Critique Investment Proposal', { dossier: generatedDossier });
        } catch (e) { 
            runtime.logEvent(\`[Proposal] ⚠️ Critique failed for \${comboString}. Error: \${e.message}\`); 
        }

        return { success: true, message: 'Proposal generation and critique complete.', dossier: generatedDossier, critique: critiqueResult?.critique };
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
-   Analyze the provided dossier and any search evidence.
-   Your tone should be critical, professional, and evidence-based.
-   Focus on: 1) Understated risks. 2) Weaknesses in the scientific rationale. 3) Contradictory evidence. 4) Feasibility.
-   You MUST respond by calling the 'RecordCritique' tool with your complete analysis.\`;

        const recordCritiqueTool = runtime.tools.list().find(t => t.name === 'RecordCritique');
        if (!recordCritiqueTool) throw new Error("Core tool 'RecordCritique' not found.");
        
        // Add the combination to the arguments the AI needs to pass to the tool
        recordCritiqueTool.parameters.find(p => p.name === 'combination').description = 'The combination being critiqued. You MUST pass the original combination: ' + JSON.stringify(dossier.combination);

        runtime.logEvent('[Critique] Generating critique for ' + comboString + '...');
        const aiResponse = await runtime.ai.processRequest(context, systemInstruction, [recordCritiqueTool]);
        
        const critiqueCall = aiResponse?.toolCalls?.[0];
        if (!critiqueCall || critiqueCall.name !== 'RecordCritique') {
            runtime.logEvent('[Critique] ❌ AI did not call the RecordCritique tool as instructed. Response: ' + JSON.stringify(aiResponse));
            throw new Error("AI did not generate the expected critique tool call.");
        }
        
        // The critique tool will log the data. We just need to return its structured result.
        const critiqueResult = await runtime.tools.run(critiqueCall.name, critiqueCall.arguments);
        
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