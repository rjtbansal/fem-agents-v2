import { tools } from "./tools/index.ts";

export type ToolName = keyof typeof tools;

export const executeTool = async (toolName: ToolName, args: any) => {
    const tool = tools[toolName];
    if (!tool) {
        return `Tool ${toolName} not found.`;
    }
    const execute = tool.execute;

    if(!execute) {
        return `Tool ${toolName} is not a registered tool.`;
    }

    const result = await execute(args, {
        toolCallId: '',
        messages: [],
    });

    return String(result);

};
