import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  GraduationCap, ArrowRight, BookOpen, Users, BarChart3,
  Sparkles, CheckCircle, Clock, Brain, FileText, MessageSquare,
  Trophy, Target, Zap, Star,
} from "lucide-react";

const Index = () => {
  const { session } = useAuth();
  const navigate = useNavigate();

  const features = [
    {
      icon: BookOpen,
      title: "One Dashboard. Every Class.",
      desc: "Join any class with a simple code. All your assignments, deadlines, and teacher announcements — organized in one clean feed.",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      icon: Brain,
      title: "Your Personal AI Tutor",
      desc: "Upload any PDF and ask questions about it. Stuck on a concept at 2 AM? Your AI tutor never sleeps and explains things your way.",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
    },
    {
      icon: FileText,
      title: "Submit & Forget the Stress",
      desc: "Upload assignments, get instant confirmation, and track every submission. You'll know exactly what's done and what's pending.",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      icon: BarChart3,
      title: "Scores That Actually Make Sense",
      desc: "No more asking friends 'how much did you get?' — see your marks, class average, and exactly where you stand. Instantly.",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
    },
    {
      icon: Target,
      title: "Study What Actually Matters",
      desc: "AI analyzes your past scores and tells you exactly which topics to revise before exams. Targeted prep, not random guessing.",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      icon: MessageSquare,
      title: "Never Miss an Update",
      desc: "Teacher posted a deadline change? New class material? You'll see it the moment it happens — no more 'I didn't know' moments.",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
    },
  ];

  const studentBenefits = [
    { icon: Clock, text: "Spend less time managing, more time actually learning" },
    { icon: Trophy, text: "Students who use AI insights consistently score higher" },
    { icon: Star, text: "See your grades the moment they're out — zero waiting" },
    { icon: Zap, text: "Ask AI anything about your study material, anytime" },
  ];

  const testimonials = [
    {
      quote: "I went from missing 3-4 deadlines every month to literally zero. The dashboard shows everything at a glance — it's a lifesaver during exam season.",
      name: "Priya K.",
      initials: "PK",
      detail: "Final Year, Information Technology",
    },
    {
      quote: "The AI tutor helped me understand Data Structures better than most YouTube videos. I just uploaded my professor's notes and asked questions — that simple.",
      name: "Arjun M.",
      initials: "AM",
      detail: "2nd Year, Computer Science",
    },
    {
      quote: "My favorite part? I can see exactly which topics I'm weak in before the exam. No more last-minute panic studying everything.",
      name: "Sneha R.",
      initials: "SR",
      detail: "3rd Year, Electronics & Communication",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white overflow-x-hidden">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold font-heading tracking-tight">
              Smart Learn
            </span>
          </div>
          <Button
            onClick={() => navigate(session ? "/dashboard" : "/auth")}
            size="sm"
            className="rounded-full bg-primary hover:bg-primary/90 px-5 transition-all duration-200"
          >
            {session ? "Dashboard" : "Get Started"}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <main className="flex-1">
        <section className="relative flex items-center justify-center px-4 py-20 sm:py-28 lg:py-36 overflow-hidden">
          {/* Background gradient image */}
          <div className="absolute inset-0 -z-10">
            <img
              src="/hero-bg.png"
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-40"
              style={{ mixBlendMode: 'multiply' }}
            />
            {/* Fade edges to white */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_white_75%)]" />
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
            <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-white to-transparent" />
          </div>

          <div className="max-w-3xl text-center space-y-8 animate-slide-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Used by 10,000+ students across colleges
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight font-heading leading-[1.1]">
              Deadlines, grades, and{" "}
              <span className="text-primary">AI help</span>
              <br />
              — all in one place.
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Stop juggling WhatsApp groups, random PDFs, and spreadsheets.
              Smart Learn gives you one dashboard for every class, every assignment, and an AI tutor that's always online.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Button
                size="lg"
                onClick={() => navigate(session ? "/dashboard" : "/auth")}
                className="text-base px-8 h-12 rounded-full bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md"
              >
                {session ? "Go to Dashboard" : "Join for Free"}
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                className="text-base px-8 h-12 rounded-full border-2 border-primary/20 text-primary hover:bg-primary/5 transition-all duration-200"
              >
                See How It Works
              </Button>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-6 text-sm text-muted-foreground">
              {["Always free for students", "Set up in under 2 minutes", "Works on phone, tablet & laptop"].map((text) => (
                <div key={text} className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How Students Use It ── */}
        <section className="border-y bg-primary/[0.03] py-16 px-4">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <p className="text-sm font-bold uppercase tracking-widest text-primary mb-3">The Student Advantage</p>
              <h2 className="text-2xl sm:text-3xl font-extrabold font-heading tracking-tight">
                Built for how students actually study
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {studentBenefits.map(({ icon: Icon, text }, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center text-center p-6 rounded-2xl bg-white border border-primary/10 shadow-sm animate-slide-up"
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features Section ── */}
        <section id="features" className="relative py-20 sm:py-28 px-4 overflow-hidden">
          {/* Background gradient image */}
          <div className="absolute inset-0 -z-10">
            <img
              src="/section-bg.png"
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-25"
              style={{ mixBlendMode: 'multiply' }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_40%,_white_80%)]" />
            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-white to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
          </div>
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-16 space-y-4">
              <p className="text-sm font-bold uppercase tracking-widest text-primary">Powerful Features</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold font-heading tracking-tight">
                Less chaos. More clarity.
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto text-lg">
                Every tool you need to stay organized, prepared, and ahead of your classmates.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map(({ icon: Icon, title, desc, iconBg, iconColor }, i) => (
                <div
                  key={title}
                  className="group rounded-2xl border border-primary/10 bg-white p-7 transition-all duration-200 hover:shadow-lg hover:border-primary/20 hover:-translate-y-1 cursor-default animate-slide-up"
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl ${iconBg} mb-5 transition-transform duration-200 group-hover:scale-110`}>
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                  </div>
                  <h3 className="font-bold text-base font-heading mb-2">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Student Testimonials ── */}
        <section className="py-20 px-4 bg-primary/[0.03] border-y">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-14">
              <p className="text-sm font-bold uppercase tracking-widest text-primary mb-3">Real Students, Real Results</p>
              <h2 className="text-2xl sm:text-3xl font-extrabold font-heading tracking-tight">
                Don't take our word for it
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-primary/10 bg-white p-6 sm:p-8 flex flex-col justify-between animate-slide-up"
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <blockquote className="text-sm sm:text-[15px] text-foreground leading-relaxed mb-6 font-medium">
                    "{t.quote}"
                  </blockquote>
                  <div className="flex items-center gap-3 pt-4 border-t border-primary/10">
                    <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs">
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Section ── */}
        <section className="py-20 px-4">
          <div className="mx-auto max-w-4xl text-center">
            <div className="rounded-3xl bg-primary p-10 sm:p-16 relative overflow-hidden">
              {/* Subtle pattern */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(255,255,255,0.08)_1px,_transparent_0)] bg-[size:24px_24px]" />

              <div className="relative z-10 space-y-6">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white font-heading tracking-tight">
                  The semester won't wait. Neither should you.
                </h2>
                <p className="text-white/80 text-lg max-w-xl mx-auto">
                  Sign up in under 2 minutes, join your first class, and finally have everything in one place.
                  Your future self will thank you.
                </p>
                <Button
                  size="lg"
                  onClick={() => navigate("/auth")}
                  className="rounded-full bg-white text-primary hover:bg-white/90 font-bold text-base px-8 h-12 shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                >
                  Start Now — It's Free Forever
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t py-8 px-4">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold font-heading text-sm">Smart Learn</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Smart Learn. Built for better education.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
