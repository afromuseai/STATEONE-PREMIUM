import { z } from "zod";

/**
 * PendingIntent — single source of truth for the "user confirmed a workspace
 * action" handoff between the Copilot client and the API server.
 *
 * Written by the client to sessionStorage when Marcus opens a generator
 * workspace and stages an idea. Read back (non-destructively via peek, or
 * destructively via consume) both by the generator pages themselves and by
 * the Copilot panel, which forwards it to the server as part of
 * `workspaceContext.pendingIntent` so the server knows which engine a bare
 * "yes" confirmation applies to.
 *
 * Every producer and consumer (client sessionStorage read/write, client
 * network payload, server WorkspaceContextSchema) must import this schema —
 * do not redeclare this shape locally.
 */
export const PendingIntentSchema = z.object({
  type: z.enum(["website", "chatbot", "automation", "bi", "orchestrator"]),
  idea: z.string(),
  timestamp: z.number(),
});

export type PendingIntent = z.infer<typeof PendingIntentSchema>;
