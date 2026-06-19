"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h2 className="text-base font-semibold text-white mt-1 mb-3 pb-2 border-b border-gray-700">{children}</h2>
  ),
  h2: ({ children }) => (
    <h3 className="text-sm font-semibold text-indigo-400 mt-5 mb-2 first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="text-sm font-medium text-gray-200 mt-4 mb-1.5">{children}</h4>
  ),
  p: ({ children }) => <p className="text-sm text-gray-200 leading-relaxed mb-3 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="space-y-1.5 mb-3 ml-1">{children}</ul>,
  ol: ({ children }) => <ol className="space-y-1.5 mb-3 ml-1 list-decimal list-inside">{children}</ol>,
  li: ({ children }) => (
    <li className="text-sm text-gray-200 leading-relaxed flex gap-2">
      <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="bg-neutral-800 text-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">{children}</code>
  ),
  hr: () => <hr className="border-gray-700 my-4" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-indigo-500 pl-3 text-sm text-gray-400 italic my-3">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-3">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-gray-700">{children}</thead>,
  th: ({ children }) => <th className="text-left text-gray-400 font-medium py-1.5 pr-4">{children}</th>,
  td: ({ children }) => <td className="py-1.5 pr-4 text-gray-200 border-b border-gray-800">{children}</td>,
};

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" />
    </div>
  );
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Bonjour, je suis ton assistant SEO expert. Pose-moi une question stratégique ou technique, ou demande-moi de générer un article de blog ou une fiche produit optimisée SEO.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setLoading(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Erreur lors de la génération");
        return;
      }
      setMessages([...nextMessages, { role: "assistant", content: json.reply }]);
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] max-w-3xl mx-auto">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-white">Assistant SEO</h1>
        <p className="text-sm text-gray-500">Stratégie, audit, génération d&apos;articles et de fiches produits optimisées SEO.</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "user" ? (
              <div className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 bg-indigo-600 text-white text-sm">
                {m.content}
              </div>
            ) : (
              <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 bg-neutral-900 border border-gray-800">
                <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                  {m.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-neutral-900 border border-gray-800">
              <TypingIndicator />
            </div>
          </div>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-800 pt-4 flex gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Pose ta question SEO, ou demande un article / une fiche produit…"
          rows={2}
          className="flex-1 rounded-lg border border-gray-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 font-medium transition self-end"
        >
          Envoyer
        </button>
      </div>
    </div>
  );
}
