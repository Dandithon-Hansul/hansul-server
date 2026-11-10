export function sse(event: "chunk" | "audio" | "choices" | "done" | "error", data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
