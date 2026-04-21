type ProgressStatusProps = {
  step: string;
  details?: string;
};

export function ProgressStatus({ step, details }: ProgressStatusProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-lg">
      <p className="text-sm font-medium text-zinc-100">{step}</p>

      {details ? <p className="mt-1 text-xs text-zinc-400">{details}</p> : null}
    </div>
  );
}
