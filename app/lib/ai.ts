import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { Item } from "./db";

export interface GeneratedListing {
  title: string;
  description: string;
}

const MEDIA_TYPES: Record<string, "image/jpeg" | "image/png" | "image/webp" | "image/gif"> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/** Constrói o bloco de imagem para a API: URL externo ou ficheiro local. */
function imageBlock(photo: string): Anthropic.ImageBlockParam | null {
  if (photo.startsWith("https://")) {
    return { type: "image", source: { type: "url", url: photo } };
  }
  if (photo.startsWith("/api/photos/")) {
    const name = photo.slice("/api/photos/".length);
    if (!/^[\w.-]+$/.test(name)) return null;
    const full = path.join(process.cwd(), "data", "photos", name);
    if (!fs.existsSync(full)) return null;
    const ext = name.split(".").pop()?.toLowerCase() ?? "jpg";
    const mediaType = MEDIA_TYPES[ext];
    if (!mediaType) return null;
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: fs.readFileSync(full).toString("base64"),
      },
    };
  }
  return null;
}

const SCHEMA = {
  type: "object" as const,
  properties: {
    title: {
      type: "string" as const,
      description: "Título do anúncio, máximo 60 caracteres, começa pela marca",
    },
    description: {
      type: "string" as const,
      description: "Descrição completa do anúncio em português de Portugal",
    },
  },
  required: ["title", "description"],
  additionalProperties: false as const,
};

export async function generateListing(item: Item): Promise<GeneratedListing> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "Falta a chave da API: cria o ficheiro app/.env.local com ANTHROPIC_API_KEY=sk-ant-… (obténs uma em console.anthropic.com) e reinicia o servidor.",
    );
  }

  const client = new Anthropic();

  const facts = [
    `Artigo: ${item.name}`,
    item.brand ? `Marca: ${item.brand}` : null,
    item.category ? `Categoria: ${item.category}` : null,
    item.size ? `Tamanho: ${item.size}` : null,
    item.condition ? `Estado: ${item.condition}` : null,
    item.listed_price_cents !== null
      ? `Preço pretendido: ${(item.listed_price_cents / 100).toFixed(2)} €`
      : null,
    item.notes ? `Notas do vendedor (podem incluir defeitos a declarar): ${item.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const content: Anthropic.ContentBlockParam[] = [];
  const img = item.photo ? imageBlock(item.photo) : null;
  if (img) content.push(img);
  content.push({
    type: "text",
    text: `Escreve um anúncio de venda para a Vinted (vinted.pt) para esta peça de roupa em segunda mão.\n\n${facts}\n\nRegras:\n- Português de Portugal, tom simpático e direto, como um vendedor particular experiente.\n- Título: máximo 60 caracteres, começa pela marca, inclui o tipo de peça e um detalhe distintivo (cor, modelo).\n- Descrição: 4 a 8 linhas curtas. Menciona marca, tipo de peça, cor, tamanho e estado. Se as notas indicarem defeitos, declara-os com honestidade (gera confiança). Se houver foto, usa o que vês nela (cor exata, padrão, detalhes). Termina com 3 a 5 hashtags relevantes em linha própria.\n- Não inventes medidas nem materiais que não conheças; se for útil, convida o comprador a pedir medidas.\n- Não uses emojis em excesso (máximo 2 ou 3).`,
  });

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content }],
  });

  const text = response.content.find((b) => b.type === "text");
  if (!text || response.stop_reason === "refusal") {
    throw new Error("O modelo não devolveu um anúncio — tenta outra vez.");
  }
  return JSON.parse(text.text) as GeneratedListing;
}
