import { avatarImages } from "@/game/avatarImages";

/**
 * Returns the best available image URL for an avatar.
 * Prefers cloud-hosted `image_url` over the legacy static import via `image_path`.
 */
export function getAvatarImageUrl(avatar: {
  image_url?: string | null;
  image_path?: string;
}): string {
  if (avatar.image_url) return avatar.image_url;
  if (avatar.image_path) return avatarImages[avatar.image_path] || "";
  return "";
}
