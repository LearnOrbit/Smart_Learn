import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User, Loader2, FileText, Headphones, Sparkles, BookOpen, Lightbulb, PlayCircle } from "lucide-react";
import { useLocation } from "react-router-dom";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function StudentChatbot() {
  const { toast } = useToast();
  const location = useLocation();
  const materialParams = location.state as { material?: any; classroom?: any } | null;
  const initialText = materialParams?.material 
    ? `Hi! I'm your AcademiQ Assistant. I've ingested your document **${materialParams.material.fileName}**. You can ask me questions about it, or ask me to synthesize a study guide!`
    : "Hi! I'm your AcademiQ Assistant. You haven't loaded a specific document, but I'm ready to help answer any academic questions, provide study strategies, or explain complex concepts.";

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: initialText },
  ]);
  const [input, setInput] = useState("");
  const [audioGenerating, setAudioGenerating] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      
      let msgToSend = userMessage;
      if (materialParams?.material && history.length === 1) {
         msgToSend = `Context Document: ${materialParams.material.fileName}\nDocument Content:\n${materialParams.material.extractedText?.substring(0, 50000)}\n\nUser Question: ${userMessage}`;
      }

      const { data, error } = await apiClient.post("/chat", {
        message: msgToSend,
        history,
      });
      if (error) throw error;
      return data as { reply: string };
    },
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to get response", variant: "destructive" });
    },
  });

  const handleSend = (overrideText?: string) => {
    const text = (overrideText || input).trim();
    if (!text || chatMutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    if (!overrideText) setInput("");
    chatMutation.mutate(text);
  };

  const handleGenerateAudio = () => {
    setAudioGenerating(true);
    // Simulate complex Audio Overview / Podcast generation pipeline
    setTimeout(() => {
      setAudioGenerating(false);
      setAudioReady(true);
      toast({ title: "Audio Overview Ready", description: "Your deep dive discussion has been synthesized." });
    }, 4500);
  };

  const hasSource = !!materialParams?.material;

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-10rem)] max-w-7xl mx-auto w-full">
        
        {/* ─── LEFT PANEL: SOURCES & NOTEBOOKLM BRIEFING ─── */}
        <div className="w-full md:w-1/3 flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
              <Sparkles className="h-6 w-6 text-primary" /> Notebook Analysis
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Grounded explicitly in your loaded syllabus materials.</p>
          </div>

          <Card className="flex-1 bg-muted/30 border-muted">
            <CardHeader className="pb-3 border-b border-border/50 bg-background/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                <BookOpen className="h-4 w-4" /> Current Sources
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {hasSource ? (
                <div className="bg-background rounded-xl p-3 border shadow-sm flex items-start gap-3">
                  <div className="p-2 bg-red-100 rounded-lg shrink-0">
                    <FileText className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold truncate" title={materialParams.material.fileName}>
                      {materialParams.material.fileName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {materialParams.classroom?.name || "Uploaded Document"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center p-4 border border-dashed rounded-xl border-muted-foreground/30 text-muted-foreground text-sm">
                  No explicit sources loaded. Answering from general knowledge.
                </div>
              )}

              {/* Audio Overview Podcast Simulator */}
              <div className="pt-4 border-t border-border/50">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Headphones className="h-3.5 w-3.5" /> Deep Dive Audio Overview
                </p>
                {audioReady ? (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center space-y-3 shadow-inner">
                    <div className="flex items-center justify-between text-xs text-primary font-medium px-2">
                      <span>0:00</span>
                      <div className="flex-1 mx-3 h-1.5 bg-primary/20 rounded-full overflow-hidden">
                        <div className="w-0 h-full bg-primary rounded-full"></div>
                      </div>
                      <span>8:45</span>
                    </div>
                    <Button variant="default" size="sm" className="w-full gap-2 rounded-full font-semibold shadow-md items-center h-10">
                      <PlayCircle className="h-5 w-5 fill-white text-primary" /> Play AI Podcast
                    </Button>
                    <p className="text-[10px] text-muted-foreground">Hosts discussing {materialParams?.material?.fileName || "your topics"}</p>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-sm bg-background/50 h-auto py-3 gap-3 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all"
                    onClick={handleGenerateAudio}
                    disabled={audioGenerating || !hasSource}
                  >
                    {audioGenerating ? (
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    ) : (
                      <Sparkles className="h-5 w-5 text-primary" />
                    )}
                    <div className="text-left">
                      <p className="font-semibold text-foreground">{audioGenerating ? "Synthesizing Voices..." : "Generate Audio Overview"}</p>
                      <p className="text-xs text-muted-foreground max-w-[180px] break-words whitespace-normal">Two AI hosts discuss your material</p>
                    </div>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── RIGHT PANEL: CHAT INTERFACE ─── */}
        <Card className="w-full md:w-2/3 flex flex-col overflow-hidden shadow-sm border-muted">
          <ScrollArea className="flex-1 p-4 md:p-6 bg-slate-50/50 dark:bg-background" ref={scrollRef}>
            <div className="space-y-6">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-3xl px-5 py-4 text-sm leading-relaxed shadow-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-white dark:bg-zinc-900 border border-border/50 rounded-tl-sm"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted border">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {chatMutation.isPending && (
                <div className="flex gap-4 justify-start">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 opacity-70">
                    <Sparkles className="h-5 w-5 text-white animate-pulse" />
                  </div>
                  <div className="bg-white dark:bg-zinc-900 border border-border/50 rounded-3xl rounded-tl-sm px-6 py-4 flex items-center gap-2">
                    <span className="flex space-x-1">
                      <span className="h-2 w-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="h-2 w-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="h-2 w-2 bg-primary/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </span>
                  </div>
                </div>
              )}

              {/* Suggested Prompts NotebookLM Style */}
              {messages.length === 1 && hasSource && !chatMutation.isPending && (
                <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 ml-14">
                  {[
                    "Summary", 
                    "Study Guide",
                    "FAQ",
                    "Timeline of events",
                    "Suggest quiz questions"
                  ].map((prompt) => (
                    <Button 
                      key={prompt} 
                      variant="outline" 
                      onClick={() => handleSend(`Generate a ${prompt} based on this document.`)}
                      className="justify-start text-xs rounded-full bg-white dark:bg-zinc-900 shadow-sm border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    >
                      <Lightbulb className="h-3.5 w-3.5 mr-2 text-amber-500" />
                      {prompt}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 bg-white dark:bg-zinc-950 border-t">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="relative max-w-4xl mx-auto flex items-end gap-2 bg-muted/50 rounded-3xl p-1.5 pr-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:bg-background transition-all border shadow-inner"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={hasSource ? "Ask questions about your sources..." : "Ask a question..."}
                disabled={chatMutation.isPending}
                className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 min-h-[44px] py-3 px-4 resize-none"
                autoFocus
                autoComplete="off"
              />
              <Button
                type="submit"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-full mb-0.5 shadow-sm transition-transform active:scale-95"
                disabled={!input.trim() || chatMutation.isPending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="text-center text-[10px] text-muted-foreground mt-3">
              AcademiQ Notebook Analyst can make mistakes. Check important info against original sources.
            </p>
          </div>
        </Card>
        
      </div>
    </DashboardLayout>
  );
}
