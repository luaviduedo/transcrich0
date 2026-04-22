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
  num_beams?: number;
};

type RawASRResult = {
  text?: string;
  chunks?: Array<{
    text?: string;
    timestamp?: [number, number];
  }>;
};

let pipelineInstance: unknown = null;

const TARGET_SAMPLE_RATE = 16000;
const TARGET_PEAK = 0.95;
const HIGHPASS_CUTOFF_HZ = 80;
const LEADING_SILENCE_THRESHOLD = 0.01;
const TRAILING_SILENCE_THRESHOLD = 0.01;
const MIN_SILENCE_SAMPLES = Math.floor(TARGET_SAMPLE_RATE * 0.2);

const GLOSSARY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bvalor ant\b/gi, "Valorant"],
  [/\bnode js\b/gi, "Node.js"],
  [/\breact js\b/gi, "React"],
  [/\btype script\b/gi, "TypeScript"],
  [/\bjava script\b/gi, "JavaScript"],
  [/\bnext js\b/gi, "Next.js"],
];

export async function getASRPipeline() {
  if (!pipelineInstance) {
    pipelineInstance = await pipeline(
      "automatic-speech-recognition",
      "onnx-community/whisper-small",
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

function normalizePeak(
  data: Float32Array,
  targetPeak = TARGET_PEAK,
): Float32Array {
  let peak = 0;

  for (let i = 0; i < data.length; i++) {
    const abs = Math.abs(data[i]);
    if (abs > peak) peak = abs;
  }

  if (peak === 0) {
    return new Float32Array(data);
  }

  const gain = targetPeak / peak;
  const output = new Float32Array(data.length);

  for (let i = 0; i < data.length; i++) {
    output[i] = data[i] * gain;
  }

  return output;
}

function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  const { numberOfChannels, length } = audioBuffer;

  if (numberOfChannels === 1) {
    return new Float32Array(audioBuffer.getChannelData(0));
  }

  const mono = new Float32Array(length);

  for (let ch = 0; ch < numberOfChannels; ch++) {
    const channel = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += channel[i] / numberOfChannels;
    }
  }

  return mono;
}

async function resampleTo16k(
  data: Float32Array,
  originalSampleRate: number,
): Promise<Float32Array> {
  if (originalSampleRate === TARGET_SAMPLE_RATE) {
    return new Float32Array(data);
  }

  const targetLength = Math.ceil(
    (data.length * TARGET_SAMPLE_RATE) / originalSampleRate,
  );
  const offlineContext = new OfflineAudioContext(
    1,
    targetLength,
    TARGET_SAMPLE_RATE,
  );

  const sourceBuffer = offlineContext.createBuffer(
    1,
    data.length,
    originalSampleRate,
  );
  sourceBuffer.copyToChannel(new Float32Array(data), 0);

  const source = offlineContext.createBufferSource();
  source.buffer = sourceBuffer;
  source.connect(offlineContext.destination);
  source.start(0);

  const renderedBuffer = await offlineContext.startRendering();
  return new Float32Array(renderedBuffer.getChannelData(0));
}

async function applyHighPassOffline(
  monoData: Float32Array,
  sampleRate: number,
  cutoffHz = HIGHPASS_CUTOFF_HZ,
): Promise<Float32Array> {
  const offlineContext = new OfflineAudioContext(
    1,
    monoData.length,
    sampleRate,
  );

  const sourceBuffer = offlineContext.createBuffer(
    1,
    monoData.length,
    sampleRate,
  );
  sourceBuffer.copyToChannel(new Float32Array(monoData), 0);

  const source = offlineContext.createBufferSource();
  source.buffer = sourceBuffer;

  const highpass = offlineContext.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = cutoffHz;
  highpass.Q.value = 0.707;

  source.connect(highpass);
  highpass.connect(offlineContext.destination);
  source.start(0);

  const renderedBuffer = await offlineContext.startRendering();
  return new Float32Array(renderedBuffer.getChannelData(0));
}

function trimSilence(
  data: Float32Array,
  threshold = LEADING_SILENCE_THRESHOLD,
  minSilenceSamples = MIN_SILENCE_SAMPLES,
): Float32Array {
  if (data.length === 0) {
    return data;
  }

  let start = 0;
  let end = data.length - 1;

  while (start < data.length) {
    let foundSignal = false;
    const windowEnd = Math.min(start + minSilenceSamples, data.length);

    for (let i = start; i < windowEnd; i++) {
      if (Math.abs(data[i]) > threshold) {
        foundSignal = true;
        break;
      }
    }

    if (foundSignal) break;
    start = windowEnd;
  }

  while (end > start) {
    let foundSignal = false;
    const windowStart = Math.max(end - minSilenceSamples, start);

    for (let i = end; i >= windowStart; i--) {
      if (Math.abs(data[i]) > TRAILING_SILENCE_THRESHOLD) {
        foundSignal = true;
        break;
      }
    }

    if (foundSignal) break;
    end = windowStart - 1;
  }

  if (start >= end) {
    return new Float32Array(data);
  }

  return data.slice(start, end + 1);
}

function cleanupText(text: string): string {
  let output = text;

  output = output.replace(/\s+/g, " ").trim();
  output = output.replace(/\s+([,.;!?])/g, "$1");
  output = output.replace(/([.?!])([A-Za-zÀ-ÿ])/g, "$1 $2");

  for (const [pattern, replacement] of GLOSSARY_REPLACEMENTS) {
    output = output.replace(pattern, replacement);
  }

  if (output.length > 0) {
    output = output.charAt(0).toUpperCase() + output.slice(1);
  }

  return output;
}

function normalizeResult(result: RawASRResult): TranscriptResult {
  const text = cleanupText(result.text ?? "");

  return {
    text,
    chunks: result.chunks?.map((chunk) => ({
      text: cleanupText(chunk.text ?? ""),
      timestamp: chunk.timestamp,
    })),
  };
}

async function blobToFloat32Array(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();

  const audioContext = new AudioContext();
  const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  await audioContext.close();

  const monoData = mixToMono(decoded);
  const resampled = await resampleTo16k(monoData, decoded.sampleRate);
  const filtered = await applyHighPassOffline(resampled, TARGET_SAMPLE_RATE);
  const normalized = normalizePeak(filtered, TARGET_PEAK);
  const trimmed = trimSilence(normalized);

  return new Float32Array(trimmed);
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
    num_beams: 3,
  });

  return normalizeResult(result);
}
