import { tool, type ModelMessage, type ToolSet } from "ai";
import { z } from "zod";
import { SYSTEM_PROMPT } from "../src/agent/system/prompt.ts";
import type { EvalData, MultiTurnEvalData } from "./types.ts";

// Tool-aware system prompt specifically for evaluations
const EVAL_SYSTEM_PROMPT = `You are a helpful AI assistant with access to tools. When users ask you to perform file operations or system tasks, you MUST use the appropriate tools rather than providing general information.

Available tools and when to use them:
- readFile: Use when asked to read, view, examine, or show the contents of a specific file
- writeFile: Use when asked to create, write, modify, or save content to a file
- listFiles: Use when asked to list, show, or explore files and directories
- deleteFile: Use when asked to remove, delete, or clean up files
- runCommand: Use when asked to execute shell commands or system operations

Guidelines:
- Always use tools when the user's request requires accessing the file system or running commands
- If asked to read a file, use readFile tool - don't provide generic information about file types
- If asked to list files in a directory, use listFiles tool
- For general knowledge questions unrelated to files/system, respond normally without tools
- Be direct and helpful in your responses`;

/**
 * Build mocked tools from data config.
 * Each tool returns its configured mockReturn value.
 */
export const buildMockedTools = (
  mockTools: MultiTurnEvalData["mockTools"],
): ToolSet => {
  const tools: ToolSet = {};

  for (const [name, config] of Object.entries(mockTools)) {
    // Build parameter schema dynamically
    const paramSchema: Record<string, z.ZodString> = {};
    for (const paramName of Object.keys(config.parameters)) {
      paramSchema[paramName] = z.string();
    }

    tools[name] = tool({
      description: config.description,
      inputSchema: z.object(paramSchema),
      execute: async () => config.mockReturn,
    });
  }

  return tools;
};

/**
 * Build message array from eval data
 * Uses tool-aware system prompt for evaluations unless custom systemPrompt is provided
 */
export const buildMessages = (
  data: EvalData | { prompt?: string; systemPrompt?: string },
): ModelMessage[] => {
  // Use custom systemPrompt if provided, otherwise use tool-aware EVAL_SYSTEM_PROMPT for evaluations
  const systemPrompt = data.systemPrompt ?? EVAL_SYSTEM_PROMPT;
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: data.prompt! },
  ];
};
