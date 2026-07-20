import fs from "node:fs";
import { NextRequest } from "next/server";
import { photoFilePath } from "@/lib/photos";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const full = photoFilePath(name);
  if (!full) return new Response("Not found", { status: 404 });
  const ext = name.split(".").pop()?.toLowerCase() ?? "jpg";
  return new Response(new Uint8Array(fs.readFileSync(full)), {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
