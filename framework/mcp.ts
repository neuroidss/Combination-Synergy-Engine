// DESIGN NOTE: The framework should only contain generic, reusable building blocks.
// Application-specific tools, even for bootstrapping services, belong with the application's
// own tool definitions. The framework provides the primitives (like starting processes or writing files),
// not the specific implementation of services.
import type { ToolCreatorPayload } from '../types';

export const SERVER_MANAGEMENT_TOOLS: ToolCreatorPayload[] = [
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
              body: JSON.stringify({ filePath: args.filePath, content: args.content, baseDir: args.filePath.endsWith('.py') || args.filePath.endsWith('.ts') ? 'scripts' : 'assets' }),
          });
          
          const responseText = await response.text();
          let result;
          try {
              result = JSON.parse(responseText);
          } catch (e) {
              throw new Error(\`Failed to parse JSON response from server for file write. Status: \${response.status}. Response: \${responseText.substring(0, 500)}\`);
          }
          
          if (!response.ok) {
              throw new Error(result.error || \`Server responded with status \${response.status}\`);
          }
          
          return { success: true, ...result };
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