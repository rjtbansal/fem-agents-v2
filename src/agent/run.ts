import { generateText, type ModelMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { getTracer, Laminar } from "@lmnr-ai/lmnr";
import { tools } from "./tools/index.ts";
import { SYSTEM_PROMPT } from "./system/prompt.ts";

import type { AgentCallbacks } from "../types.ts";

const MODEL_NAME = "gpt-5-mini";
// Laminar is initialized at the top level of the module to ensure that telemetry is captured for all operations within this module. The project API key is loaded from an environment variable, and telemetry is enabled with a tracer to capture detailed information about the agent's interactions and tool usage.
Laminar.initialize({
    projectApiKey: process.env.LMNR_PROJECT_API_KEY || "",
})

export async function runAgent(
  userMessage: string,
  conversationHistory: ModelMessage[],
  callbacks: AgentCallbacks,
): Promise<any> {
  // Filter and check if we need to compact the conversation history before starting
  const { text } = await generateText({
    model: openai(MODEL_NAME),
    prompt: userMessage,
    system: SYSTEM_PROMPT,
    tools,
    experimental_telemetry: {
        isEnabled: true,
        tracer: getTracer(),
    }
  });
  // Flush telemetry data to ensure it's sent to the server before the function exits
  await Laminar.flush();
  console.log('done generating text', { text } );
}
