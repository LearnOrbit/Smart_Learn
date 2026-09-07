import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/integrations/api/client";
import { loadPageNamespace } from "@/i18n";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Send, Bot, User, Loader2, FileText, Headphones, Sparkles,
  BookOpen, Lightbulb, PlayCircle, MessageSquare, Wand2
} from "lucide-react";
import { useLocation } from "react-router-dom";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function StudentChatbot() {
  const { toast } = useToast();
  const { t } = useTranslation("pages");
  const location = useLocation();
  const materialParams = location.state as { material?: any; classroom?: any } | null;
  const initialText = materialParams?.material
    ? t("chatbot:chat.initialWithDoc", { name: materialParams.material.fileName })
    : t("chatbot:chat.initialGeneric");

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: initialText },
  ]);
  const [input, setInput] = useState("");
  const [audioGenerating, setAudioGenerating] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadPageNamespace("chatbot");
  }, []);

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
      toast({ title: t("chatbot:toasts.errorTitle"), description: e.message || t("chatbot:toasts.errorFallback"), variant: "destructive" });
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
      toast({ title: t("chatbot:toasts.audioReady"), description: t("chatbot:toasts.audioReadyDesc") });
    }, 4500);
  };

  const hasSource = !!materialParams?.material;

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col h-[calc(100vh-10rem)] max-w-7xl mx-auto w-full"
      >

        {/* ─── LEFT PANEL: SOURCES & NOTEBOOKLM BRIEFING ─── */}
        <div className="hidden md:flex md:w-1/3 flex-col gap-4 pr-2">
          <PageHeader
            title={t("chatbot:header.title")}
            description={t("chatbot:header.description")}
            variant="minimal"
          />

          <Card className="flex-1 bg-gradient-to-br from-muted/30 via-card to-muted/20 border-border/60 overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/50 bg-background/40 backdrop-blur">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                <BookOpen className="h-4 w-4" /> {t("chatbot:sources.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {hasSource ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-background rounded-xl p-3 border shadow-sm flex items-start gap-3 hover:shadow-md transition-shadow"
                >
                  <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg shrink-0">
                    <FileText className="h-5 w-5 text-rose-600 dark:text-rose-300" />
                  </div>
                  <div className="overflow-hidden min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" title={materialParams.material.fileName}>
                      {materialParams.material.fileName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {materialParams.classroom?.name || t("chatbot:sources.uploadedDocument")}
                    </p>
                  </div>
                </motion.div>
              ) : (
                <div className="text-center p-6 border border-dashed rounded-xl border-muted-foreground/30 text-muted-foreground text-sm">
                  <Bot className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>{t("chatbot:sources.noSources")}</p>
                  <p className="text-xs mt-1 opacity-70">{t("chatbot:sources.noSourcesHint")}</p>
                </div>
              )}

              {/* Audio Overview Podcast Simulator */}
              <div className="pt-4 border-t border-border/50">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Headphones className="h-3.5 w-3.5" /> {t("chatbot:audio.title")}
                </p>
                {audioReady ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                    className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4 text-center space-y-3 shadow-inner"
                  >
                    <div className="flex items-center justify-between text-xs text-primary font-medium px-2">
                      <span>0:00</span>
                      <div className="flex-1 mx-3 h-1.5 bg-primary/20 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: "32%" }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                          className="h-full bg-primary rounded-full"
                        />
                      </div>
                      <span>8:45</span>
                    </div>
                    <Button variant="default" size="sm" className="w-full gap-2 rounded-full font-semibold shadow-md h-10">
                      <PlayCircle className="h-5 w-5 fill-white text-primary" /> {t("chatbot:audio.play")}
                    </Button>
                    <p className="text-[10px] text-muted-foreground">
                      {materialParams?.material?.fileName
                        ? t("chatbot:audio.hostsDiscussing", { name: materialParams.material.fileName })
                        : t("chatbot:audio.hostsDiscussingGeneric")}
                    </p>
                  </motion.div>
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
                    <div className="text-left flex-1">
                      <p className="font-semibold text-foreground">
                        {audioGenerating ? t("chatbot:audio.synthesizing") : t("chatbot:audio.generate")}
                      </p>
                      <p className="text-xs text-muted-foreground max-w-[180px] break-words whitespace-normal">
                        {t("chatbot:audio.hostsSubtitle")}
                      </p>
                    </div>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── RIGHT PANEL: CHAT INTERFACE ─── */}
        <div className="flex-1 md:ml-6 flex flex-col">
          {/* Mobile-only header */}
          <div className="md:hidden mb-4">
            <PageHeader
              title={t("chatbot:header.title")}
              description={t("chatbot:header.mobileDescription")}
              variant="minimal"
            />
          </div>

          <Card className="flex-1 flex flex-col overflow-hidden shadow-sm border-border/60">
            {/* Chat header */}
            <div className="border-b border-border/60 bg-muted/20 px-4 md:px-6 py-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{t("chatbot:chat.title")}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {hasSource
                    ? t("chatbot:chat.statusWithSource", { name: materialParams?.material?.fileName })
                    : t("chatbot:chat.statusGeneral")}
                </p>
              </div>
              {hasSource && (
                <Badge variant="secondary" className="hidden sm:inline-flex bg-primary/10 text-primary border-0">
                  <BookOpen className="h-3 w-3 mr-1" />
                  {t("chatbot:chat.sourceLoaded")}
                </Badge>
              )}
            </div>

            <ScrollArea className="flex-1 p-4 md:p-6 bg-gradient-to-b from-slate-50/30 to-transparent dark:from-background" ref={scrollRef}>
              <div className="space-y-6">
                <AnimatePresence initial={false}>
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                      className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm">
                          <Sparkles className="h-4 w-4 text-white" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                          msg.role === "user"
                            ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-tr-sm"
                            : "bg-white dark:bg-zinc-900 border border-border/60 rounded-tl-sm"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      {msg.role === "user" && (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted border">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                <AnimatePresence>
                  {chatMutation.isPending && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.25 }}
                      className="flex gap-3 justify-start"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 opacity-80">
                        <Sparkles className="h-4 w-4 text-white animate-pulse" />
                      </div>
                      <div className="bg-white dark:bg-zinc-900 border border-border/60 rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-2">
                        <span className="flex space-x-1.5">
                          <motion.span
                            className="h-2 w-2 bg-primary/40 rounded-full"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}
                          />
                          <motion.span
                            className="h-2 w-2 bg-primary/60 rounded-full"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ duration: 0.8, repeat: Infinity, delay: 0.15 }}
                          />
                          <motion.span
                            className="h-2 w-2 bg-primary/80 rounded-full"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ duration: 0.8, repeat: Infinity, delay: 0.3 }}
                          />
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Suggested Prompts NotebookLM Style */}
                <AnimatePresence>
                  {messages.length === 1 && hasSource && !chatMutation.isPending && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.4, delay: 0.2 }}
                      className="pt-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                        <Wand2 className="h-3.5 w-3.5" /> {t("chatbot:prompts.title")}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { key: "summary", icon: FileText, aiPrompt: t("chatbot:prompts.aiPromptSummary") },
                          { key: "studyGuide", icon: BookOpen, aiPrompt: t("chatbot:prompts.aiPromptStudyGuide") },
                          { key: "faq", icon: MessageSquare, aiPrompt: t("chatbot:prompts.aiPromptFaq") },
                          { key: "quizQuestions", icon: Lightbulb, aiPrompt: t("chatbot:prompts.aiPromptQuiz") },
                        ].map((prompt) => (
                          <motion.div
                            key={prompt.key}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: 0.3 + 0 }}
                          >
                            <Button
                              variant="outline"
                              onClick={() => handleSend(prompt.aiPrompt)}
                              className="justify-start text-xs w-full rounded-full bg-white dark:bg-zinc-900 shadow-sm border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
                            >
                              <prompt.icon className="h-3.5 w-3.5 mr-2 text-amber-500" />
                              {t(`chatbot:prompts.${prompt.key}`)}
                            </Button>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-zinc-950 border-t border-border/60">
              <form
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="relative max-w-4xl mx-auto flex items-end gap-2 bg-muted/50 rounded-3xl p-1.5 pr-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:bg-background transition-all border shadow-inner"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={hasSource ? t("chatbot:input.withSource") : t("chatbot:input.generic")}
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
                  {chatMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
              <p className="text-center text-[10px] text-muted-foreground mt-3">
                {t("chatbot:chat.disclaimer")}
              </p>
            </div>
          </Card>
        </div>

      </motion.div>
    </DashboardLayout>
  );
}
