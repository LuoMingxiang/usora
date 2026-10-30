import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";

export type PortabilityProcessResult = {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  outputLimitExceeded: boolean;
};

type ProcessControls = { write: (input: string) => void; stop: () => void };
type ProcessOptions = {
  cwd: string;
  env: NodeJS.ProcessEnv;
  input?: string;
  timeoutMs?: number;
  killGraceMs?: number;
  maxOutputBytes?: number;
  keepStdinOpen?: boolean;
  onStdout?: (text: string, controls: ProcessControls) => void;
};

/** Run only acceptance subprocesses; never let a host or its inherited pipes hold the demo open indefinitely. */
export function runPortabilityProcess(
  command: string,
  args: string[],
  options: ProcessOptions,
): Promise<PortabilityProcessResult> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const killGraceMs = options.killGraceMs ?? 250;
  const maxOutputBytes = options.maxOutputBytes ?? 4 * 1024 * 1024;
  for (const [name, value] of Object.entries({ timeoutMs, killGraceMs, maxOutputBytes })) {
    if (!Number.isSafeInteger(value) || value <= 0) throw Error(`${name} must be a positive safe integer`);
  }
  return new Promise((resolve, reject) => {
    const processGroup = process.platform !== "win32";
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      detached: processGroup,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const decoder = new StringDecoder("utf8");
    let retainedBytes = 0;
    let timedOut = false;
    let outputLimitExceeded = false;
    let stopping = false;
    let settled = false;
    let failure: Error | undefined;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    let drainTimer: ReturnType<typeof setTimeout> | undefined;

    function signal(signalName: NodeJS.Signals): void {
      if (!child.pid) return;
      try {
        // Each POSIX child owns a fresh group, so ordinary descendants holding
        // stdout/stderr are killed even after the direct child has exited.
        if (processGroup) process.kill(-child.pid, signalName);
        else child.kill(signalName);
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === "ESRCH")) {
          failure ||= error instanceof Error ? error : Error(String(error));
        }
      }
    }

    function finish(code: number | null): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      clearTimeout(killTimer);
      clearTimeout(drainTimer);
      // A successful direct child may leave background descendants without
      // inherited pipes; they still belong to this acceptance invocation.
      signal("SIGKILL");
      child.stdin.destroy();
      child.stdout.destroy();
      child.stderr.destroy();
      if (failure) reject(failure);
      else
        resolve({
          code: timedOut || outputLimitExceeded ? -1 : (code ?? -1),
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: Buffer.concat(stderr).toString("utf8"),
          timedOut,
          outputLimitExceeded,
        });
    }

    function stop(): void {
      if (stopping || settled) return;
      stopping = true;
      child.stdin.end();
      signal("SIGTERM");
      killTimer = setTimeout(() => {
        signal("SIGKILL");
        // A broken/escaped descendant must not retain pipe handles in this
        // parent indefinitely after the owned process group has been killed.
        drainTimer = setTimeout(() => finish(-1), killGraceMs);
      }, killGraceMs);
    }

    const controls: ProcessControls = {
      write(input) {
        if (!stopping && !settled) child.stdin.write(input);
      },
      stop,
    };
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      stop();
    }, timeoutMs);

    function capture(chunk: Buffer, target: Buffer[], isStdout: boolean): void {
      if (settled) return;
      const remaining = maxOutputBytes - retainedBytes;
      if (remaining > 0) {
        const kept = chunk.subarray(0, remaining);
        target.push(kept);
        retainedBytes += kept.length;
      }
      if (chunk.length > remaining) {
        outputLimitExceeded = true;
        stop();
      } else if (isStdout && options.onStdout && !stopping) {
        try {
          options.onStdout(decoder.write(chunk), controls);
        } catch (error) {
          failure = error instanceof Error ? error : Error(String(error));
          stop();
        }
      }
    }
    child.stdout.on("data", (chunk: Buffer) => capture(chunk, stdout, true));
    child.stderr.on("data", (chunk: Buffer) => capture(chunk, stderr, false));
    child.once("error", (error) => {
      failure = error;
      stop();
      if (!child.pid) finish(-1);
    });
    child.once("close", (code) => finish(code));
    child.stdin.on("error", (error: NodeJS.ErrnoException) => {
      // A command may legitimately exit without reading all provided stdin.
      if (error.code !== "EPIPE" && error.code !== "ERR_STREAM_DESTROYED") {
        failure = error;
        stop();
      }
    });
    if (options.keepStdinOpen) {
      if (options.input) child.stdin.write(options.input);
    } else child.stdin.end(options.input ?? "");
  });
}
