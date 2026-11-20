import { ImageResponse } from "next/og";
import { hostForCard } from "./host";

const INK = "#14232b";
const FROST = "#f4f7f8";
const LIME = "#d9f24e";
const FONT_CSS = "https://api.fontshare.com/v2/css?f[]=clash-grotesk@500&display=swap";

type FontData = ArrayBuffer | null;
let fontCache: { at: number; data: FontData } | null = null;

async function timedFetch(url: string, ms: number): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(ms) });
}

/** Clash Grotesk 500 as a TTF from Fontshare, or null on any failure (the card then uses the default font). */
async function loadFont(): Promise<FontData> {
  // Keep a success for an hour and a failure for a minute, so a slow CDN never stalls every card.
  if (fontCache && Date.now() - fontCache.at < (fontCache.data ? 3_600_000 : 60_000)) {
    return fontCache.data;
  }
  let data: FontData = null;
  try {
    const css = await (await timedFetch(FONT_CSS, 1500)).text();
    const m = css.match(/url\('?(\/\/cdn\.fontshare\.com\/[^')]+\.ttf)'?\)/);
    if (m) {
      const res = await timedFetch(`https:${m[1]}`, 2000);
      if (res.ok) data = await res.arrayBuffer();
    }
  } catch {
    data = null;
  }
  fontCache = { at: Date.now(), data };
  return data;
}

export async function GET(request: Request) {
  const host = hostForCard(new URL(request.url).searchParams.get("url"));
  const font = await loadFont();
  const size = host.length > 30 ? 56 : host.length > 22 ? 68 : host.length > 14 ? 84 : 100;
  const family = font ? "Clash Grotesk" : "sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: FROST,
          color: INK,
          fontFamily: family,
          fontWeight: 500,
        }}
      >
        <div style={{ display: "flex", marginLeft: 90 }}>
          <svg width="400" height="400" viewBox="8 8 48 48">
            <path fill={LIME} d="M20.4 56H36.4L43.2 8H27.2Z" />
            <path
              fill={INK}
              d="M8 8H22V15H15V49H22V56H8Z M56 8H42V15H49V49H42V56H56Z M25.8 52H32.2L37.8 12H31.4Z"
            />
          </svg>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginLeft: 80,
            marginRight: 70,
            flex: 1,
          }}
        >
          <div style={{ display: "flex", fontSize: 30, letterSpacing: -0.5 }}>
            AI Visibility Checker
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: size,
              lineHeight: 1.05,
              letterSpacing: -2,
              wordBreak: "break-all",
            }}
          >
            {host}
          </div>
          <div style={{ display: "flex", marginTop: 36 }}>
            <div
              style={{
                display: "flex",
                padding: "6px 22px 10px",
                background: LIME,
                color: INK,
                fontSize: 48,
                letterSpacing: -1,
              }}
            >
              AI visibility report
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: font ? [{ name: "Clash Grotesk", data: font, weight: 500, style: "normal" }] : undefined,
      headers: {
        "Cache-Control": font
          ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
          : "public, max-age=60",
      },
    },
  );
}
