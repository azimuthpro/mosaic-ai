import { randomUUID } from "crypto";

/**
 * ExecutionContext tracks the state of an agent chain execution.
 * Used for loop guards, timeout tracking, and cycle detection.
 */
export interface ExecutionContext {
  /** Unique identifier for this execution chain */
  executionId: string;

  /** The agent that started the chain (root of the execution tree) */
  rootAgentId: string;

  /** Current depth in the chain (0-based, root agent is depth 0) */
  currentDepth: number;

  /** Maximum allowed chain depth (default: 5, hard limit: 10) */
  maxDepth: number;

  /** Set of agent IDs visited in this execution chain (for cycle detection) */
  visitedAgents: Set<string>;

  /** Timestamp when execution started (for timeout tracking) */
  startTime: number;

  /** Maximum execution time in milliseconds (default: 300000 = 5 min) */
  timeoutMs: number;

  /** User who initiated the execution */
  userId: string;

  /** Optional parent job ID (for tracking chain relationships) */
  parentJobId?: string;
}

// Default configuration values
export const DEFAULT_MAX_DEPTH = 5;
export const HARD_MAX_DEPTH = 10;
export const DEFAULT_TIMEOUT_MS = 300000; // 5 minutes
export const MAX_TIMEOUT_MS = 600000; // 10 minutes
export const MIN_TIMEOUT_MS = 10000; // 10 seconds

export interface CreateContextOptions {
  rootAgentId: string;
  userId: string;
  maxDepth?: number;
  timeoutMs?: number;
  parentJobId?: string;
}

/**
 * Creates a new ExecutionContext for starting an agent execution chain.
 */
export function createExecutionContext(
  options: CreateContextOptions,
): ExecutionContext {
  const {
    rootAgentId,
    userId,
    maxDepth = DEFAULT_MAX_DEPTH,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    parentJobId,
  } = options;

  // Validate and clamp maxDepth
  const validMaxDepth = Math.min(Math.max(1, maxDepth), HARD_MAX_DEPTH);

  // Validate and clamp timeoutMs
  const validTimeoutMs = Math.min(
    Math.max(MIN_TIMEOUT_MS, timeoutMs),
    MAX_TIMEOUT_MS,
  );

  return {
    executionId: randomUUID(),
    rootAgentId,
    currentDepth: 0,
    maxDepth: validMaxDepth,
    visitedAgents: new Set([rootAgentId]),
    startTime: Date.now(),
    timeoutMs: validTimeoutMs,
    userId,
    parentJobId,
  };
}

/**
 * Creates a child context for a nested agent execution.
 * Increments depth and adds the new agent to visitedAgents.
 */
export function createChildContext(
  parentContext: ExecutionContext,
  childAgentId: string,
  childJobId?: string,
): ExecutionContext {
  // Create a new Set with all parent visited agents plus the child
  const visitedAgents = new Set(parentContext.visitedAgents);
  visitedAgents.add(childAgentId);

  return {
    ...parentContext,
    currentDepth: parentContext.currentDepth + 1,
    visitedAgents,
    parentJobId: childJobId || parentContext.parentJobId,
  };
}

function getElapsedTime(context: ExecutionContext): number {
  return Date.now() - context.startTime;
}

/**
 * Checks if the execution context is still valid (not timed out).
 */
export function isContextValid(context: ExecutionContext): boolean {
  return getElapsedTime(context) < context.timeoutMs;
}

/**
 * Gets the remaining time in milliseconds for this execution.
 */
export function getRemainingTime(context: ExecutionContext): number {
  return Math.max(0, context.timeoutMs - getElapsedTime(context));
}

/**
 * Checks if adding a new agent would create a cycle.
 */
export function wouldCreateCycle(
  context: ExecutionContext,
  agentId: string,
): boolean {
  return context.visitedAgents.has(agentId);
}

/**
 * Checks if we can add another level of depth.
 */
export function canIncreaseDepth(context: ExecutionContext): boolean {
  return context.currentDepth < context.maxDepth;
}

/**
 * Serializable version of ExecutionContext for logging/storage.
 */
export interface SerializedExecutionContext {
  executionId: string;
  rootAgentId: string;
  currentDepth: number;
  maxDepth: number;
  visitedAgents: string[];
  startTime: number;
  timeoutMs: number;
  userId: string;
  parentJobId?: string;
}

/**
 * Serializes an ExecutionContext for storage or logging.
 */
export function serializeContext(
  context: ExecutionContext,
): SerializedExecutionContext {
  return {
    ...context,
    visitedAgents: Array.from(context.visitedAgents),
  };
}

/**
 * Deserializes an ExecutionContext from storage.
 */
export function deserializeContext(
  serialized: SerializedExecutionContext,
): ExecutionContext {
  return {
    ...serialized,
    visitedAgents: new Set(serialized.visitedAgents),
  };
}

/**
 * Error class for execution guard violations.
 */
export class ExecutionGuardError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "TIMEOUT"
      | "MAX_DEPTH"
      | "CYCLE_DETECTED"
      | "RATE_LIMITED",
    public readonly context?: ExecutionContext,
  ) {
    super(message);
    this.name = "ExecutionGuardError";
  }
}

/**
 * Throws an error if the context has timed out.
 */
export function assertNotTimedOut(context: ExecutionContext): void {
  if (!isContextValid(context)) {
    throw new ExecutionGuardError(
      `Execution timeout: exceeded ${context.timeoutMs}ms limit (elapsed: ${getElapsedTime(context)}ms)`,
      "TIMEOUT",
      context,
    );
  }
}

/**
 * Throws an error if the max depth would be exceeded.
 */
export function assertCanIncreaseDepth(context: ExecutionContext): void {
  if (!canIncreaseDepth(context)) {
    throw new ExecutionGuardError(
      `Maximum chain depth exceeded: current depth ${context.currentDepth} >= max ${context.maxDepth}`,
      "MAX_DEPTH",
      context,
    );
  }
}

/**
 * Throws an error if adding the agent would create a cycle.
 */
export function assertNoCycle(
  context: ExecutionContext,
  agentId: string,
): void {
  if (wouldCreateCycle(context, agentId)) {
    throw new ExecutionGuardError(
      `Circular dependency detected: agent ${agentId} has already been visited in this execution chain`,
      "CYCLE_DETECTED",
      context,
    );
  }
}
