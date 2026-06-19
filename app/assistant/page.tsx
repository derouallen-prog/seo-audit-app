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
    <h2 className="text-base font-bold text-black mt-1 mb-3 pb-2 border-b border-gray-200">{children}</h2>
  ),
  h2: ({ children }) => (
    <h3 className="text-sm font-bold text-brand mt-5 mb-2 first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="text-sm font-semibold text-black mt-4 mb-1.5">{children}</h4>
  ),
  p: ({ children }) => <p className="text-sm text-gray-700 leading-relaxed mb-3 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="space-y-1.5 mb-3 ml-1">{children}</ul>,
  ol: ({ children }) => <ol className="space-y-1.5 mb-3 ml-1 list-decimal list-inside">{children}</ol>,
  li: ({ children }) => (
    <li className="text-sm text-gray-700 leading-relaxed flex gap-2">
      <span className="text-brand mt-0.5 shrink-0">•</span>
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }) => <strong className="font-semibold text-black">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-dark underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="bg-gray-100 text-gray-800 rounded px-1.5 py-0.5 text-xs font-mono">{children}</code>
  ),
  hr: () => <hr className="border-gray-200 my-4" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-brand pl-3 text-sm text-gray-600 italic my-3">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-3 rounded-lg border border-gray-200">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-brand text-white">{children}</thead>,
  th: ({ children }) => <th className="text-left font-semibold text-xs uppercase tracking-wide py-2 px-3">{children}</th>,
  td: ({ children }) => <td className="py-2 px-3 text-gray-800 border-b border-gray-100">{children}</td>,
};

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce" />
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
        <h1 className="text-2xl font-bold text-black">Assistant SEO</h1>
        <p className="text-sm text-gray-500">Stratégie, audit, génération d&apos;articles et de fiches produits optimisées SEO.</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "user" ? (
              <div className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 bg-[#7B52C7] text-white text-sm">
                {m.content}
              </div>
            ) : (
              <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 bg-white border border-gray-200 shadow-sm">
                <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                  {m.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-white border border-gray-200 shadow-sm">
              <TypingIndicator />
            </div>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-200 pt-4 flex gap-2">
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
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black placeholder:text-gray-400 resize-none focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-50 text-white px-4 py-2 font-medium transition self-end"
        >
          Envoyer
        </button>
      </div>
    </div>
  );
}
