
import type { ToolCreatorPayload } from '../types';

export const DISCOVERY_TOOLS: ToolCreatorPayload[] = [
    {
        name: 'InterpretVacancy',
        description: 'Analyzes a "vacancy" on the technology map by finding the nearest neighboring research papers and generating a hypothetical abstract for a new paper that would fill that gap.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To translate an unexplored area on the research map into a concrete, actionable, and novel scientific hypothesis.',
        parameters: [
            { name: 'vacancy', type: 'object', description: 'The vacancy object containing its x and y coordinates.', required: true },
            { name: 'mapData', type: 'array', description: 'The full map data, including sources and their coordinates.', required: true },
        ],
        implementationCode: `
            const { vacancy, mapData } = args;

            const sortedByDistance = mapData
                .map(point => ({
                    ...point,
                    distance: Math.sqrt(Math.pow(point.x - vacancy.x, 2) + Math.pow(point.y - vacancy.y, 2))
                }))
                .sort((a, b) => a.distance - b.distance);
            
            const nearestNeighbors = sortedByDistance.slice(0, 4);
            
            if (nearestNeighbors.length < 2) {
                throw new Error("Not enough neighboring papers to generate a meaningful hypothesis.");
            }

            runtime.logEvent(\`[Vacancy Interpreter] Interpreting vacancy near: \${nearestNeighbors.map(n => n.source.title.substring(0,30)+'...').join(', ')}\`);

            const context = nearestNeighbors.map((n, i) => 
                \`NEIGHBORING RESEARCH AREA \${i+1}: "\\\${n.source.title}"\\nSUMMARY: \${n.source.summary}\\n\`
            ).join('\\n---\\n');

            const systemInstruction = \`You are a visionary neurobiologist and inventor. You have been presented with several distinct areas of existing research. Your task is to invent a novel, groundbreaking hypothesis that connects these disparate fields.
            - Analyze the provided research summaries.
            - Identify the conceptual gap or unexplored synergy between them.
            - Write a compelling, futuristic abstract for a hypothetical scientific paper that would fill this gap.
            - The abstract should propose a novel mechanism, a new therapeutic combination, or an undiscovered link.
            - Your tone should be confident and pioneering.
            - Respond with ONLY the text of the abstract. Do not add any introductory phrases like "Here is the abstract:".\`;

            const prompt = \`The following research papers surround an unexplored "white space" in the scientific landscape. Generate an abstract for the breakthrough paper that should exist in this space.\\n\\n\${context}\`;

            const hypotheticalAbstract = await runtime.ai.generateText(prompt, systemInstruction);

            if (!hypotheticalAbstract) {
                throw new Error("The AI failed to generate a hypothetical abstract.");
            }
            
            runtime.logEvent("[Vacancy Interpreter] ✅ Generated hypothetical abstract for research vacancy.");

            return { hypotheticalAbstract, neighbors: nearestNeighbors.map(n => n.source) };
        `
    }
];
