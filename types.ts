export type ToolCategory = 'UI Component' | 'Functional' | 'Automation' | 'Server';
export type AgentStatus = 'idle' | 'working' | 'error' | 'success';

export interface AgentWorker {
  id: string;
  status: AgentStatus;
  lastAction: string | null;
  error: string | null;
  result: any | null;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
}

export interface LLMTool {
  id:string;
  name:string;
  description: string;
  category: ToolCategory;
  version: number;
  parameters: ToolParameter[];
  purpose?: string;
  implementationCode: string;
  createdAt?: string;
  updatedAt?: string;
  executionEnvironment: 'Client' | 'Server';
}

export type NewToolPayload = Omit<LLMTool, 'id' | 'version' | 'createdAt' | 'updatedAt'>;

export interface ToolCreatorPayload {
  name: string;
  description: string;
  category: ToolCategory;
  executionEnvironment: 'Client' | 'Server';
  parameters: ToolParameter[];
  implementationCode: string;
  purpose: string;
}

export interface AIToolCall {
    name: string;
    arguments: Record<string, any>;
}

export interface AIResponse {
  toolCalls: AIToolCall[] | null;
}

export interface EnrichedAIResponse {
  toolCall: AIToolCall | null;
  tool?: LLMTool;
  executionResult?: any;
  executionError?: string;
}

// The different high-level contexts the agent can be in.
export type MainView = 'SYNERGY_FORGE';


export enum ModelProvider {
  GoogleAI = 'GoogleAI',
  OpenAI_API = 'OpenAI_API',
  Ollama = 'Ollama',
  HuggingFace = 'HuggingFace',
  Wllama = 'Wllama',
}

export interface AIModel {
  id: string;
  name: string;
  provider: ModelProvider;
}
export interface APIConfig {
  googleAIAPIKey?: string;
  openAIAPIKey?: string;
  openAIBaseUrl?: string;
  ollamaHost?: string;
}

export type UIToolRunnerProps = Record<string, any>;

export interface ExecuteActionFunction {
    (toolCall: AIToolCall, agentId: string, context?: MainView): Promise<EnrichedAIResponse>;
    getRuntimeApiForAgent: (agentId: string) => any;
}

export interface ScoredTool {
  tool: LLMTool;
  score: number;
}

export type ToolRelevanceMode = 'Embeddings' | 'All' | 'LLM';