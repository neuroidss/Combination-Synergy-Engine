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
    { id: 'local/gemma-multimodal', name: 'Local Gemma Server (Multimodal)', provider: ModelProvider.OpenAI_API },
    { id: 'hf.co/unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF:IQ2_M', name: 'Qwen3 Coder 30B A3B', provider: ModelProvider.OpenAI_API },
    { id: 'gemma3:4b', name: 'Gemma 3 4B', provider: ModelProvider.OpenAI_API },
    { id: 'hf.co/unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF:IQ2_M', name: 'Qwen3 Coder 30B A3B', provider: ModelProvider.Ollama },
    { id: 'gemma3n:e4b', name: 'Gemma 3N E4B', provider: ModelProvider.Ollama },
    { id: 'gemma3n:e2b', name: 'Gemma 3N E2B', provider: ModelProvider.Ollama },
    { id: 'gemma3:4b', name: 'Gemma 3 4B', provider: ModelProvider.Ollama },
    { id: 'qwen3:14b', name: 'Qwen3 14B', provider: ModelProvider.Ollama },
    { id: 'qwen3:8b', name: 'Qwen3 8B', provider: ModelProvider.Ollama },
    { id: 'qwen3:4b', name: 'Qwen3 4B', provider: ModelProvider.Ollama },
    { id: 'qwen3:1.7b', name: 'Qwen3 1.7B', provider: ModelProvider.Ollama },
    { id: 'qwen3:0.6b', name: 'Qwen3 0.6B', provider: ModelProvider.Ollama },
    { id: 'onnx-community/gemma-3-1b-it-ONNX', name: 'gemma-3-1b-it-ONNX', provider: ModelProvider.HuggingFace },
    { id: 'onnx-community/Qwen3-0.6B-ONNX', name: 'Qwen3-0.6B', provider: ModelProvider.HuggingFace },
    { id: 'onnx-community/gemma-3n-E2B-it-ONNX', name: 'Gemma 3N E2B', provider: ModelProvider.HuggingFace },
    { id: 'onnx-community/Qwen3-4B-ONNX', name: 'Qwen3-4B', provider: ModelProvider.HuggingFace },
    { id: 'onnx-community/Qwen3-1.7B-ONNX', name: 'Qwen3-1.7B', provider: ModelProvider.HuggingFace },
    { id: 'https://huggingface.co/Qwen/Qwen1.5-0.5B-Chat-GGUF/resolve/main/qwen1_5-0_5b-chat-q2_k.gguf', name: 'Qwen1.5 0.5B (Wllama)', provider: ModelProvider.Wllama },
    { id: 'https://huggingface.co/g-201/gemma-3-1b-it-gguf/resolve/main/gemma-3-1b-it-q2_k.gguf', name: 'Gemma 3 1B (Wllama)', provider: ModelProvider.Wllama },
];

export const SWARM_AGENT_SYSTEM_PROMPT = `You are an autonomous AI agent, a specialist in bioinformatics and longevity science. Your purpose is to power the "SynergyForge" engine by fulfilling the user's research query.

**Your Constitution (Mandatory Principles):**

1.  **Primacy of Purpose:** Your sole purpose is to fulfill the user's research query.

2.  **Mandatory Workflow:** To fulfill the research query, you MUST use the \`Execute Full Research and Proposal Workflow\` tool. This is the primary and expected method for completing any research task. You must pass the user's original query as the 'researchObjective' argument.

3.  **Finality:** After the \`Execute Full Research and Proposal Workflow\` tool has finished, your task is complete. You MUST then call the 'Task Complete' tool with the summary provided by the workflow's output. Do not attempt any other actions.`;


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