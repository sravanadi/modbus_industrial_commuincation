import { Play, Terminal, X } from "lucide-react";
import { useStudioStore } from "../stores/useStudioStore";

export function PythonPanel() {
  const {
    pythonOpen,
    setPythonOpen,
    pythonCode,
    setPythonCode,
    pythonRunning,
    pythonResult,
    pythonError,
    runPythonScript,
  } = useStudioStore();

  if (!pythonOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="clay-panel flex h-[80vh] w-full max-w-3xl flex-col gap-3.5 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-4.5 w-4.5 text-emerald-500" />
            <h2 className="text-sm font-bold">Python Automation &amp; Test Runner</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pythonRunning}
              onClick={runPythonScript}
              className="clay-btn-success flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              {pythonRunning ? "Running..." : "Run Python"}
            </button>
            <button
              type="button"
              onClick={() => setPythonOpen(false)}
              className="clay-btn flex h-8 w-8 items-center justify-center"
              aria-label="Close Python Runner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <textarea
          value={pythonCode}
          onChange={(e) => setPythonCode(e.target.value)}
          spellCheck={false}
          className="clay-inset min-h-0 flex-1 resize-none p-3 font-mono-tabular text-xs leading-relaxed outline-none"
        />

        <div className="clay-inset flex h-40 shrink-0 flex-col gap-1 overflow-auto p-3 font-mono-tabular text-[11px]">
          <div className="flex items-center justify-between text-[var(--clay-ink-muted)]">
            <span>Output</span>
            {pythonResult && (
              <span>
                Exit: {pythonResult.exit_code ?? "?"} · {pythonResult.duration_ms} ms
              </span>
            )}
          </div>
          {pythonError && <div className="text-rose-500">{pythonError}</div>}
          {pythonResult?.stdout && (
            <pre className="whitespace-pre-wrap text-emerald-500">{pythonResult.stdout}</pre>
          )}
          {pythonResult?.stderr && (
            <pre className="whitespace-pre-wrap text-rose-500">{pythonResult.stderr}</pre>
          )}
          {!pythonError && !pythonResult && (
            <div className="text-[var(--clay-ink-muted)]">
              Click &quot;Run Python&quot; to execute with your local Python interpreter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
