export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], {
    type: "text/plain;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

function formatSrtTime(seconds: number) {
  const totalMs = Math.floor(seconds * 1000);
  const ms = totalMs % 1000;

  const totalSeconds = Math.floor(totalMs / 1000);
  const secs = totalSeconds % 60;

  const totalMinutes = Math.floor(totalSeconds / 60);
  const mins = totalMinutes % 60;

  const hours = Math.floor(totalMinutes / 60);

  return (
    [hours, mins, secs]
      .map((value) => String(value).padStart(2, "0"))
      .join(":") + `,${String(ms).padStart(3, "0")}`
  );
}

export function buildSrt(
  chunks: Array<{ text: string; timestamp?: [number, number] }> = [],
) {
  return chunks
    .map((chunk, index) => {
      const start = chunk.timestamp?.[0] ?? 0;
      const end = chunk.timestamp?.[1] ?? start + 2;

      return `${index + 1}
${formatSrtTime(start)} --> ${formatSrtTime(end)}
${chunk.text.trim()}
`;
    })
    .join("\n");
}
