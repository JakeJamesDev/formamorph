Kokoro is a frontier TTS model for its size of 82 million parameters (text in/audio out). This JavaScript library allows the model to be run 100% locally in the browser thanks to 🤗 Transformers.js. Try it out using our online demo!

Usage
First, install the kokoro-js library from NPM using:

npm i kokoro-js
You can then generate speech as follows:

import { KokoroTTS } from "kokoro-js";

const model_id = "onnx-community/Kokoro-82M-v1.0-ONNX";
const tts = await KokoroTTS.from_pretrained(model_id, {
  dtype: "q8", // Options: "fp32", "fp16", "q8", "q4", "q4f16"
  device: "wasm", // Options: "wasm", "webgpu" (web) or "cpu" (node). If using "webgpu", we recommend using dtype="fp32".
});

const text = "Life is like a box of chocolates. You never know what you're gonna get.";
const audio = await tts.generate(text, {
  // Use `tts.list_voices()` to list all available voices
  voice: "af_heart",
});
audio.save("audio.wav");