import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

import type {
  EvalTarget,
  SingleTurnResult,
  MultiTurnTarget,
  MultiTurnResult,
} from "./types.ts";

/**
 * Evaluator: Precision/recall score for tool selection.
 * Returns a score between 0 and 1 based on correct selections.
 * For secondary prompts.
 */
export function toolsSelected(
  output: SingleTurnResult | MultiTurnResult,
  target: EvalTarget | MultiTurnTarget,
): number {
  const expectedTools = "expectedTools" in target
    ? target.expectedTools
    : "expectedToolOrder" in target
    ? target.expectedToolOrder
    : undefined;

    if(!expectedTools?.length) return 1; // If no tools expected, perfect score

    const selected = new Set("toolNames" in output ? output.toolNames : output.toolsUsed);

    return expectedTools.every((tool) => selected.has(tool)) ? 1 : 0; // 1 if all expected tools were selected, otherwise 0
}

/**
 * Evaluator: Check if forbidden tools were avoided.
 * Returns 1 if NONE of the forbidden tools are in the output, 0 otherwise.
 * For negative prompts.
 */

export function toolsAvoided(
  output: SingleTurnResult | MultiTurnResult,
  target: EvalTarget | MultiTurnTarget,
): number {
  if(!target.forbiddenTools?.length) return 1; // If no forbidden tools, perfect score

  const selected = new Set("toolNames" in output ? output.toolNames : output.toolsUsed);

  return target.forbiddenTools.some((tool) => selected.has(tool)) ? 0 : 1; // 0 if any forbidden tool was selected, otherwise 1
}

/**
 * Evaluator: Check if tools were called in the expected order.
 * Returns the fraction of expected tools found in sequence.
 * Order matters but tools don't need to be consecutive.
 */

export function toolOrderCorrect(
  output: MultiTurnResult,
  target: MultiTurnTarget,
): number {
  if(!target.expectedToolOrder?.length) return 1; // If no expected order, perfect score

  const actualOrder = output.toolCallOrder;

  // check if expected tools appear in order (not necessarily consecutively)
  let expectedIndex = 0;
  for (const tool of actualOrder) {
    if (tool === target.expectedToolOrder[expectedIndex]) {
      expectedIndex++;
    }
    if (expectedIndex === target.expectedToolOrder.length) {
      break; // Found all expected tools in order
    }
  }

  return expectedIndex / target.expectedToolOrder.length; // Fraction of expected tools found in correct order
}