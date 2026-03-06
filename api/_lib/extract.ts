export function extractTextFromApteanResponse(json: any): string {
  if (typeof json === "string") return json;

  const p1 = json?.outputs?.[0]?.outputs?.[0]?.results?.output_value?.response?.text;
  if (p1 && typeof p1 === "string") return p1;

  const p2 = json?.outputs?.[0]?.outputs?.[0]?.results?.output_value?.structured_response?.data?.content;
  if (p2 && typeof p2 === "string") return p2;

  const p3 = json?.outputs?.[0]?.outputs?.[0]?.results?.message?.text;
  if (p3 && typeof p3 === "string") return p3;

  const p3b = json?.outputs?.[0]?.outputs?.[0]?.results?.message?.data?.text;
  if (p3b && typeof p3b === "string") return p3b;

  const p4 = json?.outputs?.[0]?.outputs?.[0]?.messages?.[0]?.message;
  if (p4 && typeof p4 === "string") return p4;

  const p5 = json?.outputs?.[0]?.outputs?.[0]?.artifacts?.message;
  if (p5 && typeof p5 === "string") return p5;

  const p6 =
    json?.outputs?.[0]?.message ||
    json?.result ||
    json?.output ||
    json?.text ||
    json?.response ||
    json?.message ||
    null;
  if (p6 && typeof p6 === "string") return p6;
  if (p6 && typeof p6 === "object") return JSON.stringify(p6, null, 2);

  if (Array.isArray(json?.outputs)) {
    for (const output of json.outputs) {
      if (!Array.isArray(output?.outputs)) continue;
      for (const inner of output.outputs) {
        const ovText = inner?.results?.output_value?.response?.text;
        if (ovText && typeof ovText === "string") return ovText;

        const ovContent = inner?.results?.output_value?.structured_response?.data?.content;
        if (ovContent && typeof ovContent === "string") return ovContent;

        const blocks = inner?.results?.output_value?.response?.content_blocks;
        if (Array.isArray(blocks)) {
          for (const block of blocks) {
            for (const content of block?.contents ?? []) {
              if (content?.text && typeof content.text === "string") return content.text;
            }
          }
        }

        const msgBlocks = inner?.results?.message?.content_blocks;
        if (Array.isArray(msgBlocks)) {
          for (const block of msgBlocks) {
            for (const content of block?.contents ?? []) {
              if (content?.text && typeof content.text === "string") return content.text;
            }
          }
        }

        if (inner?.results?.message?.text) return inner.results.message.text;

        for (const msg of inner?.messages ?? []) {
          if (msg?.message && typeof msg.message === "string") return msg.message;
          if (msg?.text && typeof msg.text === "string") return msg.text;
        }

        if (inner?.artifacts?.message) return inner.artifacts.message;
      }
    }
  }

  return JSON.stringify(json, null, 2);
}