export function sse(event: "chunk" | "audio" | "done" | "error", data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
