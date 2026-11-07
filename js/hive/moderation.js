/** Interpret public moderation operations. An operation's custom_id is not
 * proof of administrator authority; only the signed Hive account is. */
import { ADMIN, ADMIN_PMUTE_CUSTOM_ID } from "../config.js";
import { parseEmbeddedJson } from "../utils.js";

export function processMuteData(operations) {
  const result = new Map();
  if (!Array.isArray(operations)) return result;

  // Never mutate the API cache; chronological order makes later actions win.
  const sorted = [...operations].sort(
    (a, b) => new Date(a?.timestamp || 0) - new Date(b?.timestamp || 0)
  );

  for (const op of sorted) {
    if (!op || op.custom_id !== ADMIN_PMUTE_CUSTOM_ID) continue;
    const signers = [
      ...(Array.isArray(op.required_posting_auths) ? op.required_posting_auths : []),
      ...(Array.isArray(op.required_auths) ? op.required_auths : [])
    ];
    if (!signers.includes(ADMIN)) continue;

    const json = parseEmbeddedJson(op.json);
    if (!json || typeof json !== "object") continue;
    const id = json.content_id;
    if (id === null || id === undefined || id === "") continue;
    if (json.type === "mute") {
      result.set(id, {
        cause: typeof json.cause === "string" && json.cause.trim()
          ? json.cause.slice(0, 500) : "Reason not specified",
        admin: ADMIN
      });
    } else if (json.type === "unmute") {
      result.delete(id);
    }
  }
  return result;
}
