// Preserve existing localStorage keys so that users keep their cached data.
export const POSTS_CACHE_KEY = "hiveAppPostsCache";
export const VOTES_CACHE_KEY = "hiveAppVotesCache";
export const MUTES_CACHE_KEY = "hiveAppMutesCache";
export const BLOCKS_CACHE_KEY = "hiveAppBlocksCache";
export const FOLLOWS_CACHE_KEY = "hiveAppFollowsCache";
export const CHANNELS_CACHE_KEY = "hiveAppChannelsCache";

export function getChannelPostsCacheKey(channelId) {
  return `hiveAppChannelPosts_${channelId}`;
}
export function getUserCacheKey(baseKey, username) {
  return `${baseKey}.${username}`;
}
