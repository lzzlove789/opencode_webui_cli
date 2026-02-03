/**
 * Backend-specific type definitions
 */

import type { Runtime } from "./runtime/types.ts";

// Application configuration shared across backend handlers
export interface AppConfig {
  debugMode: boolean;
  runtime: Runtime;
  opencodePath: string;
  opencodeModel?: string;
  // Future configuration options can be added here
}
