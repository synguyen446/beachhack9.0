"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { ArchitectureDiagram, type ArchNode, type ArchEdge } from "./components/ArchitectureDiagram";

const API_URL = "http://localhost:1000";

const AGENTS = [
  "Project Overview",
  "Requirements",
  "User Stories",
  "System Architecture",
  "API Spec",
  "Data Model",
  "DevOps & Deployment",
  "Testing Strategy",
];

const AGENT_ICONS: Record<string, string> = {
  "Project Overview": "◎",
  Requirements: "≡",
  "User Stories": "♟",
  "System Architecture": "⬡",
  "API Spec": "⇄",
  "Data Model": "⬢",
  "DevOps & Deployment": "⚙",
  "Testing Strategy": "✓",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface GeneratedDoc {
  agent: string;
  markdown: string;
  nodes?: ArchNode[];
  edges?: ArchEdge[];
}

interface Project {
  id: number;
  idea: string;
  created_at: string;
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8z"
      />
    </svg>
  );
}

export default function Home() {
  const [idea, setIdea] = useState("");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [docs, setDocs] = useState<GeneratedDoc[]>([]);
  const [genStatus, setGenStatus] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<GeneratedDoc | null>(null);
  const [activeAgents, setActiveAgents] = useState<Set<string>>(new Set());

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [recentIds, setRecentIds] = useState<number[]>([]);

  const pushRecent = (id: number) => {
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 10);
      localStorage.setItem("docgenix_recent", JSON.stringify(next));
      return next;
    });
    localStorage.setItem("docgenix_last", String(id));
  };

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/projects`);
      const data = await res.json();
      setProjects(data);
      return data as Project[];
    } catch {
      return [];
    }
  }, []);

  const loadProject = useCallback(
    async (id: number, allProjects?: Project[]) => {
      setProjectId(id);
      setChatMessages([]);
      setDocs([]);
      setSelectedDoc(null);
      setGenStatus("");
      pushRecent(id);

      try {
        const [chatRes, docsRes] = await Promise.all([
          fetch(`${API_URL}/projects/${id}/chat`),
          fetch(`${API_URL}/projects/${id}/documents`),
        ]);

        const chatData = await chatRes.json();
        const docsData = await docsRes.json();

        setChatMessages(
          chatData.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        );

        const loadedDocs = docsData.map(
          (d: { agent_name: string; markdown: string; arch_graph?: string }) => {
            const doc: GeneratedDoc = { agent: d.agent_name, markdown: d.markdown };
            if (d.arch_graph) {
              try {
                const g = JSON.parse(d.arch_graph);
                doc.nodes = g.nodes;
                doc.edges = g.edges;
              } catch { /* ignore malformed JSON */ }
            }
            return doc;
          },
        );
        setDocs(loadedDocs);
        if (loadedDocs.length > 0) setSelectedDoc(loadedDocs[0]);

        const pool = allProjects ?? projects;
        const proj = pool.find((p) => p.id === id);
        if (proj) setIdea(proj.idea);
      } catch {
        // ignore
      }
    },
    [projects],
  );

  useEffect(() => {
    const stored = localStorage.getItem("docgenix_recent");
    if (stored) setRecentIds(JSON.parse(stored));

    const lastId = localStorage.getItem("docgenix_last");

    fetchProjects().then((allProjects) => {
      if (lastId && allProjects.length > 0) {
        const id = Number(lastId);
        if (allProjects.some((p: Project) => p.id === id)) {
          loadProject(id, allProjects);
        }
      }
    });
    setMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  if (!mounted) return null;

  async function handleGenerate(agent: string) {
    if (!idea.trim()) return;
    setGenLoading(true);
    setActiveAgents(agent === "all" ? new Set(AGENTS) : new Set([agent]));
    setGenStatus(agent === "all" ? "Running all agents…" : `Running ${agent}…`);

    try {
      const res = await fetch(`${API_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, agent, project_id: projectId }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "project") {
              setProjectId(data.project_id);
              fetchProjects();
            } else if (data.type === "status") {
              setGenStatus(data.message || `Running ${data.agent}…`);
            } else if (data.type === "result") {
              const newDoc: GeneratedDoc = {
                agent: data.agent,
                markdown: data.markdown,
                ...(data.nodes ? { nodes: data.nodes, edges: data.edges } : {}),
              };
              setDocs((prev) => {
                const filtered = prev.filter((d) => d.agent !== data.agent);
                return [...filtered, newDoc];
              });
              setSelectedDoc(newDoc);
              setActiveAgents((prev) => {
                const next = new Set(prev);
                next.delete(data.agent);
                return next;
              });
            } else if (data.type === "error") {
              setGenStatus(`Error: ${data.message}`);
            } else if (data.type === "done") {
              setGenStatus("All documents generated");
              setActiveAgents(new Set());
            }
          } catch {
            // skip non-JSON lines
          }
        }
      }
    } catch (err) {
      setGenStatus(`Error: ${err}`);
    } finally {
      setGenLoading(false);
      setActiveAgents(new Set());
    }
  }

  async function handleChat() {
    if (!chatInput.trim() || projectId === null) return;
    const userMsg = chatInput;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, message: userMsg }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let assistantMsg = "";
      let buffer = "";

      setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "token") {
              assistantMsg += data.content;
              setChatMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantMsg,
                };
                return updated;
              });
            } else if (data.type === "result") {
              const newDoc = { agent: data.agent, markdown: data.markdown };
              setDocs((prev) => {
                const filtered = prev.filter((d) => d.agent !== data.agent);
                return [...filtered, newDoc];
              });
            } else if (data.type === "status") {
              assistantMsg += `\n\n_${data.message}_\n\n`;
              setChatMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantMsg,
                };
                return updated;
              });
            }
          } catch {
            // skip
          }
        }
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function handleNewProject() {
    setProjectId(null);
    setIdea("");
    setChatMessages([]);
    setDocs([]);
    setSelectedDoc(null);
    setGenStatus("");
    setActiveAgents(new Set());
  }

  const completedCount = docs.length;
  const totalAgents = AGENTS.length;

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Header */}
      <header className="border-b border-zinc-800/80 px-6 py-3 flex items-center justify-between bg-zinc-950/90 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm select-none">
            D
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white leading-none">
              DocGenix
            </h1>
            <p className="text-[10px] text-zinc-500 leading-none mt-0.5">
              AI-powered software docs
            </p>
          </div>
        </div>
        {projectId !== null && (
          <span className="text-xs text-zinc-500 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-full">
            Project #{projectId}
          </span>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="w-72 border-r border-zinc-800/80 flex flex-col overflow-hidden shrink-0">
          {/* Projects section */}
          <div className="p-4 border-b border-zinc-800/60">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                Projects
              </span>
              <button
                type="button"
                onClick={handleNewProject}
                className="text-xs px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
              >
                + New
              </button>
            </div>
            {projects.length > 0 ? (
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                {[...projects]
                  .sort((a, b) => {
                    const ai = recentIds.indexOf(a.id);
                    const bi = recentIds.indexOf(b.id);
                    if (ai === -1 && bi === -1) return b.id - a.id;
                    if (ai === -1) return 1;
                    if (bi === -1) return -1;
                    return ai - bi;
                  })
                  .map((proj) => (
                    <button
                      type="button"
                      key={proj.id}
                      onClick={() => loadProject(proj.id)}
                      className={`w-full px-3 py-2 rounded-lg text-xs text-left truncate transition-colors ${
                        projectId === proj.id
                          ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/25"
                          : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-transparent"
                      }`}
                      title={proj.idea}
                    >
                      <span className="text-zinc-600 mr-1.5">#{proj.id}</span>
                      {proj.idea}
                    </button>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-600 italic">No projects yet</p>
            )}
          </div>

          {/* Idea input */}
          <div className="p-4 border-b border-zinc-800/60">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">
              Project Idea
            </label>
            <textarea
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-zinc-200 placeholder:text-zinc-600 transition-colors"
              rows={3}
              placeholder="Describe your software project…"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
            />
          </div>

          {/* Agent buttons */}
          <div className="p-4 flex-1 overflow-y-auto">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
              Generate Docs
            </label>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => handleGenerate("all")}
                disabled={genLoading || !idea.trim()}
                className="w-full px-3 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/30"
              >
                {genLoading ? (
                  <>
                    <Spinner />
                    <span>Running…</span>
                  </>
                ) : (
                  "Run All Agents"
                )}
              </button>

              {/* Progress bar when running */}
              {genLoading && completedCount > 0 && (
                <div className="mt-1">
                  <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                    <span>
                      {completedCount} / {totalAgents} complete
                    </span>
                    <span>
                      {Math.round((completedCount / totalAgents) * 100)}%
                    </span>
                  </div>
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="progress-bar h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                      style={
                        {
                          "--progress-width": `${(completedCount / totalAgents) * 100}%`,
                        } as React.CSSProperties
                      }
                    />
                  </div>
                </div>
              )}

              <div className="border-t border-zinc-800/60 my-1" />

              {AGENTS.map((agent) => {
                const isActive = activeAgents.has(agent);
                const isDone = docs.some((d) => d.agent === agent);
                const doc = docs.find((d) => d.agent === agent);
                const isSelected = selectedDoc?.agent === agent;
                return (
                  <button
                    type="button"
                    key={agent}
                    onClick={() =>
                      isDone && doc
                        ? setSelectedDoc(doc)
                        : handleGenerate(agent)
                    }
                    disabled={
                      isActive || (!isDone && (genLoading || !idea.trim()))
                    }
                    className={`w-full px-3 py-2 rounded-lg text-xs text-left transition-all flex items-center gap-2.5 disabled:cursor-not-allowed ${
                      isSelected
                        ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/25"
                        : isDone
                          ? "bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                          : "bg-zinc-900 border border-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-40"
                    }`}
                  >
                    <span
                      className={`text-base leading-none shrink-0 ${isSelected ? "text-indigo-300" : isDone ? "text-indigo-400" : "text-zinc-600"}`}
                    >
                      {AGENT_ICONS[agent] ?? "•"}
                    </span>
                    <span className="flex-1 truncate">{agent}</span>
                    {isActive && <Spinner />}
                    {isDone && !isActive && (
                      <span
                        className={`text-xs shrink-0 ${isSelected ? "text-indigo-300" : "text-emerald-500"}`}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Status message */}
            {genStatus && (
              <div
                className={`mt-3 text-xs rounded-lg px-3 py-2 border ${
                  genStatus.startsWith("Error")
                    ? "bg-red-950/30 border-red-800/40 text-red-400"
                    : genStatus === "All documents generated"
                      ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-400"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400"
                }`}
              >
                {genStatus}
              </div>
            )}
          </div>
        </div>

        {/* Middle Panel - Doc Viewer */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedDoc ? (
            <>
              {/* Doc header */}
              <div className="px-8 py-4 border-b border-zinc-800/60 shrink-0 flex items-center gap-3 bg-zinc-950">
                <span className="text-xl leading-none text-indigo-400">
                  {AGENT_ICONS[selectedDoc.agent] ?? "•"}
                </span>
                <h2 className="text-sm font-semibold text-zinc-200">
                  {selectedDoc.agent}
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto px-8 py-6">
                {selectedDoc.agent === "System Architecture" && selectedDoc.nodes && selectedDoc.nodes.length > 0 ? (
                  <>
                    <ArchitectureDiagram
                      nodes={selectedDoc.nodes}
                      edges={selectedDoc.edges ?? []}
                    />
                    <details className="mt-4">
                      <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400">
                        View raw markdown
                      </summary>
                      <div className="prose prose-invert prose-sm max-w-3xl prose-headings:text-zinc-100 prose-p:text-zinc-300 prose-li:text-zinc-300 prose-code:text-indigo-300 prose-code:bg-zinc-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 prose-a:text-indigo-400 prose-strong:text-zinc-200 prose-th:text-zinc-300 prose-td:text-zinc-400">
                        <ReactMarkdown>{selectedDoc.markdown}</ReactMarkdown>
                      </div>
                    </details>
                  </>
                ) : (
                  <div className="prose prose-invert prose-sm max-w-3xl prose-headings:text-zinc-100 prose-p:text-zinc-300 prose-li:text-zinc-300 prose-code:text-indigo-300 prose-code:bg-zinc-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 prose-a:text-indigo-400 prose-strong:text-zinc-200 prose-th:text-zinc-300 prose-td:text-zinc-400">
                    <ReactMarkdown>{selectedDoc.markdown}</ReactMarkdown>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 px-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-600/20 border border-indigo-500/20 flex items-center justify-center text-3xl">
                ◎
              </div>
              <div>
                <p className="text-zinc-300 font-medium">
                  No document selected
                </p>
                <p className="text-zinc-600 text-sm mt-1">
                  Describe your project and run an agent to generate docs
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Chat */}
        <div className="w-80 border-l border-zinc-800/80 flex flex-col shrink-0">
          {/* Chat header */}
          <div className="px-4 py-3.5 border-b border-zinc-800/60 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
              <h2 className="text-xs font-semibold text-zinc-300">
                AI Assistant
              </h2>
            </div>
            {projectId === null && (
              <p className="text-[11px] text-amber-500/80 mt-1.5 leading-snug">
                Create or select a project to start chatting
              </p>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 && projectId !== null && (
              <div className="text-center py-8">
                <p className="text-xs text-zinc-600">
                  Ask about your project or request document changes
                </p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[9px] font-bold text-white mr-2 mt-0.5 shrink-0">
                    D
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-zinc-800/80 text-zinc-200 border border-zinc-700/50 rounded-bl-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-invert prose-xs max-w-none prose-p:my-1 prose-li:my-0.5 prose-headings:text-zinc-200 prose-code:text-indigo-300">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[9px] font-bold text-white mr-2 mt-0.5 shrink-0">
                  D
                </div>
                <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="p-3 border-t border-zinc-800/60 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-zinc-200 placeholder:text-zinc-600 transition-colors"
                placeholder={
                  projectId === null
                    ? "Select a project first…"
                    : "Message DocGenix…"
                }
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleChat()}
                disabled={projectId === null || chatLoading}
              />
              <button
                type="button"
                onClick={handleChat}
                disabled={
                  projectId === null || chatLoading || !chatInput.trim()
                }
                className="px-3 py-2.5 rounded-xl text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                title="Send"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
