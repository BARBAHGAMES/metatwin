import { describe, expect, it } from "vitest";
import { handlePitchFeedbackSync } from "./pitch-feedback-sync-route.server";

function req(body: unknown): Request {
  return new Request("https://example.test/api/projects/sync-pitch-feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("pitch feedback sync auth gate", () => {
  it("rejects a pitch_scores sync request with no bearer token", async () => {
    const res = await handlePitchFeedbackSync(
      req({ csv_url: "https://docs.google.com/x", project_id: "11111111-1111-1111-1111-111111111111", kind: "pitch_scores" }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects an interviews sync request with no bearer token", async () => {
    const res = await handlePitchFeedbackSync(
      req({ csv_url: "https://docs.google.com/x", project_id: "11111111-1111-1111-1111-111111111111", kind: "interviews" }),
    );
    expect(res.status).toBe(401);
  });
});
