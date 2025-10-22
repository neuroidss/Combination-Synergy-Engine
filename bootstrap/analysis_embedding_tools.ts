
import type { ToolCreatorPayload } from '../types';

export const EMBEDDING_ANALYSIS_TOOLS: ToolCreatorPayload[] = [
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
];
