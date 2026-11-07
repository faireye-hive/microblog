import { parseEmbeddedJson } from "../utils.js";
import { normalizeHiveLineChannel, HIVE_APP_ID, HIVE_PROTOCOL_VERSION } from "../hive/registry.js";
import { CHANNELS_CUSTOM_ID } from "../config.js";
import { safeHiveUsername } from "../security/safe-values.js";

// Convert the public HiveLine community registry (hiveline.communities) into UI records.
// The on-chain custom_json ID must be preserved; never strip periods or merge IDs.
export function processChannelsData(channelsData) {
  const channelMap = new Map();

  if (Array.isArray(channelsData)) {
    const sorted = [...channelsData].sort(
      (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
    );

    sorted.forEach((op) => {
      if (op.custom_id !== CHANNELS_CUSTOM_ID) return;
      const creator = safeHiveUsername(
        op.required_posting_auths?.[0] || op.required_auths?.[0]
      );
      // Registry metadata must belong to an identified on-chain signer.
      if (creator === "unknown") return;

      const json = parseEmbeddedJson(op.json);
      if (!json || typeof json !== "object" || Array.isArray(json)) return;
      if (json.type && json.type !== "create_channel" && json.action !== "create_channel") return;

      if (json.app !== HIVE_APP_ID || json.v !== HIVE_PROTOCOL_VERSION) return;
      const id = normalizeHiveLineChannel(json.id || json.channel_id || "");
      if (!id) return;

      const name = String(json.name || json.channel_name || id).trim();
      const description = String(
        json.description || json.desc || `Community #${id} on Hive`
      ).trim();

      const previous = channelMap.get(id);
      // A later operation from a different signer cannot take over the
      // registered channel's name/description in the client directory.
      if (previous && previous.creator !== creator) return;

      if (name) {
        channelMap.set(id, {
          id,
          name,
          description,
          creator,
          timestamp: op.timestamp || json.created_at || new Date().toISOString(),
        });
      }
    });
  }

  return Array.from(channelMap.values());
}
