"use server";

import { exportToGoogleSheets } from "@/lib/sheets";
import { exportMontra } from "@/lib/montra";

export async function exportSheets(): Promise<{ ok: boolean; message: string }> {
  try {
    const { items, expenses } = await exportToGoogleSheets();
    return {
      ok: true,
      message: `Exportados ${items} artigos e ${expenses} despesas para as abas "App Artigos" / "App Despesas".`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Erro ao exportar para o Google Sheets.",
    };
  }
}

export async function exportSite(): Promise<{ ok: boolean; message: string }> {
  try {
    const { pecas } = await exportMontra();
    return {
      ok: true,
      message:
        pecas > 0
          ? `Montra do site atualizada com ${pecas} peça${pecas === 1 ? "" : "s"} (entram artigos em stock ou à venda que tenham foto).`
          : "Montra atualizada, mas vazia: nenhum artigo em stock tem foto. Adiciona fotos em Artigos → Editar…",
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Erro ao atualizar o site da loja.",
    };
  }
}
