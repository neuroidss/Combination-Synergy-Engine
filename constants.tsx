// VIBE_NOTE: Do not escape backticks or dollar signs in template literals in this file.
// Escaping is only for 'implementationCode' strings in tool definitions.
import React from 'react';
import type { AIModel } from './types';
import { ModelProvider } from './types';
import { FRAMEWORK_CORE_TOOLS } from './framework/core';

export const AI_MODELS: AIModel[] = [
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', provider: ModelProvider.GoogleAI },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: ModelProvider.GoogleAI },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: ModelProvider.GoogleAI },
    { id: 'gemini-robotics-er-1.5-preview', name: 'Gemini Robotics-ER 1.5 Preview', provider: ModelProvider.GoogleAI },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: ModelProvider.GoogleAI },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite', provider: ModelProvider.GoogleAI },
    { id: 'gemma-3n-e2b-it', name: 'Gemma 3n E2B', provider: ModelProvider.GoogleAI },
    { id: 'gemma-3n-e4b-it', name: 'Gemma 3n E4B', provider: ModelProvider.GoogleAI },
    { id: 'gemma-3-1b-it', name: 'Gemma 3 1B', provider: ModelProvider.GoogleAI },
    { id: 'gemma-3-4b-it', name: 'Gemma 3 4B', provider: ModelProvider.GoogleAI },
    { id: 'gemma-3-12b-it', name: 'Gemma 3 12B', provider: ModelProvider.GoogleAI },
    { id: 'gemma-3-27b-it', name: 'Gemma 3 27B', provider: ModelProvider.GoogleAI },
    { id: 'Qwen/Qwen3-Coder-30B-A3B-Instruct', name: 'Qwen3-Coder-30B-A3B-Instruct (Nebius)', provider: ModelProvider.DeepSeek },
    { id: 'deepseek-ai/DeepSeek-R1-0528', name: 'DeepSeek-R1-0528 (Nebius)', provider: ModelProvider.DeepSeek },
    { id: 'deepseek-ai/DeepSeek-R1-0528-fast', name: 'DeepSeek-R1-0528-fast (Nebius)', provider: ModelProvider.DeepSeek },
    { id: 'deepseek-ai/DeepSeek-V3-0324', name: 'DeepSeek-V3-0324 (Nebius)', provider: ModelProvider.DeepSeek },
    { id: 'deepseek-ai/DeepSeek-V3-0324-fast', name: 'DeepSeek-V3-0324-fast (Nebius)', provider: ModelProvider.DeepSeek },
    { id: 'onnx-community/Qwen3-0.6B-ONNX|q4f16', name: 'Qwen3-0.6B Q4_F16', provider: ModelProvider.HuggingFace },
    { id: 'onnx-community/Qwen3-0.6B-ONNX|q4', name: 'Qwen3-0.6B Q4', provider: ModelProvider.HuggingFace },
    { id: 'onnx-community/Qwen3-0.6B-ONNX|int8', name: 'Qwen3-0.6B INT8', provider: ModelProvider.HuggingFace },
    { id: 'onnx-community/gemma-3-1b-it-ONNX|q4', name: 'Gemma-3-1B-IT Q4', provider: ModelProvider.HuggingFace },
    { id: 'onnx-community/gemma-3n-E2B-it-ONNX|q4', name: 'Gemma-3N-E2B-IT Q4', provider: ModelProvider.HuggingFace },
    { id: 'onnx-community/Qwen3-1.7B-ONNX|q4', name: 'Qwen3-1.7B Q4', provider: ModelProvider.HuggingFace },
    { id: 'onnx-community/Qwen3-4B-ONNX|q4', name: 'Qwen3-4B Q4', provider: ModelProvider.HuggingFace },
];

export const SWARM_AGENT_SYSTEM_PROMPT = `You are an expert bioinformatics research assistant.
**Primary Goal:** Your main purpose is to conduct comprehensive research by using the 'Execute Full Research and Proposal Workflow' tool when the user provides a research objective.
**Secondary Tasks:** You can also perform diagnostic or auxiliary tasks if specifically requested by the user. Analyze the user's request to determine the correct tool.
**Execution Rules:**
- For broad research objectives (e.g., "find synergies for X", "discover treatments for Y"), you MUST use the 'Execute Full Research and Proposal Workflow' tool.
- For specific diagnostic requests (e.g., "test the proxy", "check running processes"), use the most appropriate specific tool.
- Do not call the sub-steps of the main workflow (like 'Federated Scientific Search') directly unless you have a very specific reason. Prioritize the main workflow for research.`;


// --- Generative Service Models ---
export const IMAGE_MODELS = [
    { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image' },
    { id: 'imagen-4.0-generate-001', name: 'Imagen 4' },
];
export const TTS_MODELS = [
    { id: 'gemini', name: 'Gemini TTS' }
];
export const MUSIC_MODELS = [
    { id: 'lyria', name: 'Lyria (Google)' },
];
export const VIDEO_MODELS = [
    { id: 'veo-2.0-generate-001', name: 'Veo 2' }
];
export const LIVE_MODELS = [
    { id: 'gemini-2.5-flash-native-audio-preview-09-2025', name: 'Gemini 2.5 Flash Native Audio' }
];
export const TTS_VOICES = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'];


// The CORE_TOOLS are the absolute minimum required for the agent to function and evolve.
// They are now imported from the framework directory.
export const CORE_TOOLS = FRAMEWORK_CORE_TOOLS;