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
const TOOL_DEFINITIONS: Record<string, { description: string; parameters: z.ZodObject<z.ZodRawShape> }> = {
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
    description: "Run a command in the shell and return its output",
    parameters: z.object({
      command: z.string().describe("The shell command to execute"),
    }),
  },
}

/**
 * Single-turn executor with mocked tools.
 * Uses predefined tool definitions - tools never execute, only selection is tested.
 */
export async function singleTurnWithMocks(
  data: EvalData,
): Promise<SingleTurnResult> {
  const messages = buildMessages(data);

  // build mocked tools from definitions
  const tools: ToolSet = {};
  for (const toolName of data.tools){
    const def = TOOL_DEFINITIONS[toolName];
    if(def) {
      tools[toolName] = tool({
        description: def.description,
        inputSchema: def.parameters,  
      });
    }
  }

  const result = await generateText({
    model: openai(data.config?.model ?? "gpt-4o-mini"),
    messages,
    tools,
    stopWhen: stepCountIs(1), // Only allow the model to take one step (one tool call or final response)
    temperature: data.config?.temperature ?? undefined, // Use deterministic output for testing
  });

  // extract tool calls and final response from the result
  const toolCalls = result.toolCalls.map((call) => ({
    toolName: call.toolName,
    args: "args" in call ? call.args : {}, 
  }));

  const toolNames = toolCalls.map((call) => call.toolName);

  return {
    toolCalls,
    toolNames,
    selectedAny: toolNames.length > 0, 
  };
}