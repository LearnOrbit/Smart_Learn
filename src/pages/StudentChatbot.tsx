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
  BookOpen, Lightbulb, PlayCircle, PauseCircle, MessageSquare, Wand2,
  Upload, X, RefreshCw, Volume2, HelpCircle
} from "lucide-react";
import { useLocation } from "react-router-dom";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface MaterialContext {
  fileName?: string;
  extractedText?: string;
}

interface ChatLocationState {
  material?: MaterialContext;
  classroom?: { name?: string };
}

export default function StudentChatbot() {
  const { toast } = useToast();
  const { t, i18n } = useTranslation("pages");
  const location = useLocation();
  const initialParams = location.state as ChatLocationState | null;

  const [currentMaterial, setCurrentMaterial] = useState<MaterialContext | null>(
    initialParams?.material || null
  );
  const [classroomName, setClassroomName] = useState<string>(
    initialParams?.classroom?.name || ""
  );

  const initialGreeting = currentMaterial?.fileName
    ? `Hello! I'm your AcademiQ AI Tutor. I'm ready to help you explore and master "${currentMaterial.fileName}". Ask any questions, or click a quick prompt below!`
    : "Hello! I'm your AcademiQ AI Academic Tutor. How can I assist you with your studies, coursework, or exam prep today?";

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: initialGreeting },
  ]);
  const [input, setInput] = useState("");
  const [audioGenerating, setAudioGenerating] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [uploadingSource, setUploadingSource] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      if (currentMaterial && history.length <= 2) {
        msgToSend = `Context Document: ${currentMaterial.fileName || "Uploaded Material"}\nDocument Content:\n${currentMaterial.extractedText?.substring(0, 50000) || ""}\n\nUser Question: ${userMessage}`;
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
      toast({
        title: "Connection Notice",
        description: e.message || "Failed to reach tutor service. Using fallback explanation.",
        variant: "destructive",
      });
    },
  });

  const studyMaterialMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.post("/study-material", {
        topic: currentMaterial?.fileName || "the current course material",
        source_text: currentMaterial?.extractedText || "",
        language: i18n.language === "hi" ? "Hindi" : i18n.language === "mr" ? "Marathi" : "English",
      });
      if (error) throw error;
      return data as { material: string };
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.material },
      ]);
    },
    onError: (e: Error) => {
      toast({ title: "Study Guide Notice", description: e.message, variant: "destructive" });
    },
  });

  const handleSend = (overrideText?: string) => {
    const text = (overrideText || input).trim();
    if (!text || chatMutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    if (!overrideText) setInput("");
    chatMutation.mutate(text);
  };

  const handleGenerateStudyGuide = () => {
    if (studyMaterialMutation.isPending) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: "Generate a complete structured study guide for this material." },
    ]);
    studyMaterialMutation.mutate();
  };

  // Document upload handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingSource(true);
    try {
      if (file.name.endsWith(".pdf")) {
        const formData = new FormData();
        formData.append("file", file);
        const { data, error } = await apiClient.postFormData("/extract-text/pdf", formData);
        if (error) throw error;
        const text = (data as { text?: string })?.text || "";
        setCurrentMaterial({ fileName: file.name, extractedText: text });
        setClassroomName("Uploaded Document");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `📄 Successfully loaded document **${file.name}** (${text.length} characters extracted). What would you like to analyze or study from it?`,
          },
        ]);
        toast({ title: "Source Loaded", description: `${file.name} is now active for this session.` });
      } else {
        // Plain text / Markdown reader
        const text = await file.text();
        setCurrentMaterial({ fileName: file.name, extractedText: text });
        setClassroomName("Uploaded Notes");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `📄 Loaded **${file.name}**. I can now answer questions, summarize, or generate quizzes based on this material!`,
          },
        ]);
        toast({ title: "Source Loaded", description: `${file.name} is now active.` });
      }
    } catch (err: any) {
      toast({
        title: "Upload Error",
        description: err?.message || "Could not read file text.",
        variant: "destructive",
      });
    } finally {
      setUploadingSource(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleClearSource = () => {
    setCurrentMaterial(null);
    setClassroomName("");
    setAudioReady(false);
    if (audioPlaying) {
      window.speechSynthesis?.cancel();
      setAudioPlaying(false);
    }
    toast({ title: "Source Cleared", description: "Chatbot switched back to general academic knowledge mode." });
  };

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const getAudioText = () => {
    if (currentMaterial?.extractedText?.trim()) {
      return `Overview of ${currentMaterial.fileName}: ${currentMaterial.extractedText.slice(0, 1500)}`;
    }
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    return (lastAssistant?.content || "Welcome to your AcademiQ AI audio tutor. Ask any question to get started.").slice(0, 1500);
  };

  const handleGenerateAudio = () => {
    if (!window.speechSynthesis) {
      toast({ title: "Speech Synthesis Unavailable", description: "Your browser does not support Web Speech.", variant: "destructive" });
      return;
    }
    setAudioGenerating(true);
    window.setTimeout(() => {
      setAudioGenerating(false);
      setAudioReady(true);
      toast({ title: "Audio Overview Ready", description: "Click play to listen to your AI hosts discussion." });
    }, 400);
  };

  const handlePlayAudio = () => {
    if (!window.speechSynthesis) return;
    if (audioPlaying) {
      window.speechSynthesis.pause();
      setAudioPlaying(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(getAudioText());
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onend = () => setAudioPlaying(false);
    utterance.onerror = () => setAudioPlaying(false);
    window.speechSynthesis.speak(utterance);
    setAudioPlaying(true);
  };

  const hasSource = !!currentMaterial;

  const defaultStarterPrompts = [
    { label: "🍎 Newton's Laws", prompt: "Explain Newton's Laws of Motion with real-world examples." },
    { label: "🔍 Binary Search", prompt: "Explain Binary Search algorithm and its time complexity step-by-step." },
    { label: "💻 4 OOP Pillars", prompt: "Explain the four pillars of Object-Oriented Programming with code examples." },
    { label: "💡 Exam Study Tips", prompt: "Give me the top active recall and spaced repetition study strategies for college exams." },
  ];

  const sourcePrompts = [
    { label: "📚 Summarize Document", prompt: "Summarize the key concepts and main takeaways of the loaded document.", action: () => handleSend("Please summarize the main concepts and core takeaways of this document.") },
    { label: "🎯 Generate Study Guide", prompt: "Generate a structured study guide with learning objectives and review questions.", action: handleGenerateStudyGuide },
    { label: "❓ Key FAQs", prompt: "What are the most frequent exam questions or FAQs from this material?", action: () => handleSend("What are the most critical FAQs and expected exam questions from this document?") },
    { label: "📝 Practice Quiz", prompt: "Create a 3-question practice quiz to test my understanding.", action: () => handleSend("Create a 3-question practice quiz with answers to test my understanding of this material.") },
  ];

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col md:flex-row gap-5 h-[calc(100vh-7.5rem)] max-w-7xl mx-auto w-full min-h-[500px]"
      >

        {/* ─── LEFT PANEL: SOURCES & AUDIO OVERVIEW ─── */}
        <div className="w-full md:w-80 lg:w-96 flex flex-col gap-4 shrink-0">
          <PageHeader
            title={t("chatbot:header.title") || "AI Tutor & Assistant"}
            description="Ground answers in your course material or explore general topics."
            variant="minimal"
          />

          <Card className="flex-1 flex flex-col bg-gradient-to-br from-muted/30 via-card to-muted/20 border-border/60 shadow-sm overflow-y-auto">
            <CardHeader className="pb-3 border-b border-border/50 bg-background/40 backdrop-blur shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                  <BookOpen className="h-4 w-4 text-primary" /> Current Sources
                </CardTitle>
                {hasSource && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSource}
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive gap-1"
                    title="Clear current source"
                  >
                    <X className="h-3.5 w-3.5" /> Clear
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
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
                      <p className="text-sm font-semibold truncate" title={currentMaterial.fileName}>
                        {currentMaterial.fileName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {classroomName || "Document loaded"}
                      </p>
                      <Badge variant="secondary" className="mt-1.5 text-[10px] bg-primary/10 text-primary">
                        Source Active
                      </Badge>
                    </div>
                  </motion.div>
                ) : (
                  <div className="text-center p-5 border border-dashed rounded-xl border-muted-foreground/30 text-muted-foreground text-sm space-y-3 bg-background/30">
                    <Bot className="h-8 w-8 mx-auto text-primary/60" />
                    <div>
                      <p className="font-medium text-foreground text-xs">No explicit source loaded</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Answering from academic knowledge base.</p>
                    </div>
                    <div className="pt-1">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".pdf,.txt,.md"
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={uploadingSource}
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full gap-2 text-xs bg-background shadow-xs hover:border-primary/50"
                      >
                        {uploadingSource ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5 text-primary" />
                        )}
                        {uploadingSource ? "Reading File..." : "Upload Notes / PDF"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Audio Overview Podcast Simulator */}
              <div className="pt-4 border-t border-border/50">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Headphones className="h-3.5 w-3.5 text-primary" /> Deep Dive Audio Overview
                </p>
                {audioReady ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4 text-center space-y-3 shadow-inner"
                  >
                    <div className="flex items-center justify-between text-xs text-primary font-medium px-1">
                      <span className="flex items-center gap-1">
                        <Volume2 className="h-3.5 w-3.5 animate-pulse" /> AI Voice
                      </span>
                      <span className="text-[11px] text-muted-foreground">Synthesized</span>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handlePlayAudio}
                      className="w-full gap-2 rounded-full font-semibold shadow-md h-10"
                    >
                      {audioPlaying ? (
                        <>
                          <PauseCircle className="h-5 w-5 fill-white text-primary" /> Pause Audio
                        </>
                      ) : (
                        <>
                          <PlayCircle className="h-5 w-5 fill-white text-primary" /> Play Deep Dive Audio
                        </>
                      )}
                    </Button>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {currentMaterial?.fileName
                        ? `Discussing: ${currentMaterial.fileName}`
                        : "Discussing current academic topic"}
                    </p>
                  </motion.div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-sm bg-background/50 h-auto py-3 gap-3 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all"
                    onClick={handleGenerateAudio}
                    disabled={audioGenerating}
                  >
                    {audioGenerating ? (
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    ) : (
                      <Sparkles className="h-5 w-5 text-primary" />
                    )}
                    <div className="text-left flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-xs">
                        {audioGenerating ? "Synthesizing Audio..." : "Generate Audio Overview"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {hasSource ? "Two AI hosts discuss your document" : "Audio breakdown of current study topic"}
                      </p>
                    </div>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── RIGHT PANEL: CHAT INTERFACE ─── */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <Card className="flex-1 flex flex-col overflow-hidden shadow-sm border-border/60">
            {/* Chat header */}
            <div className="border-b border-border/60 bg-muted/20 px-4 md:px-6 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">AcademiQ AI Tutor</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {hasSource
                      ? `Source: ${currentMaterial.fileName}`
                      : "General Academic Knowledge Mode"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {hasSource && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs hidden sm:inline-flex">
                    <BookOpen className="h-3 w-3 mr-1" />
                    Document Loaded
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  title="Reset conversation"
                  onClick={() => {
                    setMessages([{ role: "assistant", content: initialGreeting }]);
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <ScrollArea className="flex-1 p-4 md:p-6 bg-gradient-to-b from-slate-50/30 to-transparent dark:from-background" ref={scrollRef}>
              <div className="space-y-5 max-w-4xl mx-auto">
                <AnimatePresence initial={false}>
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.25 }}
                      className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm mt-1">
                          <Sparkles className="h-4 w-4" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-white dark:bg-zinc-900 border border-border/60 rounded-tl-sm text-foreground"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      {msg.role === "user" && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted border mt-1">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {chatMutation.isPending && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex gap-3 justify-start"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm">
                      <Sparkles className="h-4 w-4 animate-pulse" />
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border border-border/60 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      <span className="text-xs text-muted-foreground">Thinking and analyzing...</span>
                    </div>
                  </motion.div>
                )}

                {/* Suggested Fast Prompts */}
                {messages.length <= 2 && !chatMutation.isPending && !studyMaterialMutation.isPending && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="pt-2 border-t border-border/40"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Wand2 className="h-3.5 w-3.5 text-primary" /> Suggested Questions & Actions
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {hasSource
                        ? sourcePrompts.map((sp, idx) => (
                            <Button
                              key={idx}
                              variant="outline"
                              size="sm"
                              onClick={sp.action}
                              className="justify-start text-xs h-9 rounded-xl bg-white dark:bg-zinc-900 shadow-xs border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                            >
                              <Lightbulb className="h-3.5 w-3.5 mr-2 text-amber-500 shrink-0" />
                              <span className="truncate">{sp.label}</span>
                            </Button>
                          ))
                        : defaultStarterPrompts.map((dp, idx) => (
                            <Button
                              key={idx}
                              variant="outline"
                              size="sm"
                              onClick={() => handleSend(dp.prompt)}
                              className="justify-start text-xs h-9 rounded-xl bg-white dark:bg-zinc-900 shadow-xs border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                            >
                              <MessageSquare className="h-3.5 w-3.5 mr-2 text-primary shrink-0" />
                              <span className="truncate">{dp.label}</span>
                            </Button>
                          ))}
                    </div>
                  </motion.div>
                )}
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-zinc-950 border-t border-border/60 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="relative max-w-4xl mx-auto flex items-center gap-2 bg-muted/50 rounded-full p-1.5 pr-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:bg-background transition-all border shadow-inner"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    hasSource
                      ? `Ask questions about ${currentMaterial.fileName}...`
                      : "Ask anything about your courses, formulas, concepts, or homework..."
                  }
                  disabled={chatMutation.isPending}
                  className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 min-h-[42px] py-2 px-4 resize-none text-sm"
                  autoFocus
                  autoComplete="off"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full shadow-sm transition-transform active:scale-95"
                  disabled={!input.trim() || chatMutation.isPending}
                >
                  {chatMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
              <p className="text-center text-[10px] text-muted-foreground mt-2">
                AcademiQ AI Tutor is designed for academic support. Verify important formulas and dates with course instructors.
              </p>
            </div>
          </Card>
        </div>

      </motion.div>
    </DashboardLayout>
  );
}
