import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let isLoaded = false;

export async function getFFmpeg() {
  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg();
  }

  if (!isLoaded) {
    await ffmpegInstance.load();
    isLoaded = true;
  }

  return ffmpegInstance;
}

export async function extractAudioFromMedia(
  file: File,
  onLog?: (message: string) => void,
) {
  const ffmpeg = await getFFmpeg();

  ffmpeg.on("log", ({ message }) => {
    onLog?.(message);
  });

  const extension = file.name.split(".").pop() || "bin";
  const inputName = `input.${extension}`;
  const outputName = "output.wav";

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  await ffmpeg.exec([
    "-i",
    inputName,
    "-ac",
    "1",
    "-ar",
    "16000",
    "-vn",
    outputName,
  ]);

  const data = await ffmpeg.readFile(outputName);

  if (typeof data === "string") {
    throw new Error(
      "O arquivo de saída veio em formato de texto, não binário.",
    );
  }

  const arrayBuffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer;

  return new Blob([arrayBuffer], { type: "audio/wav" });
}
