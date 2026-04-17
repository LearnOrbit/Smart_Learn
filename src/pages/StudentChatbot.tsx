import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot, User, Loader2 } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

import { useLocation } from "react-router-dom";

export default function StudentChatbot() {
  const { toast } = useToast();
  const location = useLocation();
  const materialParams = location.state as { material?: any; classroom?: any } | null;
  const initialText = materialParams?.material 
    ? `Hi! I'm your AcademiQ Assistant. I see you've loaded **${materialParams.material.fileName}** from ${materialParams.classroom?.name || "your class"}. Ask me any questions about this PDF!`
    : "Hi! I'm your AcademiQ Assistant. Ask me anything — study tips, concept explanations, help with coursework, or advice on improving your performance.";

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: initialText,
    },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
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
      
      // Inject PDF context if this is the first real question and a material is loaded
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
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    },
    onError: (e: Error) => {
      toast({
        title: "Error",
        description: e.message || "Failed to get response",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text || chatMutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    chatMutation.mutate(text);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-10rem)]">
        <h1 className="text-2xl font-bold mb-4">AcademiQ Assistant</h1>

        {/* Chat area */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                  )}
                </div>
              ))}

              {chatMutation.isPending && (
                <div className="flex gap-3 justify-start">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl px-4 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input bar */}
          <div className="border-t p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                disabled={chatMutation.isPending}
                className="flex-1"
                autoFocus
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || chatMutation.isPending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
