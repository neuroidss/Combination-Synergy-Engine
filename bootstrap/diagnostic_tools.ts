

import type { ToolCreatorPayload } from '../types';

export const DIAGNOSTIC_TOOLS: ToolCreatorPayload[] = [
    {
        name: 'Diagnose Tool Execution Error',
        description: 'A high-level diagnostic tool run by the supervisor agent. It analyzes the full context of a failed tool execution or AI generation step, determines the root cause, and records a structured analysis with a suggested fix.',
        category: 'Automation',
        executionEnvironment: 'Client',
        purpose: 'To provide automated root cause analysis for system failures, making the agent swarm more robust and laying the groundwork for self-healing capabilities.',
        parameters: [
            { name: 'researchObjective', type: 'string', description: 'The original high-level research goal for context.', required: true },
            { name: 'executionHistory', type: 'string', description: 'A string representing the history of tool calls leading up to the error.', required: true },
            { name: 'failedAction', type: 'string', description: 'A description of the specific action that failed (e.g., a tool call with its arguments, or the prompt that failed to generate a tool call).', required: true },
            { name: 'errorMessage', type: 'string', description: 'The specific error message that was thrown.', required: true },
            { name: 'availableTools', type: 'string', description: 'A JSON string of available tools (name and description) for context.', required: true },
            { name: 'failedToolSourceCode', type: 'string', description: 'The implementationCode of the tool that failed, if applicable. "N/A" if not applicable (e.g., AI failed to generate a tool call).', required: false },
            { name: 'modelUsed', type: 'string', description: 'The ID of the AI model that was being used when the failure occurred.', required: true },
        ],
        implementationCode: `
            const { researchObjective, executionHistory, failedAction, errorMessage, availableTools, failedToolSourceCode, modelUsed } = args;

            const systemInstruction = \`You are an expert AI Swarm Debugger and Senior Software Engineer. Your task is to perform a root cause analysis of a runtime error in an autonomous agent swarm and propose a concrete recovery plan.

**DIAGNOSTIC PROTOCOL:**

1.  **Analyze and Classify the Error Category:** First, determine the single most likely root cause and classify it into one of these categories:
    *   'MODEL_INCAPABLE': The task was too complex for the AI model being used (e.g., a 'flash' model was asked to do complex reasoning or code generation). The prompt and tools were likely correct, but the model lacked the capability.
    *   'TOOL_BUG': The code within the \\\`failedToolSourceCode\\\` has a logical error, typo, or bug that caused the exception.
    *   'PROMPT_AMBIGUITY': The instructions given to the agent (in the objective or prior steps) were unclear, contradictory, or insufficient, leading the AI to make a mistake.
    *   'AGENT_LOGIC_ERROR': The AI chose the wrong tool for the job, provided incorrect arguments to a correct tool, or got stuck in a loop. This represents a flaw in the agent's reasoning, not the tool's code.

2.  **Propose a Recovery Action:** Based on your classification, propose a single, specific recovery action from this list:
    *   'RETRY_WITH_STRONGER_MODEL': If the category was 'MODEL_INCAPABLE', recommend a more powerful model.
    *   'MODIFY_TOOL_CODE': If the category was 'TOOL_BUG', provide the corrected code.
    *   'SIMPLIFY_TASK': If the task is too complex, propose a simplified research objective or a new sequence of smaller tool calls.
    *   'REWRITE_PROMPT': If the prompt was ambiguous, provide a clearer version.

3.  **Provide Parameters for the Action:** Supply the necessary data for your proposed action in the \\\`actionParameters\\\` object.
    *   For 'RETRY_WITH_STRONGER_MODEL': \\\`{"suggestedModelId": "gemini-2.5-pro"}\\\`
    *   For 'SIMPLIFY_TASK': \\\`{"simplifiedObjective": "New, simpler objective text."}\\\`

4.  **Final Output:** You MUST call the 'RecordErrorAnalysis' tool with your complete, structured analysis. Your entire response must be ONLY this single tool call.\`;

            const prompt = '## FAILURE CONTEXT ##\\n\\n' +
                '**High-Level Objective:**\\n' + researchObjective + '\\n\\n' +
                '**Execution History (Simplified):**\\n' + executionHistory + '\\n\\n' +
                '**Failed Action:**\\n' + failedAction + '\\n\\n' +
                '**Error Message:**\\n' + errorMessage + '\\n\\n' +
                '**AI Model Used:**\\n' + modelUsed + '\\n\\n' +
                '**Source Code of Failed Tool (if applicable):**\\n' +
                '\\\`\\\`\\\`javascript\\n' +
                (failedToolSourceCode || 'N/A') + '\\n' +
                '\\\`\\\`\\\`\\n\\n' +
                '**Available Tools for Context:**\\n' + availableTools + '\\n\\n' +
                '## YOUR TASK ##\\n\\n' +
                "Follow the DIAGNOSTIC PROTOCOL precisely. Analyze the context, classify the error, propose a recovery action with parameters, and provide your diagnosis. Then, call the 'RecordErrorAnalysis' tool with your findings.";
            
            const recordTool = runtime.tools.list().find(t => t.name === 'RecordErrorAnalysis');
            if (!recordTool) {
                throw new Error("Diagnostic process failed: The 'RecordErrorAnalysis' tool is missing.");
            }
            
            try {
                // The model override has been removed. The tool will now use the currently selected model.
                const aiResponse = await runtime.ai.processRequest(prompt, systemInstruction, [recordTool], []);
                
                if (!aiResponse?.toolCalls?.length) {
                    let analysis = "The diagnostic AI failed to call the 'RecordErrorAnalysis' tool as instructed.";
                    if (aiResponse?.text) {
                        analysis += \` AI's textual response was: "\${aiResponse.text.trim()}"\`;
                    }
                    throw new Error(analysis);
                }
                
                const analysisCall = aiResponse.toolCalls[0];
                if (analysisCall.name !== 'RecordErrorAnalysis') {
                    throw new Error(\`The diagnostic AI called the wrong tool: '\${analysisCall.name}'. Expected 'RecordErrorAnalysis'.\`);
                }

                // Execute the recording tool call to log the analysis.
                const analysisResult = await runtime.tools.run(analysisCall.name, analysisCall.arguments);

                return { success: true, message: "Error analysis complete.", analysis: analysisResult.analysis };

            } catch(e) {
                 throw new Error(\`Diagnostic agent failed: \${e.message}\`);
            }
        `
    },
];