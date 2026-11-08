import { interviewDependencies } from "@/lib/interview/dependencies";
import { createInterviewHandlers, interviewFailure } from "@/lib/interview/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try { return await createInterviewHandlers(await interviewDependencies(request)).chat(request); }
  catch (error) { return interviewFailure(error); }
}
