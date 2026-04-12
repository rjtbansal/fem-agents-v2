// create a dateTime tool that returns the current date and time in ISO format
import { tool } from "ai";
import { z } from "zod";

export const dateTimeTool = tool({
    id: "date-time",
    description: "A tool that returns the current date and time. Use this tool before any time or date related questions.",
   inputSchema: z.object({}),
   execute: async () => {
    return new Date().toISOString();
   }
});
