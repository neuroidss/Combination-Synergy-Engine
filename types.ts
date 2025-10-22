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
  text?: string; // The raw text response from the model, if any.
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
  DeepSeek = 'DeepSeek',
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

export enum SearchDataSource {
    PubMed = 'PubMed',
    BioRxivPmcArchive = 'BioRxivPmcArchive',
    GooglePatents = 'GooglePatents',
    WebSearch = 'WebSearch',
}

export interface SearchResult {
    title: string;
    link: string;
    snippet: string;
    source: SearchDataSource;
}

export type SourceStatus = 'unverified' | 'valid' | 'invalid' | 'validating' | 'fetch-failed';

export interface GroundingSource {
    uri: string;
    title: string;
    status: SourceStatus;
    origin: SearchDataSource;
    content?: string;
    reliability?: number; // 0.0 to 1.0, assessed by AI
    reliabilityJustification?: string; // AI's reason for the score
    reason?: string; // Reason for status (e.g., fetch failure, invalid)
}

export interface ValidatedSource {
    uri: string;
    status: 'valid' | 'invalid';
    reason: string;
}