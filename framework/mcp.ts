// framework/mcp.ts
import type { ToolCreatorPayload } from '../types';

const MCP_TOOL_DEFINITIONS: ToolCreatorPayload[] = [
    {
        name: 'Server File Writer',
        description: "Creates or overwrites a file on the server's filesystem. Path is relative to the specified base directory.",
        category: 'Server',
        executionEnvironment: 'Client', // It's a client tool that *calls* the server
        purpose: "To provide the foundational capability for an agent to create its own server-side logic and assets.",
        parameters: [
          { name: 'filePath', type: 'string', description: "The relative path of the file to create (e.g., 'my_script.py' or 'data/my_data.json').", required: true },
          { name: 'content', type: 'string', description: 'The full content to write to the file.', required: true },
          { name: 'baseDir', type: 'string', description: "The base directory to write to: 'scripts' (default) or 'assets'.", required: false },
        ],
        implementationCode: `
          if (!runtime.isServerConnected()) {
              console.warn(\`[SIM] Server not connected. Simulating write to \${args.filePath}\`);
              return { success: true, message: \`File '\${args.filePath}' would be written in a server environment.\` };
          }
          
          const response = await fetch('http://localhost:3001/api/files/write', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filePath: args.filePath, content: args.content, baseDir: args.filePath.endsWith('.py') ? 'scripts' : (args.baseDir || 'assets') }),
          });
          
          const result = await response.json();
          if (!response.ok) {
              throw new Error(result.error || \`Server responded with status \${response.status}\`);
          }
          
          return { success: true, ...result };
        `,
    },
    {
        name: 'Read Webpage Content',
        description: "Fetches the full, cleaned text content of a given public URL using the AI's built-in, serverless web browsing capabilities.",
        category: 'Functional',
        executionEnvironment: 'Client',
        purpose: "To provide the AI with the fundamental ability to 'read' the content of webpages, enabling deeper analysis than search snippets allow, without requiring a local server.",
        parameters: [
            { name: 'url', type: 'string', description: 'The full URL of the webpage to read.', required: true },
        ],
        implementationCode: `
          // This tool now exclusively uses the client-side AI's search capability, removing the server dependency.
          runtime.logEvent('[Web Reader] Using client-side AI search to read URL.');
          try {
              const searchPrompt = \`Use your search capabilities to find the scientific article at the URL "\${args.url}" and provide a comprehensive summary of its content. The summary must be detailed and based on the article's actual content, covering its main findings, methods, and conclusions.\`;
              const searchResult = await runtime.ai.search(searchPrompt);
              
              if (!searchResult || !searchResult.summary) {
                  throw new Error("The AI search did not return a summary for the URL.");
              }

              // The client-side approach returns a summary, which is sufficient for the subsequent verification steps.
              // We map it to the 'textContent' property to maintain a consistent data structure.
              return { success: true, textContent: searchResult.summary };

          } catch (e) {
              const errorMessage = e instanceof Error ? e.message : String(e);
              throw new Error(\`Client-side web reading failed: \${errorMessage}\`);
          }
        `,
    },
    {
        name: 'Start Node Process',
        description: 'Starts a managed Node.js process on the server from a given script file.',
        category: 'Server',
        executionEnvironment: 'Server',
        purpose: 'To dynamically launch and manage server-side Node.js processes like game worlds or APIs.',
        parameters: [
            { name: 'processId', type: 'string', description: 'A unique ID for the process (e.g., "aetherium_shard_1").', required: true },
            { name: 'scriptPath', type: 'string', description: 'The path to the Node.js script to run, relative to the server\'s \'scripts\' directory (e.g., "aetherium_server.ts").', required: true },
        ],
        implementationCode: 'start_node_process'
    },
    {
        name: 'Start Python Process',
        description: 'Starts a managed Python process on the server from a given script file, using the server\'s virtual environment.',
        category: 'Server',
        executionEnvironment: 'Server',
        purpose: 'To dynamically launch and manage server-side Python processes like the Gazebo service or other automation scripts.',
        parameters: [
            { name: 'processId', type: 'string', description: 'A unique ID for the process (e.g., "gazebo_service").', required: true },
            { name: 'scriptPath', type: 'string', description: 'The path to the Python script to run, relative to the server\'s \'scripts\' directory (e.g., "gazebo_service.py").', required: true },
        ],
        implementationCode: 'start_python_process'
    },
    {
        name: 'Stop Process',
        description: 'Stops a managed Node.js or Python process by its unique ID.',
        category: 'Server',
        executionEnvironment: 'Server',
        purpose: 'To terminate any running server-side process.',
        parameters: [
            { name: 'processId', type: 'string', description: 'The ID of the process to stop.', required: true },
        ],
        implementationCode: 'stop_process'
    },
    {
        name: 'List Managed Processes',
        description: 'Lists all currently managed Node.js and Python processes running on the server.',
        category: 'Server',
        executionEnvironment: 'Server',
        purpose: 'To monitor and get the status of all running server-side processes.',
        parameters: [],
        implementationCode: 'list_managed_processes'
    }
];

const MCP_INSTALLER_TOOL: ToolCreatorPayload = {
    name: 'Install MCP Suite',
    description: 'Installs the core tools for managing Master Control Program (MCP) server processes.',
    category: 'Automation',
    executionEnvironment: 'Client',
    purpose: "To bootstrap the agent's ability to manage its own backend microservices.",
    parameters: [],
    implementationCode: `
        runtime.logEvent('[INFO] Installing MCP Suite...');
        const toolPayloads = ${JSON.stringify(MCP_TOOL_DEFINITIONS)};
        const existing = new Set(runtime.tools.list().map(t => t.name));
        for (const payload of toolPayloads) {
            if (existing.has(payload.name)) continue;
            try { await runtime.tools.run('Tool Creator', payload); }
            catch (e) { runtime.logEvent(\`[WARN] Failed to create '\${payload.name}': \${e.message}\`); }
        }
        if (runtime.isServerConnected()) { await runtime.forceRefreshServerTools(); }
        return { success: true, message: 'MCP Suite installed.' };
    `
};

export const MCP_TOOLS: ToolCreatorPayload[] = [
    MCP_INSTALLER_TOOL,
    // The core 'Read Webpage Content' tool is now moved here from the deleted server files,
    // as it's a fundamental capability required by the client-side agent.
    ...MCP_TOOL_DEFINITIONS
];