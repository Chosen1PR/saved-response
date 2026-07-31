import {redis} from "@devvit/web/server";

function getKeyForMod(modUsername: string) {
  return `mod:${modUsername}`;
}

// Helper function to cache the target post or comment ID which the mod is replying to.
export async function cacheTargetId(modUsername: string, id: string) {
  try { await redis.hSet(getKeyForMod(modUsername), { targetId: id }); }
  catch {}
}

// Helper function to get the cached target post or comment ID, given a mod's username.
export async function getCachedTargetId(modUsername: string) {
  try { return await redis.hGet(getKeyForMod(modUsername), 'targetId') ?? ''; }
  catch { return ''; }
}

// Helper function to delete any cached data for a particular mod.
export async function deleteCachedModData(modUsername: string) {
  try { await redis.hDel(getKeyForMod(modUsername), ['targetId']); }
  catch {}
}