import { iconImage } from "../../iconImage";

/**
 * The extra icon sizes the web app manifest names: /icons/192 (the
 * 192px install icon) and /icons/maskable-512 (the maskable 512px
 * icon), generated from the master artwork like /icon — see
 * app/iconImage.tsx. Both are prerendered at build time (the
 * master PNG is read from public/ then, not at request time);
 * anything else here is a 404.
 */
export function generateStaticParams() {
  return [{ name: "192" }, { name: "maskable-512" }];
}

export const dynamicParams = false;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  if (name === "192") return iconImage(192);
  if (name === "maskable-512") return iconImage(512, true);
  return new Response("Not found", { status: 404 });
}
