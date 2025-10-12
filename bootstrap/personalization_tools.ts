import type { ToolCreatorPayload } from '../types';

export const PERSONALIZATION_TOOLS: ToolCreatorPayload[] = [
    {
        name: 'CreateUserAgingVector',
        description: 'Converts answers from a user lifestyle questionnaire into a numerical "aging vector" representing their biological state.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To create a personalized biological snapshot of the user, which serves as the foundation for all personalization features.',
        parameters: [
            { name: 'lifestyleData', type: 'object', description: 'An object containing answers from the user profile form (e.g., age, sleep, stress, diet, exercise).', required: true },
        ],
        implementationCode: `
            const { lifestyleData } = args;
            // This is a simplified mapping for the MVP. In the future, this could involve a more complex model.
            const vector = {
                inflammation: ((lifestyleData.stress || 5) / 10 * 0.5) + (lifestyleData.diet === 'poor' ? 0.4 : lifestyleData.diet === 'average' ? 0.2 : 0) + ((lifestyleData.sleep < 6) ? 0.3 : 0),
                proteostasisLoss: ((lifestyleData.exercise < 2) ? 0.5 : 0) + ((lifestyleData.age > 50) ? 0.4 : (lifestyleData.age > 40 ? 0.2 : 0.1)),
                mitoDysfunction: ((lifestyleData.sleep < 7) ? 0.6 : 0) + ((lifestyleData.exercise < 3) ? 0.4 : 0),
            };

            // Normalize values to be between 0 and 1
            for (const key in vector) {
                if (vector.hasOwnProperty(key)) {
                    vector[key] = Math.max(0, Math.min(1, vector[key]));
                }
            }

            runtime.logEvent('[Personalization] User Aging Vector created.');
            return { success: true, userAgingVector: vector };
        `
    },
    {
        name: 'ProjectUserOntoMap',
        description: 'Finds the appropriate coordinates for the user on the research map based on their aging vector.',
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: 'To visually represent the user on the discovery map, placing them in the research area most relevant to their biological profile.',
        parameters: [
            { name: 'userAgingVector', type: 'object', description: 'The user\'s aging vector, with keys for different aging hallmarks.', required: true },
            { name: 'mapData', type: 'array', description: 'The current map data containing all research sources and their coordinates.', required: true },
        ],
        implementationCode: `
            const { userAgingVector, mapData } = args;
            if (!mapData || mapData.length === 0) {
                throw new Error("Map data is not available for projection.");
            }
            if (!userAgingVector || Object.keys(userAgingVector).length === 0) {
                throw new Error("User aging vector is not available.");
            }

            // Get top 3 hallmarks with scores > 0.1
            const topHallmarks = Object.entries(userAgingVector)
                .filter(([, score]) => score > 0.1)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([key]) => key.replace(/([A-Z])/g, ' $1').toLowerCase()); // e.g., 'mitoDysfunction' -> 'mito dysfunction'

            let relevantSources = new Set();
            if (topHallmarks.length > 0) {
                for (const hallmark of topHallmarks) {
                    mapData.forEach(point => {
                        const searchText = \`\${point.source.title} \${point.source.summary}\`.toLowerCase();
                        if (searchText.includes(hallmark)) {
                            relevantSources.add(point);
                        }
                    });
                }
            }

            let sourcesForProjection = Array.from(relevantSources);

            // Fallback if no relevant sources found, or very few
            if (sourcesForProjection.length < 3) {
                const centerX = 250, centerY = 250;
                sourcesForProjection = [...mapData].sort((a, b) => 
                    (Math.pow(a.x - centerX, 2) + Math.pow(a.y - centerY, 2)) -
                    (Math.pow(b.x - centerX, 2) + Math.pow(b.y - centerY, 2))
                ).slice(0, 5);
            } else {
                sourcesForProjection = sourcesForProjection.slice(0, 5); // Limit to 5 max
            }

            if (sourcesForProjection.length === 0) {
                return { success: true, userCoordinates: { x: 250, y: 250 } }; // Center of map by default
            }

            const avgX = sourcesForProjection.reduce((sum, s) => sum + s.x, 0) / sourcesForProjection.length;
            const avgY = sourcesForProjection.reduce((sum, s) => sum + s.y, 0) / sourcesForProjection.length;

            runtime.logEvent(\`[Personalization] User projected onto map based on top hallmarks: \${topHallmarks.join(', ') || 'general profile'}.\`);
            return { success: true, userCoordinates: { x: avgX, y: avgY } };
        `
    }
];
