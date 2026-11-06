import summary from "@/data/summary.json";

export const REPO = "https://github.com/cherylaurelia/openwork-demo";
export const UPSTREAM = "https://github.com/different-ai/openwork";
export const SOURCE = `${UPSTREAM}/blob/dev/ee/apps/den-api/src/mcp/skills-extension.ts`;

export const bench = summary;

export type Cell = (typeof summary.cells)[number];

export type Run = (typeof summary.runs)[number];

export const MODELS = ["sonnet", "haiku"] as const;

export { findCell, followedShare } from "./bench-logic";

export function logUrl(log: string): string {
  return `${REPO}/blob/main/${log}`;
}
