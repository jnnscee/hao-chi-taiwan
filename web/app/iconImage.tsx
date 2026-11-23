import { ImageResponse } from "next/og";

/**
 * The app icon, generated at build time (no binary icon files —
 * the GitHub snapshot push cannot carry them): the characters 好吃
 * in the guide's cream on its brown, the same mark at every size.
 * Maskable icons draw the characters smaller, inside the safe zone
 * the platform masks leave visible.
 */
export function iconImage(size: number, maskable = false) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#7a4a12",
          color: "#fffdf8",
          // Two full-width glyphs at ~0.44em each stay on one line
          // with margin to spare; any larger and they wrap and
          // overflow the canvas.
          fontSize: maskable ? size * 0.38 : size * 0.44,
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}
      >
        好吃
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    }
  );
}
