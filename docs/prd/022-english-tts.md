# PRD-022: 英文语音朗读

> **状态：方案草案**

## 1. 背景与目标

Leaf AI Reader 已使用系统 TTS 朗读中文。英文朗读的音质受设备和浏览器提供的系统音色影响。评估 Kokoro‑82M v1.0 作为浏览器端英文 TTS，目标是提供适合长时间听读的美式英语音色，并沿用系统 TTS 朗读中文。

## 2. 方案范围

- 英文正文在用户设备上合成，首期评估一个美式英语音色 `af_heart`。
- 采用逐句合成，句级高亮作为首期同步目标。逐词高亮和流式合成留待后续评估。
- 首次使用需要获取模型、音色和运行依赖。模型下载进度应可感知。资源在本地齐备后，已取得的英文正文可以离线合成和播放。
- 模型和 ONNX 发布版本采用 Apache 2.0，端侧合成无需按用量支付模型或 API 费用。模型分发仍有带宽成本。

## 3. 候选配置

| 项目 | 评估方案 |
| --- | --- |
| 浏览器库 | `kokoro-js` |
| 模型 | `onnx-community/Kokoro-82M-v1.0-ONNX` |
| 首选评估 | WASM 在 CPU 上运行，搭配约 92.4 MB 的 `q8` 模型 |
| 音质基准 | WebGPU Demo 使用的 `fp32` 模型约 326 MB，可作为音质对照 |

## 4. 待验证

- 用相同音色和英文正文比较量化版本和原版的发音、停顿及长时间听读体验。
- 在桌面和移动端目标浏览器评估首次下载耗时、缓存复用、单句合成耗时和连续朗读的句间停顿，再决定是否评估 WebGPU。
- 断网验证资源齐备后的英文朗读能力。书库和章节的离线访问由各自的产品范围决定。

## 5. 参考资料

- [Kokoro 模型说明与许可证](https://huggingface.co/hexgrad/Kokoro-82M)
- [ONNX 模型文件和大小](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/tree/main/onnx)
- [kokoro-js 使用文档](https://www.npmjs.com/package/kokoro-js#usage)
- [Kokoro 美式英语音色](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md#american-english)
