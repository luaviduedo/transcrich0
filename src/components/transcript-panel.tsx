type TranscriptPanelProps = {
  value: string;
};

export function TranscriptPanel({ value }: TranscriptPanelProps) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Transcrição</h2>
      </div>

      <textarea
        readOnly
        value={value}
        className="min-h-[320px] w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-100 outline-none"
      />
    </div>
  );
}
