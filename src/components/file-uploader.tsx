"use client";

type FileUploaderProps = {
  onSelect: (file: File) => void;
  disabled?: boolean;
};

export function FileUploader({
  onSelect,
  disabled = false,
}: FileUploaderProps) {
  return (
    <label className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-700 bg-zinc-900/60 p-8 text-center transition hover:border-zinc-500 hover:bg-zinc-900">
      <input
        type="file"
        accept="audio/*,video/*"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onSelect(file);
          }
        }}
      />

      <span className="text-lg font-semibold text-zinc-100">
        Selecione um áudio ou vídeo
      </span>

      <span className="mt-2 text-sm text-zinc-400">
        Funciona melhor com arquivos menores e áudio mais limpo
      </span>
    </label>
  );
}
