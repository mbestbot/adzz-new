/** Discord default avatar index from user/bot snowflake. See Discord image-formatting docs. */
export function discordDefaultAvatarIndex(discordUserId: string): number {
  try {
    const id = BigInt(discordUserId);
    return Number((id >> BigInt(22)) % BigInt(6));
  } catch {
    return 0;
  }
}

export function discordDefaultAvatarUrl(discordUserId: string): string {
  const i = discordDefaultAvatarIndex(discordUserId);
  return `https://cdn.discordapp.com/embed/avatars/${i}.png`;
}

export function discordCdnAvatarUrl(
  discordUserId: string,
  avatarHash: string | null | undefined,
  size = 64
): string {
  const uid = String(discordUserId ?? "").trim();
  if (avatarHash) {
    const ext = avatarHash.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${uid}/${avatarHash}.${ext}?size=${size}`;
  }
  if (!uid) return discordDefaultAvatarUrl("0");
  return discordDefaultAvatarUrl(uid);
}

export function discordAvatarUrl(
  bot: { discordUserId: string; avatar: string | null | undefined },
  size = 64
): string {
  return discordCdnAvatarUrl(bot.discordUserId, bot.avatar, size);
}
