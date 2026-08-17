/** @module-kind pure */
/**
 * Hook de captura offline-first de uma inspeção (INSP.3).
 *
 * Wrapper fino em `useOfflineRecord` que conhece o shape de inspeção e
 * expõe operações de domínio: responder pergunta, anexar foto, concluir.
 * Toda a infraestrutura (IndexedDB, sync_queue, media_queue, backoff) vem
 * do motor genérico — esse hook só costura.
 */
import { useCallback, useMemo } from "react";
import { useOfflineRecord } from "@/lib/offline/useOfflineRecord";
import { enqueueMedia } from "@/lib/offline/media-queue";
import { compressImage } from "@/lib/offline/compress-image";
import { calcularScore, type ModeloTemplate, type RespostasMap } from "./modelos";
import {
  inspecaoToMutations,
  reconcilarNcs,
  type InspecaoData,
  type InspecaoRespostaLocal,
} from "./offline";

export interface UseInspecaoOfflineArgs {
  /** Chave estável: inspecao:<obraId>:<modeloCodigo>:<localOuData> */
  key: string;
  modelo: ModeloTemplate;
  /** UUID da pergunta no banco para cada tempId do modelo. */
  perguntaIdPorTempId: Record<string, string>;
  initial: InspecaoData;
  createdBy: string;
}

export function useInspecaoOffline({
  key,
  modelo,
  perguntaIdPorTempId,
  initial,
  createdBy,
}: UseInspecaoOfflineArgs) {
  const toMutations = useCallback(
    (d: InspecaoData) => {
      const mapAtual: RespostasMap = {};
      for (const r of Object.values(d.respostas)) {
        mapAtual[r.perguntaTempId] =
          r.conformidade ?? r.resposta_opcao ?? r.resposta_texto ?? r.resposta_numero;
      }
      const s = calcularScore(modelo, mapAtual);
      return inspecaoToMutations(d, { modelo, createdBy, score: s });
    },
    [modelo, createdBy],
  );

  const record = useOfflineRecord<InspecaoData>({
    key,
    initial,
    toMutations,
  });

  const { data, setData } = record;

  const respostasMap: RespostasMap = useMemo(() => {
    const m: RespostasMap = {};
    for (const r of Object.values(data.respostas)) {
      m[r.perguntaTempId] =
        r.conformidade ?? r.resposta_opcao ?? r.resposta_texto ?? r.resposta_numero;
    }
    return m;
  }, [data.respostas]);

  const score = useMemo(() => calcularScore(modelo, respostasMap), [modelo, respostasMap]);

  const responder = useCallback(
    (
      perguntaTempId: string,
      patch: Partial<Omit<InspecaoRespostaLocal, "id" | "perguntaId" | "perguntaTempId">>,
    ) => {
      setData((prev) => {
        const existente = Object.values(prev.respostas).find(
          (r) => r.perguntaTempId === perguntaTempId,
        );
        const perguntaId = perguntaIdPorTempId[perguntaTempId];
        if (!perguntaId) {
          // Sem UUID mapeado (modelo ainda não semeado) — ignora silenciosamente.
          return prev;
        }
        const nova: InspecaoRespostaLocal = {
          id: existente?.id ?? crypto.randomUUID(),
          perguntaId,
          perguntaTempId,
          ...existente,
          ...patch,
        };
        const respostas = { ...prev.respostas, [nova.id]: nova };
        const ncs = reconcilarNcs(modelo, respostas, prev.ncs, prev.local);
        return { ...prev, respostas, ncs };
      });
    },
    [perguntaIdPorTempId, modelo, setData],
  );

  const addFoto = useCallback(
    async (perguntaTempId: string, file: File, legenda?: string) => {
      const resposta = Object.values(data.respostas).find(
        (r) => r.perguntaTempId === perguntaTempId,
      );
      if (!resposta) return;
      const fotoId = crypto.randomUUID();
      const blob = await compressImage(file);
      const ext =
        blob.type === "image/jpeg" ? "jpg" : (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${data.inspecao_id}/${fotoId}.${ext}`;
      await enqueueMedia({
        id: fotoId,
        bucket: "inspecoes-fotos",
        path,
        blob,
        contentType: blob.type || "image/jpeg",
        parentTable: "inspecao_fotos",
        parentId: fotoId,
        parentColumn: "storage_path",
      });
      setData((prev) => ({
        ...prev,
        fotos: [...prev.fotos, { id: fotoId, respostaId: resposta.id, path, legenda }],
      }));
    },
    [data.inspecao_id, data.respostas, setData],
  );

  const concluir = useCallback(async () => {
    setData((prev) => ({ ...prev, status: "concluida" }));
    await record.commit();
  }, [record, setData]);

  return { ...record, responder, addFoto, concluir, score };
}
