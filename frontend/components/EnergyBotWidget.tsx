"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Send, X, Loader2, Bot, Trash2 } from "lucide-react";
import { useChatContext } from "@/lib/chatStore";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function EnergyBotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contextData = useChatContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al final cuando hay nuevos mensajes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleClear = () => setMessages([]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: trimmed };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          contextData
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      // Leer streaming del body
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No readable stream");

      const decoder = new TextDecoder();
      let assistantContent = "";
      const assistantId = (Date.now() + 1).toString();

      // Añadir mensaje vacío del asistente
      setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m)
        );
      }
    } catch (err) {
      console.error("Error en chat:", err);
      setError("Error al contactar con la IA. Por favor, reintenta.");
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, isLoading, contextData]);

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="energybot-fab"
        style={{
          position: "fixed",
          bottom: "30px",
          right: "30px",
          width: "60px",
          height: "60px",
          borderRadius: "50%",
          backgroundColor: "#fff",
          boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
          border: "none",
          cursor: "pointer",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          transform: isOpen ? "scale(0) rotate(90deg)" : "scale(1) rotate(0deg)",
          overflow: "hidden"
        }}
      >
        <img 
          src="/images/energybot.png" 
          alt="EnergyBot" 
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('style');
          }}
        />
        <Bot size={32} color="var(--color-primary)" style={{ display: 'none' }} />
      </button>

      {/* Ventana de Chat */}
      <div 
        className="energybot-window"
        style={{
          position: "fixed",
          bottom: "30px",
          right: "30px",
          width: "360px",
          height: "550px",
          maxHeight: "80vh",
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(12px)",
          borderRadius: "20px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          border: "1px solid rgba(0,0,0,0.1)",
          display: "flex",
          flexDirection: "column",
          zIndex: 9998,
          transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          transform: isOpen ? "translateY(0) scale(1)" : "translateY(20px) scale(0.9)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          overflow: "hidden"
        }}
      >
        {/* Cabecera */}
        <div style={{ 
          background: "linear-gradient(135deg, var(--color-primary), var(--color-secondary))", 
          padding: "16px", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between",
          color: "white"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#fff", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src="/images/energybot.png" alt="Bot" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "15px", letterSpacing: "0.5px" }}>EnergyBot</div>
              <div style={{ fontSize: "11px", opacity: 0.8, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, background: "#4ade80", borderRadius: "50%", display: "inline-block" }} />
                En línea · IA Activa
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {messages.length > 0 && (
              <button onClick={handleClear} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", padding: 4 }} title="Limpiar chat">
                <Trash2 size={18} />
              </button>
            )}
            <button onClick={() => setIsOpen(false)} style={{ background: "transparent", border: "none", color: "white", cursor: "pointer", padding: 4 }}>
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Mensajes */}
        <div style={{ flex: 1, padding: "16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", backgroundColor: "#f8fafc" }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", margin: "auto", color: "var(--color-text-muted)" }}>
              <Bot size={48} style={{ opacity: 0.2, margin: "0 auto 12px" }} />
              <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: 8, color: "var(--color-secondary)" }}>Hola, soy EnergyBot 👋</h3>
              <p style={{ fontSize: "12px", lineHeight: 1.5 }}>
                Estoy leyendo los datos que tienes en pantalla.<br/>
                Pregúntame sobre la producción, empresas o métricas clave.
              </p>
            </div>
          )}

          {messages.map(m => (
            <div key={m.id} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              background: m.role === 'user' ? 'var(--color-primary)' : '#ffffff',
              color: m.role === 'user' ? '#ffffff' : 'var(--color-text-primary)',
              padding: '12px 16px',
              borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
              fontSize: '13px',
              lineHeight: 1.5,
              border: m.role === 'user' ? 'none' : '1px solid var(--color-border)',
              whiteSpace: "pre-wrap"
            }}>
              <span dangerouslySetInnerHTML={{ __html: (m.content || "").replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
          ))}

          {isLoading && (
            <div style={{ alignSelf: 'flex-start', background: '#ffffff', padding: '12px 16px', borderRadius: '16px 16px 16px 4px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 size={14} className="energybot-spin" color="var(--color-primary)" />
              <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Pensando...</span>
            </div>
          )}
          {error && (
            <div style={{ fontSize: 12, color: 'var(--color-danger)', textAlign: 'center', padding: '8px', background: '#fef2f2', borderRadius: '8px' }}>
              {error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} style={{ padding: "16px", borderTop: "1px solid var(--color-border)", background: "#fff", display: "flex", gap: "8px" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregúntale a EnergyBot..."
            disabled={isLoading}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: "24px",
              border: "1px solid var(--color-border)",
              fontSize: "13px",
              outline: "none",
              background: "#f1f5f9"
            }}
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "50%",
              background: input.trim() && !isLoading ? "var(--color-primary)" : "#cbd5e1",
              color: "#fff",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: input.trim() && !isLoading ? "pointer" : "not-allowed",
              transition: "background 0.2s"
            }}
          >
            <Send size={18} style={{ marginLeft: 2 }} />
          </button>
        </form>
      </div>

      <style jsx global>{`
        .energybot-spin { animation: energybot-spin 1s linear infinite; }
        @keyframes energybot-spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
