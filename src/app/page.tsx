"use client";

import { useMemo, useState } from "react";
import { FileUploader } from "@/components/file-uploader";
import { ProgressStatus } from "@/components/progress-status";
import { TranscriptPanel } from "@/components/transcript-panel";
import { extractAudioFromMedia } from "@/lib/ffmpeg";
import { transcribeBlob, type TranscriptResult } from "@/lib/transcribe";

type Status =
  | "idle"
  | "preparing"
  | "extracting"
  | "transcribing"
  | "done"
  | "error";

export default function HomePage() {
  const [status, setStatus] = useState<Status>("idle");
  const [statusDetails, setStatusDetails] = useState("");
  const [fileName, setFileName] = useState("");
  const [transcript, setTranscript] = useState<TranscriptResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const transcriptText = useMemo(() => transcript?.text ?? "", [transcript]);

  async function handleSelectedFile(file: File) {
    try {
      setStatus("preparing");
      setStatusDetails("Preparando arquivo...");
      setFileName(file.name);
      setErrorMessage("");
      setTranscript(null);

      const isVideo = file.type.startsWith("video/");
      const isAudio = file.type.startsWith("audio/");

      if (!isVideo && !isAudio) {
        throw new Error(
          "Formato inválido. Envie um arquivo de áudio ou vídeo.",
        );
      }

      let audioBlob: Blob;

      if (isVideo) {
        setStatus("extracting");
        setStatusDetails("Extraindo áudio do vídeo...");

        audioBlob = await extractAudioFromMedia(file, (message) => {
          setStatusDetails(message);
        });
      } else {
        audioBlob = file;
      }

      setStatus("transcribing");
      setStatusDetails("Transcrevendo no navegador...");

      const result = await transcribeBlob(audioBlob);

      setTranscript(result);
      setStatus("done");
      setStatusDetails("Transcrição concluída.");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
      );
    }
  }

  async function handleCopyText() {
    if (!transcriptText) return;
    await navigator.clipboard.writeText(transcriptText);
  }

  function getStepLabel() {
    switch (status) {
      case "preparing":
        return "Preparando";
      case "extracting":
        return "Extraindo áudio";
      case "transcribing":
        return "Transcrevendo";
      case "done":
        return "Concluído";
      case "error":
        return "Erro";
      default:
        return "";
    }
  }

  function getStepDetails() {
    if (status === "error") {
      return errorMessage;
    }

    return `${fileName}${statusDetails ? ` — ${statusDetails}` : ""}`;
  }

  const isProcessing =
    status === "preparing" ||
    status === "extracting" ||
    status === "transcribing";

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-50">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="space-y-6">
          <div>
            <p className="mb-3 inline-flex rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
              Transcrich0
            </p>

            <h1 className="text-4xl font-bold tracking-tight">
              Transcreva áudio e vídeo direto no navegador
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
              Envie um arquivo de áudio ou vídeo para gerar a transcrição sem
              depender de API paga.
            </p>
          </div>

          <FileUploader onSelect={handleSelectedFile} disabled={isProcessing} />

          {status !== "idle" && (
            <ProgressStatus step={getStepLabel()} details={getStepDetails()} />
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleCopyText}
              disabled={!transcriptText}
              className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 transition enabled:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Copiar texto
            </button>
          </div>
        </section>

        <section>
          <TranscriptPanel value={transcriptText} />
        </section>
      </div>
    </main>
  );
}
