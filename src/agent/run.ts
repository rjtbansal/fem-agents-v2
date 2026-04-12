import 'dotenv/config';
import { generateText, tool, type ModelMessage } from 'ai';
import { openai} from '@ai-sdk/openai';
import { tools } from './tools/index';
import { executeTool } from './executeTools';
import { SYSTEM_PROMPT } from './system/prompt';
import type { AgentCallbacks } from '../types';
const MODEL_NAME = 'gpt-5-mini';

// https://publish.obsidian.md/agents-v2/02-Tool-Calling 
export const runAgent = async (userMessage: string, 
    conversationHistory: ModelMessage[], 
    callbacks: AgentCallbacks) => {

        const { text, toolCalls } = await generateText({
            model: openai(MODEL_NAME),
            prompt: userMessage,
            system: SYSTEM_PROMPT,
            tools,
        });

        console.log({ text, toolCalls });

        toolCalls.forEach(async (toolCall) => {
            if (toolCall.toolName === "dateTime") {
                console.log(await executeTool("dateTime", toolCall.input));
            } else {
                console.error(`Unknown toolName: ${toolCall.toolName}`);
            }
        });
    }
// npx tsx src/agent/run.ts -> to run this file directly
runAgent('What happened today and also tell me the date, day and time today?', [], {
    onStart: () => console.log('Agent started'),
    onEnd: () => console.log('Agent ended'),
    onError: (error) => console.error('Agent error:', error),
});