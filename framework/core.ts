// framework/core.ts
import type { LLMTool } from '../types';

export const FRAMEWORK_CORE_TOOLS: LLMTool[] = [
  {
    id: 'task_complete',
    name: 'Task Complete',
    description: "Signals that the user's current multi-step task has been fully and successfully completed. Call this ONLY when the user's final goal is achieved.",
    category: 'Automation',
    executionEnvironment: 'Client',
    version: 1,
    purpose: "To provide a definitive end-point for multi-step tasks, allowing the swarm to know when its goal has been reached.",
    parameters: [
      { name: 'reason', type: 'string', description: 'A brief summary of why the task is considered complete.', required: true },
    ],
    implementationCode: `
      return { success: true, message: \`Task completed. Reason: \${args.reason}\` };
    `
  },
  {
    id: 'tool_creator',
    name: 'Tool Creator',
    description: "The primary evolutionary mechanism. Creates a new tool, adding it to the swarm's collective intelligence. This is the most important tool for solving novel problems and achieving complex goals. If you don't have a tool for a specific step, use this one to build it.",
    category: 'Automation',
    executionEnvironment: 'Client',
    version: 9,
    purpose: "To enable agent self-improvement and bootstrap the system's capabilities towards singularity. This is the foundation of problem-solving; it allows the agent to build any capability it needs.",
    parameters: [
      { name: 'name', type: 'string', description: 'The unique, human-readable name for the new tool.', required: true },
      { name: 'description', type: 'string', description: 'A clear, concise description of what the tool does.', required: true },
      { name: 'category', type: 'string', description: "The tool's category: 'UI Component', 'Functional', 'Automation', or 'Server'.", required: true },
      { name: 'executionEnvironment', type: 'string', description: "Where the tool should run: 'Client' or 'Server'. 'UI Component' must be 'Client'.", required: true },
      { name: 'parameters', type: 'array', description: 'An array of objects defining the parameters the tool accepts.', required: true },
      { name: 'implementationCode', type: 'string', description: 'The JavaScript/JSX (for Client) or special command string (for Server) that implements the tool.', required:true },
      { name: 'purpose', type: 'string', description: 'A clear explanation of why this tool is being created and what problem it solves. This is crucial for the "Will to Meaning".', required: true },
    ],
    implementationCode: `
      const { ...toolPayload } = args;
      
      if (!toolPayload.executionEnvironment || (toolPayload.executionEnvironment !== 'Client' && toolPayload.executionEnvironment !== 'Server')) {
        throw new Error("executionEnvironment is required and must be 'Client' or 'Server'.");
      }
      if (toolPayload.category === 'UI Component' && toolPayload.executionEnvironment !== 'Client') {
        throw new Error("'UI Component' tools must have an executionEnvironment of 'Client'.");
      }
      const validCategories = ['UI Component', 'Functional', 'Automation', 'Server'];
      if (!validCategories.includes(toolPayload.category)) {
          throw new Error("Invalid category. Must be one of " + validCategories.join(', '));
      }

      if (toolPayload.executionEnvironment === 'Server' && runtime.isServerConnected()) {
        try {
            const response = await fetch('http://localhost:3001/api/tools/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(toolPayload),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || \`Server responded with status \${response.status}\`);
            }
            return { success: true, message: \`Server tool '\${result.tool.name}' created successfully.\`, tool: result.tool };
        } catch (e) {
            throw new Error(\`Failed to create server tool via API: \${e.message}\`);
        }
      } else {
        const newTool = runtime.tools.add(toolPayload);
        const location = toolPayload.executionEnvironment === 'Server' ? 'client-side (simulated)' : 'client-side';
        return { success: true, message: \`Successfully created new \${location} tool: '\${newTool.name}'. Purpose: \${toolPayload.purpose}\`, tool: newTool };
      }
    `
  },
  {
    id: 'debug_log_view',
    name: 'Debug Log View',
    description: 'A core UI component that displays the system event log, API call counts, and provides a system reset function. This tool is directly handled by the UI runner.',
    category: 'UI Component',
    executionEnvironment: 'Client',
    version: 1,
    purpose: "To provide essential debugging and control functionality for the user.",
    parameters: [
      { name: 'logs', type: 'array', description: 'The array of event log messages to display.', required: true },
      { name: 'onReset', type: 'object', description: 'A callback function to trigger a full system factory reset.', required: true },
      { name: 'apiCallCounts', type: 'object', description: 'A record mapping API model IDs to their call counts.', required: true },
      { name: 'apiCallLimit', type: 'number', description: 'The configured limit for API calls.', required: true },
      { name: 'agentCount', type: 'number', description: 'The number of currently active agents in the swarm.', required: true },
    ],
    implementationCode: `
      // This component is specially handled by the UIToolRunner and does not use this implementation code.
      // It directly renders the imported DebugLogView component for performance and complexity reasons.
      return <div>Debug Log View placeholder</div>;
    `
  }
];
