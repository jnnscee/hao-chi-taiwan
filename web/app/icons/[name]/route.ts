import { iconImage } from "../../iconImage";

/**
 * The extra icon sizes the web app manifest names: /icons/192 (the
 * 192px install icon) and /icons/maskable-512 (the maskable 512px
 * icon). Generated images, like /icon — no binary files in the
 * repo. Anything else here is a 404.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  if (name === "192") return iconImage(192);
  if (name === "maskable-512") return iconImage(512, true);
  return new Response("Not found", { status: 404 });
}
