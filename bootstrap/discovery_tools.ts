

import type { ToolCreatorPayload } from '../types';

export const DISCOVERY_TOOLS: ToolCreatorPayload[] = [
    {
        name: 'InterpretVacancy',
        description: 'Analyzes a "vacancy" on the technology map by finding the nearest neighboring research papers, calculating an average "vacancy vector" from their embeddings, and generating a hypothetical abstract for a new paper that would fill that semantic gap.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To translate an unexplored area on the research map into a concrete, actionable, and novel scientific hypothesis using embedding inversion.',
        parameters: [
            { name: 'vacancy', type: 'object', description: 'The vacancy object containing its x and y coordinates.', required: true },
            { name: 'mapData', type: 'array', description: 'The full map data, including sources with their coordinates and embeddings.', required: true },
        ],
        implementationCode: `
            const { vacancy, mapData } = args;

            const sortedByDistance = mapData
                .map(point => ({
                    ...point, // point is { source, x, y }
                    distance: Math.sqrt(Math.pow(point.x - vacancy.x, 2) + Math.pow(point.y - vacancy.y, 2))
                }))
                .sort((a, b) => a.distance - b.distance);
            
            const nearestNeighbors = sortedByDistance.slice(0, 4); // This is an array of { source, x, y, distance }
            
            if (nearestNeighbors.length < 2) {
                throw new Error("Not enough neighboring papers to generate a meaningful hypothesis.");
            }

            runtime.logEvent(\`[Vacancy Interpreter] Interpreting vacancy near: \${nearestNeighbors.map(n => n.source.title.substring(0,30)+'...').join(', ')}\`);

            const context = nearestNeighbors.map((n, i) => 
                \`NEIGHBORING RESEARCH AREA \${i+1}: "\\\${n.source.title}"\\nSUMMARY: \${n.source.summary}\\n\`
            ).join('\\n---\\n');
            
            // This is the "Embedding Inversion" step.
            const neighborEmbeddings = nearestNeighbors.map(n => n.source.embedding).filter(Boolean);
            if (neighborEmbeddings.length === nearestNeighbors.length) {
                const vectorSize = neighborEmbeddings[0].length;
                const vacancyVector = new Array(vectorSize).fill(0);
                for (const embedding of neighborEmbeddings) {
                    for (let i = 0; i < vectorSize; i++) {
                        vacancyVector[i] += embedding[i];
                    }
                }
                for (let i = 0; i < vectorSize; i++) {
                    vacancyVector[i] /= neighborEmbeddings.length;
                }
                runtime.logEvent(\`[Vacancy Interpreter] Calculated semantic "vacancy vector" by averaging neighbors.\`);
            } else {
                 runtime.logEvent(\`[Vacancy Interpreter] WARN: Not all neighbors had embeddings, cannot calculate vacancy vector.\`);
            }

            const systemInstruction = \`You are a visionary neurobiologist and inventor. You have been presented with several distinct areas of existing research that surround a semantic gap in the scientific landscape.
Your task is to invent a novel, groundbreaking hypothesis that connects these disparate fields and fills this gap.
- Analyze the provided research summaries.
- Synthesize a new idea that logically bridges the concepts.
- Write a compelling, futuristic abstract for a hypothetical scientific paper that would fill this gap.
- The abstract should propose a novel mechanism, a new therapeutic combination, or an undiscovered link.
- Your tone should be confident and pioneering.
- Respond with ONLY the text of the abstract. Do not add any introductory phrases like "Here is the abstract:".\`;

            const prompt = \`I have found a gap in scientific knowledge. This gap is semantically located between the following concepts, which are represented by their research paper abstracts. Generate a hypothetical abstract for the paper that would perfectly fill this void.\\n\\n\${context}\`;

            const hypotheticalAbstract = await runtime.ai.generateText(prompt, systemInstruction);

            if (!hypotheticalAbstract) {
                throw new Error("The AI failed to generate a hypothetical abstract.");
            }
            
            runtime.logEvent("[Vacancy Interpreter] ✅ Generated hypothetical abstract for research vacancy.");

            return { hypotheticalAbstract, neighbors: nearestNeighbors.map(n => n.source) };
        `
    }
];