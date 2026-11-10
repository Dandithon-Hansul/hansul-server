import { interviewDependencies } from "@/lib/interview/dependencies";
import { createInterviewHandlers, interviewFailure } from "@/lib/interview/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const started = performance.now();
  try {
    const dependencies = await interviewDependencies(request);
    const auth_ms = Math.round(performance.now() - started);
    const response = await createInterviewHandlers(dependencies).analyze(request);
    console.info("recipe analysis request timing", { auth_ms, total_ms: Math.round(performance.now() - started), status: response.status });
    return response;
  }
  catch (error) { return interviewFailure(error); }
}
