/** Background-job plumbing (pg-boss) -- public surface. Import via `@/lib/jobs`. */
export {
  RESEARCH_QUEUE,
  getBoss,
  enqueueResearch,
  stopBoss,
  type ResearchJobData,
  type BossRole,
} from "./queue";
export { postAiArtifact, type AiArtifact } from "./artifacts";
