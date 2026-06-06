/**
 * 收集按优先级配置的 Gemini API keys。
 */
export function getGeminiKeys(env: Env) {
  return [
    env.GEMINI_API_KEY,
    env.GEMINI_API_KEY_B,
    env.GEMINI_API_KEY_C,
    env.GEMINI_API_KEY_D
  ].filter(Boolean) as string[];
}
