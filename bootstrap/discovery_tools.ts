
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
- Your tone should be confident and pioneering.
- You MUST respond with ONLY a single, valid JSON object with the following structure:
{
  "hypotheticalAbstract": "A compelling, futuristic abstract for a hypothetical scientific paper that would fill this gap.",
  "proposedCombination": [{"name": "Compound A", "type": "drug"}, {"name": "Device B", "type": "device"}],
  "coreMechanism": "A brief explanation of the core scientific mechanism you are proposing."
}
\`;

            const prompt = \`I have found a gap in scientific knowledge. This gap is semantically located between the following concepts, which are represented by their research paper abstracts. Generate a structured hypothesis that would perfectly fill this void.\\n\\n\${context}\`;

            const aiResponseText = await runtime.ai.generateText(prompt, systemInstruction);
            const jsonMatch = aiResponseText.match(/\\{[\\s\\S]*\\}/);
            if (!jsonMatch) {
                throw new Error("The AI failed to generate a structured hypothesis from the vacancy. Raw response: " + aiResponseText);
            }
            const hypothesisData = JSON.parse(jsonMatch[0]);

            if (!hypothesisData.hypotheticalAbstract || !hypothesisData.proposedCombination) {
                 throw new Error("The AI failed to generate a valid structured hypothesis. Missing required fields.");
            }
            
            runtime.logEvent("[Vacancy Interpreter] ✅ Generated structured hypothesis for research vacancy.");

            return { ...hypothesisData, neighbors: nearestNeighbors.map(n => n.source) };
        `
    },
    {
        name: 'FindPersonalizedVacancies',
        description: 'Ranks all vacancies on the map based on their relevance to the user by considering proximity to the user\'s projected location and the synergy potential of neighboring research.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To identify and prioritize the most promising, personalized research opportunities for the user.',
        parameters: [
            { name: 'userCoordinates', type: 'object', description: 'The x and y coordinates of the user on the map.', required: true },
            { name: 'mapData', type: 'array', description: 'The full map data, including all sources.', required: true },
            { name: 'vacancies', type: 'array', description: 'The list of all available vacancy objects.', required: true },
        ],
        implementationCode: `
            const { userCoordinates, mapData, vacancies } = args;

            if (!userCoordinates || !vacancies || vacancies.length === 0) {
                return { success: true, personalizedVacancies: [] };
            }

            const rankedVacancies = vacancies.map(vacancy => {
                const distanceToUser = Math.sqrt(Math.pow(vacancy.x - userCoordinates.x, 2) + Math.pow(vacancy.y - userCoordinates.y, 2));

                // Calculate synergy potential based on neighbors
                const neighbors = mapData.sort((a, b) =>
                    Math.sqrt(Math.pow(a.x - vacancy.x, 2) + Math.pow(a.y - vacancy.y, 2)) -
                    Math.sqrt(Math.pow(b.x - vacancy.x, 2) + Math.pow(b.y - vacancy.y, 2))
                ).slice(0, 3);
                
                const synergyPotential = neighbors.reduce((sum, n) => sum + (n.source.reliabilityScore || 0.5), 0);

                // The score is higher for vacancies that are closer to the user and have high-potential neighbors
                const relevanceScore = (synergyPotential / (distanceToUser + 1)) * 100;

                return { ...vacancy, relevanceScore };
            }).sort((a, b) => b.relevanceScore - a.relevanceScore);

            runtime.logEvent(\`[Personalization] Found and ranked \${rankedVacancies.length} vacancies for the user.\`);
            
            // Return the top 5 most relevant vacancies
            return { success: true, personalizedVacancies: rankedVacancies.slice(0, 5) };
        `
    }
];
