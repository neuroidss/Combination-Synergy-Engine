import type { ToolCreatorPayload } from '../types';

import { MCP_TOOLS } from '../framework/mcp';
import { AUTOMATION_TOOLS } from '../framework/automation';
import { SYNERGY_FORGE_TOOLS } from './ui_agent_tools';
import { SYNERGY_FORGE_FUNCTIONAL_TOOLS } from './synergy_forge_tools';

export const BOOTSTRAP_TOOL_PAYLOADS: ToolCreatorPayload[] = [
    ...AUTOMATION_TOOLS,
    ...MCP_TOOLS,
    ...SYNERGY_FORGE_TOOLS,
    ...SYNERGY_FORGE_FUNCTIONAL_TOOLS,
];