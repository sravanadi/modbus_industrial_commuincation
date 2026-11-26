import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import {
  Maximize2,
  Minimize2,
  Minus,
  Send,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { useStudioStore } from "../stores/useStudioStore";

interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  actions?: string[];
}

/** Lightweight renderer for markdown tables and inline text without external deps. */
function FormattedReply({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith("|") && i + 1 < lines.length && lines[i + 1].includes("---")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const parseRow = (r: string) =>
        r
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      const headers = parseRow(tableLines[0]);
      const rows = tableLines.slice(2).map(parseRow);
      blocks.push(
        <div key={`tbl-${i}`} className="my-1.5 overflow-x-auto rounded-lg border border-(--clay-ink-muted)/20">
          <table className="w-full border-collapse text-left font-mono-tabular text-[11px]">
            <thead className="bg-(--clay-inset) text-(--clay-ink-muted)">
              <tr>
                {headers.map((h, hi) => (
                  <th key={hi} className="px-2 py-1 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-(--clay-ink-muted)/10">
              {rows.map((cells, ri) => (
                <tr key={ri}>
                  {cells.map((c, ci) => (
                    <td key={ci} className="px-2 py-1">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    blocks.push(
      <div key={`ln-${i}`} className="leading-relaxed">
        {line || "\u00A0"}
      </div>
    );
    i++;
  }

  return <div className="flex flex-col gap-0.5">{blocks}</div>;
}

export function AscAiPanel() {
  const store = useStudioStore();
  const {
    ascAiOpen,
    setAscAiOpen,
    setSettingsOpen,
    aiEndpoint,
    aiModel,
    aiApiKey,
    aiHealth,
    aiHealthMsg,
  } = store;

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [typingText, setTypingText] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typingText]);

  if (!ascAiOpen) return null;

  if (isMinimized) {
    return (
      <div className="fixed right-4 bottom-12 z-50">
        <div className="clay-panel flex items-center gap-2.5 px-3.5 py-2">
          <Sparkles className="h-4 w-4 text-sky-500" />
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="text-xs font-bold"
          >
            ASC AI
          </button>
          <span
            className={`h-2 w-2 rounded-full ${
              aiHealth === "healthy"
                ? "bg-emerald-500"
                : aiHealth === "error"
                  ? "bg-rose-500"
                  : "bg-slate-400"
            }`}
          />
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            title="Restore ASC AI"
            className="clay-btn flex h-6 w-6 items-center justify-center"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setAscAiOpen(false)}
            title="Close ASC AI"
            className="clay-btn flex h-6 w-6 items-center justify-center"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  const executeActions = async (text: string): Promise<string[]> => {
    const executed: string[] = [];
    const matches = [...text.matchAll(/\{[\s\S]*?"action"\s*:\s*"[^"]+"[\s\S]*?\}(?=\s*(?:\n|$|```))/g)];
    for (const m of matches) {
      try {
        const cmd = JSON.parse(m[0]);
        const s = useStudioStore.getState();
        switch (cmd.action) {
          case "set_theme":
            if (
              (cmd.theme === "dark" && s.theme !== "dark") ||
              (cmd.theme === "light" && s.theme !== "light")
            ) {
              s.toggleTheme();
            }
            executed.push(`theme:${cmd.theme}`);
            break;
          case "set_font_size":
            if (typeof cmd.size === "number") s.adjustFontSize(cmd.size - s.fontSize);
            executed.push(`font:${cmd.size}`);
            break;
          case "toggle_section":
            if (
              cmd.section === "showSidebar" ||
              cmd.section === "showInspector" ||
              cmd.section === "showTelemetry"
            ) {
              s.toggleSection(cmd.section);
              executed.push(`toggle:${cmd.section}`);
            }
            break;
          case "start_sim":
            if (!s.simRunning) await s.toggleSlaveSim();
            executed.push("start_sim");
            break;
          case "stop_sim":
            if (s.simRunning) await s.toggleSlaveSim();
            executed.push("stop_sim");
            break;
          case "connect_tcp":
            s.setTransportMode("TCP");
            s.setTcpConfig(cmd.host ?? s.tcpHost, Number(cmd.port) || s.tcpPort);
            await s.connect();
            executed.push(`connect_tcp:${cmd.host ?? s.tcpHost}:${cmd.port ?? s.tcpPort}`);
            break;
          case "disconnect":
            await s.disconnect();
            executed.push("disconnect");
            break;
          case "start_poll":
            await s.startPolling();
            executed.push("start_poll");
            break;
          case "stop_poll":
            await s.stopPolling();
            executed.push("stop_poll");
            break;
          case "set_poll_config":
            if (s.activeWindowId) {
              s.updatePollConfig(s.activeWindowId, {
                slaveId: cmd.slaveId,
                functionCode: cmd.functionCode,
                startAddress: cmd.startAddress,
                quantity: cmd.quantity,
                scanRateMs: cmd.scanRateMs,
              });
              executed.push("set_poll_config");
            }
            break;
          case "write_register":
            if (
              s.activeWindowId &&
              typeof cmd.address === "number" &&
              typeof cmd.value === "number"
            ) {
              await s.writeValue(s.activeWindowId, cmd.address, cmd.value);
              executed.push(`write[${cmd.address}]=${cmd.value}`);
            }
            break;
          case "open_tools":
            s.openTools(cmd.tab ?? "hex");
            executed.push(`open_tools:${cmd.tab ?? "hex"}`);
            break;
          case "apply_register_map":
            if (s.activeWindowId && Array.isArray(cmd.rows)) {
              s.applyRegisterMap(s.activeWindowId, cmd.rows);
              executed.push(`mapped:${cmd.rows.length}`);
            }
            break;
          case "open_settings":
            s.setSettingsOpen(true);
            executed.push("open_settings");
            break;
        }
      } catch {
        // skip invalid action JSON
      }
    }
    return executed;
  };

  const animateReply = (fullText: string, actions: string[]) => {
    let pos = 0;
    const step = Math.max(4, Math.ceil(fullText.length / 60));
    setTypingText("");
    const timer = window.setInterval(() => {
      pos = Math.min(fullText.length, pos + step);
      setTypingText(fullText.slice(0, pos));
      if (pos >= fullText.length) {
        window.clearInterval(timer);
        setTypingText(null);
        setMessages((prev) => [...prev, { role: "assistant", text: fullText, actions }]);
      }
    }, 16);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const userText = prompt.trim();
    if (!userText || loading || typingText !== null) return;

    setPrompt("");
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setLoading(true);

    const activeWin = store.pollWindows.find((w) => w.id === store.activeWindowId);
    const liveRegs = activeWin
      ? activeWin.rows
          .slice(0, 20)
          .map((r) => `${r.address}${r.alias ? `(${r.alias})` : ""}=${r.rawValue ?? "null"}`)
          .join(", ")
      : "none";

    const sysPrompt = `You are ASC AI inside Modbus Studio.
Format EVERY response clearly using:
1. **Statistics Summary**: concise metrics (TX=${store.stats.tx_count}, RX=${store.stats.rx_valid_count}, Errors=${store.stats.crc_errors + store.stats.timeouts + store.stats.exception_count}, Avg=${store.stats.avg_ms}ms, or register min/max/avg).
2. **Table Output**: whenever showing registers, settings, or diagnostics, use a clean Markdown pipe table (| Item | Value | Status |).
3. **Clear Next Step**: short bullet points.

Live App State: theme=${store.theme}, connected=${store.connected}, polling=${store.polling}, simRunning=${store.simRunning}, transport=${store.transportMode}, tcp=${store.tcpHost}:${store.tcpPort}, rtu=${store.rtuPort}@${store.rtuBaud}, activePoll={slaveId:${activeWin?.slaveId}, fc:${activeWin?.functionCode}, start:${activeWin?.startAddress}, qty:${activeWin?.quantity}}, liveData=[${liveRegs}].

To control the app, include one or more JSON objects on their own lines:
{"action":"set_theme","theme":"dark"|"light"}
{"action":"set_font_size","size":14}
{"action":"toggle_section","section":"showSidebar"|"showInspector"|"showTelemetry"}
{"action":"start_sim"} | {"action":"stop_sim"}
{"action":"connect_tcp","host":"127.0.0.1","port":502} | {"action":"disconnect"}
{"action":"start_poll"} | {"action":"stop_poll"}
{"action":"set_poll_config","slaveId":3,"functionCode":3,"startAddress":0,"quantity":10,"scanRateMs":1000}
{"action":"write_register","address":0,"value":123}
{"action":"open_tools","tab":"hex"|"scan"|"graph"|"sim"|"calc"|"alarms"}
{"action":"apply_register_map","rows":[{"address":0,"alias":"Voltage L1","scale":0.1,"unit":"V"}]}
{"action":"open_settings"}`;

    try {
      const bodyJson = JSON.stringify({
        model: aiModel.trim() || "auto",
        messages: [
          { role: "system", content: sysPrompt },
          ...messages.slice(-6).map((m) => ({ role: m.role, content: m.text })),
          { role: "user", content: userText },
        ],
      });

      const rawText = await invoke<string>("asc_ai_chat", {
        endpoint: aiEndpoint.trim(),
        apiKey: aiApiKey.trim(),
        bodyJson,
      });

      const data = JSON.parse(rawText);
      const reply =
        data?.choices?.[0]?.message?.content ??
        data?.response ??
        data?.message ??
        rawText;

      const actions = await executeActions(String(reply));
      setLoading(false);
      animateReply(String(reply), actions);
    } catch (err) {
      setLoading(false);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `API Error: ${String(err)}` },
      ]);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs ${
        isFullscreen ? "p-0" : "p-4"
      }`}
    >
      <div
        className={`clay-panel flex flex-col gap-3 p-5 ${
          isFullscreen ? "h-screen w-screen rounded-none!" : "h-[82vh] w-full max-w-3xl"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4.5 w-4.5 text-sky-500" />
            <h2 className="text-sm font-bold">ASC AI</h2>
            <span
              className={`clay-inset px-2.5 py-0.5 font-mono-tabular text-[11px] font-semibold ${
                aiHealth === "healthy"
                  ? "text-emerald-500"
                  : aiHealth === "error"
                    ? "text-rose-500"
                    : "text-(--clay-ink-muted)"
              }`}
            >
              {aiHealth === "healthy"
                ? `● ${aiHealthMsg}`
                : aiHealth === "error"
                  ? "● Error (check Settings)"
                  : `● ${aiModel} (Untested)`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              title="Configure AI Provider in Settings"
              className="clay-btn flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold"
            >
              <Settings className="h-3.5 w-3.5 text-sky-500" />
              API Settings
            </button>
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="clay-btn flex h-8 w-8 items-center justify-center"
              title="Minimize ASC AI"
              aria-label="Minimize ASC AI"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen((f) => !f)}
              className="clay-btn flex h-8 w-8 items-center justify-center"
              title={isFullscreen ? "Exit Full Screen" : "Full Screen"}
              aria-label={isFullscreen ? "Exit Full Screen" : "Full Screen"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setAscAiOpen(false)}
              className="clay-btn flex h-8 w-8 items-center justify-center"
              aria-label="Close ASC AI"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Chat History */}
        <div
          ref={scrollRef}
          className="clay-inset flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-3 text-xs"
        >
          {messages.length === 0 && typingText === null ? (
            <div className="my-auto text-center text-(--clay-ink-muted)">
              Configure &amp; test your AI endpoint in <strong>API Settings</strong>, then ask ASC AI for register tables, bus statistics, or app commands.
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-xl p-2.5 ${
                    m.role === "user"
                      ? "ml-10 bg-sky-500/15"
                      : "mr-10 bg-(--clay-surface-elevated)"
                  }`}
                >
                  <div className="mb-1 text-[10px] font-bold uppercase text-(--clay-ink-muted)">
                    {m.role === "user" ? "You" : "ASC AI"}
                  </div>
                  {m.role === "assistant" ? (
                    <FormattedReply text={m.text} />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans leading-relaxed">{m.text}</pre>
                  )}
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {m.actions.map((a, idx) => (
                        <span
                          key={idx}
                          className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono-tabular text-[10px] font-semibold text-emerald-500"
                        >
                          ✓ {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {typingText !== null && (
                <div className="mr-10 rounded-xl bg-(--clay-surface-elevated) p-2.5">
                  <div className="mb-1 text-[10px] font-bold uppercase text-(--clay-ink-muted)">
                    ASC AI
                  </div>
                  <FormattedReply text={typingText + "▌"} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Prompt Input */}
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask ASC AI for register table, stats, or commands…"
            className="clay-inset flex-1 px-3 py-2 text-xs outline-none"
          />
          <button
            type="submit"
            disabled={loading || typingText !== null}
            className="clay-btn-primary flex items-center gap-1.5 px-4 py-2 text-xs font-semibold disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {loading ? "Thinking…" : typingText !== null ? "Typing…" : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
