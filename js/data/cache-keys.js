// Fresh HiveLine v2 cache keys: do not import any Micro.fair v1 snapshots.
export const POSTS_CACHE_KEY = "hivelineV2PostsCache";
export const VOTES_CACHE_KEY = "hivelineV2VotesCache";
export const MUTES_CACHE_KEY = "hivelineV2MutesCache";
export const BLOCKS_CACHE_KEY = "hivelineV2RelationshipsCache";
export const FOLLOWS_CACHE_KEY = "hivelineV2FollowsCache";
export const CHANNELS_CACHE_KEY = "hivelineV2CommunitiesCache";

export function getChannelPostsCacheKey(channelId) {
  return `hivelineV2ChannelPosts_${channelId}`;
}
export function getUserCacheKey(baseKey, username) {
  return `${baseKey}.${username}`;
}
