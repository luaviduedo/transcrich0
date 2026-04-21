import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;

export type TranscriptChunk = {
  text: string;
  timestamp?: [number, number];
};

export type TranscriptResult = {
  text: string;
  chunks?: TranscriptChunk[];
};

type ASRPipelineOptions = {
  chunk_length_s?: number;
  stride_length_s?: number;
  return_timestamps?: boolean | "word";
  language?: string;
  task?: "transcribe" | "translate";
};

type RawASRResult = {
  text?: string;
  chunks?: Array<{
    text?: string;
    timestamp?: [number, number];
  }>;
};

let pipelineInstance: unknown = null;

export async function getASRPipeline() {
  if (!pipelineInstance) {
    pipelineInstance = await pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-small",
      {
        dtype: "q8",
      },
    );
  }

  return pipelineInstance as (
    audio: Float32Array,
    options?: ASRPipelineOptions,
  ) => Promise<RawASRResult>;
}

async function blobToFloat32Array(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();

  const audioContext = new AudioContext({ sampleRate: 16000 });
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

  const channelData = audioBuffer.getChannelData(0);
  const copied = new Float32Array(channelData.length);
  copied.set(channelData);

  await audioContext.close();

  return copied;
}

function normalizeResult(result: RawASRResult): TranscriptResult {
  return {
    text: result.text ?? "",
    chunks: result.chunks?.map((chunk) => ({
      text: chunk.text ?? "",
      timestamp: chunk.timestamp,
    })),
  };
}

export async function transcribeBlob(blob: Blob): Promise<TranscriptResult> {
  const transcriber = await getASRPipeline();
  const audioData = await blobToFloat32Array(blob);

  const result = await transcriber(audioData, {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
    task: "transcribe",
    language: "portuguese",
  });

  return normalizeResult(result);
}
