import { generateText, stepCountIs, tool, type ToolSet } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

import type {
  EvalData,
  SingleTurnResult,
  MultiTurnEvalData,
  MultiTurnResult,
} from "./types.ts";
import { buildMessages } from "./utils.ts";

// Define the available tools and their parameters
// In a real implementation, these would correspond to actual functions that perform the described actions
const TOOL_DEFINITIONS: Record<string, { description: string; parameters: z.ZodSchema<any> }> = {
  // Example tools for file operations and command execution
  readFile: {
    description: "Read the contents of a file at a given path",
    parameters: z.object({
      path: z.string().describe("The path to the file to read"),
    }),
  },
  writeFile: {
    description: "Write content to a file at a given path",
    parameters: z.object({
      path: z.string().describe("The path to the file to write"),
      content: z.string().describe("The content to write to the file"),
    }),
  },
  listFiles: {
    description: "List all files in a directory",
    parameters: z.object({
      path: z.string().describe("The directory to list files from"),
    }),
  },
  deleteFile: {
    description: "Delete a file at a given path",
    parameters: z.object({
      path: z.string().describe("The path to the file to delete"),
    }),
  },
  runCommand: {
    description: "Run a command in the shell",
    parameters: z.object({
      command: z.string().describe("The command to run"),
    }),
  },
}

// Single turn executor that processes the input, generates tool calls, and returns the results
// In a real implementation, this would also execute the tool calls and return their outputs
export const singleTurnExecutor = async (data: EvalData) => {
  const messages = buildMessages(data);

  const tools: ToolSet = {};
  for (const toolName of data.tools) {
    const def = TOOL_DEFINITIONS[toolName];
    if (def) {
      tools[toolName] = tool({
        description: def.description,
        inputSchema: def.parameters,
      });
    }
  }

  // Generate text and capture tool calls without executing them
  // We use the stopWhen condition to stop generation after the first tool call is made
  const { toolCalls } = await generateText({
    model: openai(data.config?.model ?? "gpt-5-mini"),
    messages,
    tools,
    stopWhen: stepCountIs(1),
    // temperature is a parameter that controls the randomness of the model's output. A higher temperature will result in more random outputs, while a lower temperature will make the output more deterministic. We can set it based on the config provided in the EvalData, or leave it undefined to use the model's default behavior.
    temperature: data.config?.temperature ?? undefined,
  });

  // Extract the tool calls and their arguments to return in the result
  const calls = toolCalls.map((call) => ({
    name: call.toolName,
    arguments: "args" in call ? call.args : {},
  }));

  const toolNames = toolCalls.map((call) => call.toolName); 
// Return the tool calls and a flag indicating if any tools were called
  return {
    toolCalls: calls,
    toolNames,
    selectedAny: toolNames.length > 0,
  } 
}