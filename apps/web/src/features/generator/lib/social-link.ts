/**
 * Mesmos domínios de `SOCIAL_PLATFORMS` do back-end
 * (`apps/api/.../generator/domain/ingest.ts`). Link desses sites não é
 * baixado: o aluno precisa colar a legenda ou a transcrição junto.
 */
const SOCIAL_PLATFORMS = {
  YouTube: ['youtube.com', 'youtu.be'],
  Instagram: ['instagram.com'],
  Facebook: ['facebook.com', 'fb.watch'],
  TikTok: ['tiktok.com'],
} as const;

export type SocialPlatform = keyof typeof SOCIAL_PLATFORMS;

/** O nome da rede social do link, ou `null` (artigo, ou link inválido). */
export function socialPlatformOf(url: string): SocialPlatform | null {
  let host: string;

  try {
    host = new URL(url.trim()).hostname.toLowerCase();
  } catch {
    return null;
  }

  for (const [platform, domains] of Object.entries(SOCIAL_PLATFORMS)) {
    if (
      domains.some((domain) => host === domain || host.endsWith(`.${domain}`))
    ) {
      return platform as SocialPlatform;
    }
  }

  return null;
}
