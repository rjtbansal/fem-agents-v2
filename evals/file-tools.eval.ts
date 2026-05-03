

/**
 * File Tools Selection Evaluation
 *
 * Tests whether the LLM correctly selects file-related tools
 * (readFile, writeFile, listFiles, deleteFile) based on user prompts.
 *
 * Categories:
 * - golden: Must select specific expected tools
 * - secondary: Likely selects certain tools, scored on precision/recall
 * - negative: Must NOT select any file tools
 */

import { evaluate } from "@lmnr-ai/lmnr";
import { singleTurnWithMocks } from "./executors";
import type { EvalData, EvalTarget } from "./types";
import dataset from "./data/file-tools.json" with { type: "json" };
import { toolsAvoided, toolsSelected } from "./evaluators.ts";
// Executor that runs single-turn tool selection with mocked tools (no actual execution, just selection)
const executor = async (data: EvalData) => {
    return singleTurnWithMocks(data);
}

// Run the evaluation
evaluate({
    data: dataset as Array<{data: EvalData; target: EvalTarget}>,
    executor,
    evaluators: {
        // For golden prompts, we require perfect tool selection (score of 1 if all expected tools are selected, 0 otherwise)
        toolsSelected: (output, target) => {
            if(target?.category !== "golden") return 1; // Only evaluate on golden prompts
            return toolsSelected(output, target);
        },
        toolsAvoided: (output, target) => {
            if(target?.category !== "negative") return 1; // Only evaluate on negative prompts
            return toolsAvoided(output, target);
        },
        selectionScore: (output, target) => {
            if(target?.category !== "secondary") return 1; // Only evaluate on secondary prompts
            return toolsSelected(output, target);
        },
    },
    config: {
        projectApiKey: process.env.LMNR_PROJECT_API_KEY || "",
    },
    groupName: "file-tools-selection",
});
