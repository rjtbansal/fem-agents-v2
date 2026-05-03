import { streamText, type ModelMessage } from "ai"; // AI SDK for interacting with language models
import { openai } from "@ai-sdk/openai"; // OpenAI provider for the AI SDK
import { getTracer, Laminar } from "@lmnr-ai/lmnr"; // Laminar for observability and telemetry
import { tools } from "./tools/index.ts"; // Available tools the agent can use (file ops, shell, web search, etc.)
import { SYSTEM_PROMPT } from "./system/prompt.ts"; // The system prompt that defines the agent's behavior

// Type definitions for callbacks and tool call information
import type { AgentCallbacks, ToolCallInfo } from "../types.ts";
import { filterCompatibleMessages } from "./system/filterMessages.ts"; // Filters messages for model compatibility
import { executeTool } from "./executeTool.ts"; // Executes individual tool calls

const MODEL_NAME = "gpt-5-mini";

// Initialize Laminar for observability - this tracks all agent interactions, tool usage, and performance metrics
// Laminar helps monitor and debug agent behavior in production
Laminar.initialize({
    projectApiKey: process.env.LMNR_PROJECT_API_KEY || "",
})

/**
 * Main agent function that handles a single user message and returns the complete conversation
 * This implements the core "agent loop" - the cycle of: message -> model response -> tool calls -> repeat
 * 
 * @param userMessage - The new message from the user
 * @param conversationHistory - Previous messages in this conversation 
 * @param callbacks - Functions to call during processing (for UI updates, logging, etc.)
 * @returns Promise<ModelMessage[]> - All messages including the agent's responses and tool results
 */
export async function runAgent(
  userMessage: string,
  conversationHistory: ModelMessage[],
  callbacks: AgentCallbacks,
): Promise<ModelMessage[]> {
  // Filter messages to ensure compatibility with the model (removes unsupported message types)
  const workingHistory = filterCompatibleMessages(conversationHistory);

  // Build the complete message array that will be sent to the model
  // Structure: [system prompt] + [conversation history] + [new user message]
  const messages: ModelMessage[] = [
    { role: "system", content: SYSTEM_PROMPT }, // Defines how the agent should behave
    ...workingHistory, // Previous conversation context
    { role: "user", content: userMessage }, // The new user input
  ];

  // Track the complete response text for the final callback
  let fullResponse = "";

  // THE MAIN AGENT LOOP
  // This while(true) loop is the heart of the agent - it keeps running until the model
  // gives a final response without requesting any tool calls
  while (true) {
    // STEP 1: Send messages to the language model and start streaming the response
    // We use streamText instead of generateText to get real-time token streaming for better UX
    const result = streamText({
      model: openai(MODEL_NAME),
      messages,
      tools, // Make all available tools accessible to the model
      experimental_telemetry: {
          isEnabled: true,
          tracer: getTracer(), // Track this interaction for observability
      }
    });

    // Initialize tracking variables for this iteration of the loop
    const toolCalls: ToolCallInfo[] = []; // Will store any tool calls the model wants to make
    let currentText = ""; // Text response from the model in this iteration
    let streamError: Error | null = null; // Track any streaming errors

    try {
        // STEP 2: Process the streaming response chunk by chunk
        // The model can stream both text content and tool call requests
        for await (const chunk of result.fullStream) {
            // Handle text content - this is the model's actual response text
            if (chunk.type === "text-delta") {
                currentText += chunk.text;
                callbacks.onToken(chunk.text); // Send to UI immediately for real-time display
            }

            // Handle tool calls - when the model wants to use a tool
            if (chunk.type === "tool-call") {
                const input = "input" in chunk ? chunk.input : {};
                toolCalls.push({
                    toolCallId: chunk.toolCallId, // Unique ID for this tool call
                    toolName: chunk.toolName, // Which tool to execute
                    args: input as Record<string, unknown>, // Arguments for the tool
                });
                // Notify UI that a tool call is starting
                callbacks.onToolCallStart(chunk.toolName, input);
            }
        }
    } catch (error) {
        streamError = error as Error;
        /**
         * Error handling strategy:
         * If we have some text, continue processing (partial success)
         * Otherwise, rethrow if it's not a "no output" error
         */
        if (!currentText && !streamError.message.includes("No output generated")) {
            throw streamError;
        }
    }

    // Accumulate all text from this iteration into the full response
    fullResponse += currentText;

    // Handle complete streaming failure - provide fallback response
    if(streamError && !currentText) {
        // fallback response
        fullResponse = "Sorry, I wasnt able to generate a response. Please try again.";
        callbacks.onToken(fullResponse);
        break; // Exit the agent loop
    }

    // STEP 3: Check if the model is finished or wants to make tool calls
    const finishReason = await result.finishReason;

    // If the model is done (no tool calls requested), we can exit the loop
    if(finishReason !== "tool-calls" || toolCalls.length === 0) {
        const responseMessages = await result.response;
        messages.push(...responseMessages.messages); // Add model's response to conversation
        break; // Exit the agent loop - we have a final response
    }

    // STEP 4: Handle tool calls - the model wants to use tools
    // First, add the model's response (which includes tool call requests) to the conversation
    const responseMessages = await result.response;
    messages.push(...responseMessages.messages);

    // STEP 5: Execute each requested tool and add results back to the conversation
    // This is where the agent actually performs actions in the real world
    for(const toolCall of toolCalls) {
        // Execute the tool with the provided arguments
        const result = await executeTool(toolCall.toolName, toolCall.args);
        
        // Notify UI that tool execution completed
        callbacks.onToolCallEnd(toolCall.toolName, result);
        
        // Add the tool result back to the conversation so the model can see what happened
        // This is crucial - the model needs to see tool results to provide informed responses
        messages.push({
            role: "tool", // Special role for tool results
            content: [
                {
                    type: "tool-result",
                    toolCallId: toolCall.toolCallId, // Links back to the original tool call
                    toolName: toolCall.toolName,
                    output: { type: "text", value: result}, // The actual result from the tool
                }
            ]
        });
    }
    // After adding tool results, the loop continues - the model will see the tool results
    // and can provide a final response or make additional tool calls
  }

  // STEP 6: Agent loop completed - notify that we have a complete response
  callbacks.onComplete(fullResponse);
  
  // Return the complete conversation including all messages, tool calls, and tool results
  // This maintains the full context for future interactions
  return messages;

}
