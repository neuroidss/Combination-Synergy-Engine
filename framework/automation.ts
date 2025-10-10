// framework/automation.ts
import type { ToolCreatorPayload } from '../types';

const ARCHITECTURAL_PRINCIPLE_RECORDER: ToolCreatorPayload = {
    name: 'Core Architectural Principle: Multiple Tool Calls Over JSON',
    description: '"For everything, make a tool. Do not generate JSON. The architecture is multiple tool calls." - This is the foundational rule for building robust, predictable agentic systems.',
    category: 'Automation',
    executionEnvironment: 'Client',
    purpose: 'To permanently record and serve as a constant reminder of the core design philosophy. Its existence in the tool list ensures the principle is always present during agent operation and self-modification.',
    parameters: [],
    implementationCode: `
      const principle = "For everything, make a tool. Do not generate JSON. The architecture is multiple tool calls.";
      runtime.logEvent(\`[FRAMEWORK] Core architectural principle acknowledged: \${principle}\`);
      return { success: true, message: 'This tool serves as a record of the core architectural principle and performs no operational action.' };
    `
};


const WORKFLOW_CREATOR_TOOL: ToolCreatorPayload = {
    name: 'Workflow Creator',
    description: 'Creates a new, high-level "Automation" tool by combining a sequence of other tool calls into a single, reusable workflow. These workflows run on the client.',
    category: 'Automation',
    executionEnvironment: 'Client',
    purpose: "To allow the agent to learn and automate repetitive tasks, creating higher-level skills from basic components.",
    parameters: [
      { name: 'name', type: 'string', description: 'The unique, human-readable name for the new workflow tool.', required: true },
      { name: 'description', type: 'string', description: 'A clear, concise description of what the entire workflow accomplishes.', required: true },
      { name: 'purpose', type: 'string', description: 'An explanation of why this workflow is valuable and what problem it automates.', required: true },
      { name: 'steps', type: 'array', description: 'An array of objects, where each object defines a step with a "toolName" and "arguments".', required: true },
    ],
    implementationCode: `
      const { name, description, purpose, steps } = args;
      if (!name || !description || !purpose || !Array.isArray(steps) || steps.length === 0) {
        throw new Error("Workflow name, description, purpose, and at least one step are required.");
      }

      const newToolImplementation = \`
        const results = [];
        const workflowSteps = \${JSON.stringify(steps, null, 2)};
        for (const step of workflowSteps) {
            console.log(\\\`Running workflow step: \\\${step.toolName}\\\`);
            try {
                const result = await runtime.tools.run(step.toolName, step.arguments);
                results.push({ step: step.toolName, success: true, result });
            } catch (e) {
                results.push({ step: step.toolName, success: false, error: e.message });
                throw new Error(\\\`Workflow '\${name}' failed at step '\\\${step.toolName}': \\\${e.message}\\\`);
            }
        }
        return { success: true, message: "Workflow completed successfully.", results };
      \`;
      
      const result = await runtime.tools.run('Tool Creator', {
        name,
        description,
        category: 'Automation',
        executionEnvironment: 'Client',
        parameters: [], 
        implementationCode: newToolImplementation,
        purpose,
      });
      
      return { success: true, message: \`Successfully created new workflow tool: '\${name}'.\`, tool: result.tool };
    `
  };

const PROPOSE_SKILL_TOOL: ToolCreatorPayload = {
    name: 'Propose Skill From Observation',
    description: "Analyzes the recent history of the user's actions, infers the high-level intent, and proposes a new, reusable tool (a workflow or functional tool) to automate that task.",
    category: 'Automation',
    executionEnvironment: 'Client',
    purpose: 'To enable the agent to learn from a human pilot by turning observed actions into new, generalized, and reusable skills.',
    parameters: [
      { name: 'skillName', type: 'string', description: 'A descriptive name for the new skill (e.g., "PatrolSquarePattern").', required: true },
      { name: 'skillDescription', type: 'string', description: 'A clear description of what the new skill will accomplish.', required: true },
      { name: 'skillPurpose', type: 'string', description: 'An explanation of why this new skill is valuable.', required: true },
    ],
    implementationCode: `
      const { skillName, skillDescription, skillPurpose } = args;
      const observedActions = runtime.getObservationHistory();

      if (observedActions.length < 2) {
        throw new Error("Not enough actions observed to create a skill. Manually perform at least 2 actions first.");
      }

      const steps = observedActions.map(action => ({
        toolName: action.name,
        arguments: action.arguments,
      }));

      await runtime.tools.run('Workflow Creator', {
        name: skillName,
        description: skillDescription,
        purpose: skillPurpose,
        steps: steps,
      });

      runtime.clearObservationHistory();

      return { success: true, message: \`Successfully created new skill '\${skillName}' based on \${observedActions.length} observed actions.\` };
    `
};

export const AUTOMATION_TOOLS: ToolCreatorPayload[] = [
    ARCHITECTURAL_PRINCIPLE_RECORDER,
    WORKFLOW_CREATOR_TOOL,
    PROPOSE_SKILL_TOOL,
];