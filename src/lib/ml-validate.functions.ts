import { createServerFn } from "@tanstack/react-start";

export const validateMlAccount = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; zoneId: string }) => {
    if (!input?.userId || !input?.zoneId) throw new Error("User ID and Zone ID are required");
    if (!/^\d+$/.test(input.userId) || !/^\d+$/.test(input.zoneId)) {
      throw new Error("User ID and Zone ID must be numeric");
    }
    return input;
  })
  .handler(async ({ data }) => {
    try {
      const res = await fetch(
        `https://api.isan.eu.org/nickname/ml?id=${encodeURIComponent(data.userId)}&server=${encodeURIComponent(data.zoneId)}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) return { valid: false as const };
      const json: any = await res.json().catch(() => null);
      const nickname: string | undefined =
        json?.name || json?.nickname || json?.data?.username || json?.username;
      if (!nickname || typeof nickname !== "string") return { valid: false as const };
      // Many providers URL-encode; decode safely
      let decoded = nickname;
      try {
        decoded = decodeURIComponent(nickname.replace(/\+/g, " "));
      } catch {}
      return { valid: true as const, nickname: decoded };
    } catch {
      return { valid: false as const };
    }
  });
