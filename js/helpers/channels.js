import { parseEmbeddedJson } from "../utils.js";
import { parseChannelCustomId } from "./channel-id.js";

// Convert the public channel registry (micro.fair.channels) into UI records.
// The on-chain custom_json ID must be preserved; never strip periods or merge IDs.
export function processChannelsData(channelsData) {
  const channelMap = new Map();

  if (Array.isArray(channelsData)) {
    const sorted = [...channelsData].sort(
      (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
    );

    sorted.forEach((op) => {
      const creator = op.required_posting_auths?.[0] || op.required_auths?.[0] || "user";
      const json = parseEmbeddedJson(op.json);
      if (!json || typeof json !== "object") return;

      const id = parseChannelCustomId(json.id || json.channel_id || "");
      if (!id) return;

      const name = String(json.name || json.channel_name || id).trim();
      const description = String(
        json.description || json.desc || `Canal #${id} registrado na Hive`
      ).trim();

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
