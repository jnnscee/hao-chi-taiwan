import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";

/**
 * The app icon: Jenny's Bao Bao artwork (public/icon-master.png,
 * 1600×1600 — a smiling steamed bun inside a teal map pin over a
 * Taiwan island outline on deep green), approved 2026-11-23 and
 * served at every size from that one master. The master is a
 * binary committed through the GitHub web UI (the snapshot push
 * cannot carry binaries), and the icon routes are generated at
 * build time, when public/ is on disk to read.
 *
 * The maskable variant pads the artwork down to 80% of the frame:
 * the island outline spans nearly the full height of the master,
 * so an unpadded maskable would let the platform masks crop it.
 * The pad is filled with the master's own background colour,
 * sampled from the committed file — its four corner pixels
 * (#141917 / #151a18 / #121715 / #121715) average to #131816.
 */
const MASTER_BACKGROUND = "#131816";
const MASKABLE_CONTENT = 0.8;

let masterDataUri: string | null = null;

function masterSrc(): string {
  if (!masterDataUri) {
    const bytes = readFileSync(
      path.join(process.cwd(), "public", "icon-master.png")
    );
    masterDataUri = `data:image/png;base64,${bytes.toString("base64")}`;
  }
  return masterDataUri;
}

export function iconImage(size: number, maskable = false) {
  const content = maskable ? Math.round(size * MASKABLE_CONTENT) : size;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: MASTER_BACKGROUND,
        }}
      >
        <img src={masterSrc()} width={content} height={content} alt="" />
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
