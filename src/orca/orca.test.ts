import { describe, expect, test } from "bun:test";
import { orcaCli, OrcaRefusal, type Run } from "./orca.ts";

const UUID = "4e6752bc-cd92-4d4d-b2a3-696f6815f974";

/** Orca exits 1 on a refusal and still prints its JSON reply, which execFile's error carries. */
function exitsOne(reply: unknown): Run {
  return async () => {
    throw Object.assign(new Error("Command failed"), { stdout: JSON.stringify(reply) });
  };
}

async function refusal(run: Run): Promise<unknown> {
  return orcaCli("/", run)(["task-create"]).then(
    () => undefined,
    (error: unknown) => error,
  );
}

describe("orcaCli", () => {
  test("returns the reply's result", async () => {
    const run: Run = async () => JSON.stringify({ ok: true, result: { task: { id: "task_1" } } });

    expect(await orcaCli("/", run)(["task-create"])).toEqual({ task: { id: "task_1" } });
  });

  test("carries the request ID Orca reports when a mutation's outcome is unknown", async () => {
    // The reply's shape follows Orca's orchestration-mutation-recovery: the UUID sits at
    // error.data.orchestrationRequestId.
    const error = await refusal(
      exitsOne({
        ok: false,
        error: { code: "runtime_timeout", message: "timed out", data: { orchestrationRequestId: UUID } },
      }),
    );

    expect(error).toBeInstanceOf(OrcaRefusal);
    expect(error).toMatchObject({
      message: "orca orchestration task-create refused: runtime_timeout: timed out",
      requestId: UUID,
    });
  });

  test("carries no request ID on a refusal Orca states", async () => {
    const error = await refusal(exitsOne({ ok: false, error: { code: "invalid_argument", message: "Unknown flag" } }));

    expect(error).toBeInstanceOf(OrcaRefusal);
    expect(error).toMatchObject({ requestId: undefined });
  });

  test("passes on a failure with no JSON reply as it is", async () => {
    const killed = new Error("killed");

    expect(await refusal(async () => Promise.reject(killed))).toBe(killed);
  });
});
