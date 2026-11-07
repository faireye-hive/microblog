// The custom_json operation ID is the storage namespace on Hive.
// Never slugify it: "hive.micro" and "hivemicro" are DIFFERENT namespaces.
export const MAX_HIVE_CUSTOM_JSON_ID_LENGTH = 32;
const VALID_CHANNEL_ID = /^[a-z0-9._-]+$/;

/**
 * Validate a channel custom_json ID without removing meaningful characters.
 * Returns "" for unsupported/oversized input; only normalizes case and outer whitespace.
 */
export function parseChannelCustomId(input) {
  if (typeof input !== "string") return "";
  const id = input.trim().toLowerCase();
  return (
    id.length > 0 &&
    id.length <= MAX_HIVE_CUSTOM_JSON_ID_LENGTH &&
    VALID_CHANNEL_ID.test(id)
  ) ? id : "";
}
