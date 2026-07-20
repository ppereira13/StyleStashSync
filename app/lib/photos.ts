import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const PHOTOS_DIR = path.join(process.cwd(), "data", "photos");

/** Guarda um ficheiro enviado num formulário e devolve o caminho servido pela app. */
export async function savePhoto(file: unknown): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  const ext = (file.name.match(/\.(jpe?g|png|webp|gif|avif)$/i)?.[1] ?? "jpg").toLowerCase();
  const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
  fs.writeFileSync(path.join(PHOTOS_DIR, name), Buffer.from(await file.arrayBuffer()));
  return `/api/photos/${name}`;
}

export function photoFilePath(name: string): string | null {
  // impedir path traversal
  if (!/^[\w.-]+$/.test(name)) return null;
  const full = path.join(PHOTOS_DIR, name);
  return fs.existsSync(full) ? full : null;
}
