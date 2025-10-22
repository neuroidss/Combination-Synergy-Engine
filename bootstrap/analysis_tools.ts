
import type { ToolCreatorPayload } from '../types';
import { CORE_ANALYSIS_TOOLS } from './analysis_core_tools';
import { EMBEDDING_ANALYSIS_TOOLS } from './analysis_embedding_tools';

export const ANALYSIS_TOOLS: ToolCreatorPayload[] = [
    ...CORE_ANALYSIS_TOOLS,
    ...EMBEDDING_ANALYSIS_TOOLS,
];
