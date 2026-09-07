import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AnimatedPage, StaggerContainer, StaggerItem } from "@/components/ui/AnimatedPage";
import { motion } from "framer-motion";
import { loadPageNamespace } from "@/i18n";
import {
  GraduationCap,
  ArrowRight,
  BookOpen,
  Users,
  BarChart3,
  MessageSquare,
  CheckCircle2,
  Sparkles,
  Zap,
  Shield,
  FileText,
  TrendingUp,
  Clock,
} from "lucide-react";

const Index = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation("pages");

  useEffect(() => {
    void loadPageNamespace("index");
  }, []);

  const features = [
    {
      icon: BookOpen,
      titleKey: "features.smartAssignments.title",
      descKey: "features.smartAssignments.desc",
      color: "from-emerald-500 to-teal-500",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/20",
      textColor: "text-emerald-700 dark:text-emerald-300",
    },
    {
      icon: BarChart3,
      titleKey: "features.analytics.title",
      descKey: "features.analytics.desc",
      color: "from-blue-500 to-indigo-500",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      textColor: "text-blue-700 dark:text-blue-300",
    },
    {
      icon: MessageSquare,
      titleKey: "features.aiAssistant.title",
      descKey: "features.aiAssistant.desc",
      color: "from-purple-500 to-pink-500",
      bgColor: "bg-purple-50 dark:bg-purple-950/20",
      textColor: "text-purple-700 dark:text-purple-300",
    },
    {
      icon: Users,
      titleKey: "features.roleBased.title",
      descKey: "features.roleBased.desc",
      color: "from-amber-500 to-orange-500",
      bgColor: "bg-amber-50 dark:bg-amber-950/20",
      textColor: "text-amber-700 dark:text-amber-300",
    },
    {
      icon: FileText,
      titleKey: "features.copoMapping.title",
      descKey: "features.copoMapping.desc",
      color: "from-rose-500 to-red-500",
      bgColor: "bg-rose-50 dark:bg-rose-950/20",
      textColor: "text-rose-700 dark:text-rose-300",
    },
    {
      icon: Shield,
      titleKey: "features.secure.title",
      descKey: "features.secure.desc",
      color: "from-slate-500 to-gray-600",
      bgColor: "bg-slate-50 dark:bg-slate-950/20",
      textColor: "text-slate-700 dark:text-slate-300",
    },
  ];

  const stats = [
    { value: "10K+", labelKey: "stats.students", icon: Users },
    { value: "500+", labelKey: "stats.educators", icon: GraduationCap },
    { value: "95%", labelKey: "stats.satisfaction", icon: TrendingUp },
    { value: "24/7", labelKey: "stats.support", icon: Clock },
  ];

  const benefits = [
    "index:benefits.noFees",
    "index:benefits.freeTrial",
    "index:benefits.security",
    "index:benefits.support",
  ];

  return (
    <AnimatedPage variant="fade" className="flex min-h-screen flex-col bg-background relative overflow-hidden">
      {/* Animated Background Gradient */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <motion.div
          className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex items-center gap-2"
          >
            <motion.div
              whileHover={{ rotate: 12, scale: 1.1 }}
              transition={{ duration: 0.2 }}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-light shadow-lg shadow-primary/20"
            >
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </motion.div>
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              AcademiQ
            </span>
          </motion.div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              onClick={() => navigate(session ? "/dashboard" : "/auth")}
              size="sm"
              className="group"
            >
              {session ? t("index:header.dashboard") : t("index:header.getStarted")}
              <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12 sm:py-20">
        <div className="max-w-6xl w-full">
          <StaggerContainer className="text-center space-y-8" staggerDelay={0.1}>
            <StaggerItem>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{t("index:hero.badge")}</span>
                <Zap className="h-3.5 w-3.5" />
              </motion.div>
            </StaggerItem>

            <StaggerItem>
              <h1
                className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-foreground text-balance"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("index:hero.titlePrefix")}{" "}
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-primary via-primary-light to-primary bg-clip-text text-transparent">
                    {t("index:hero.titleHighlight")}
                  </span>
                  <motion.svg
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.8 }}
                    className="absolute -bottom-2 left-0 w-full h-3"
                    viewBox="0 0 100 10"
                    preserveAspectRatio="none"
                  >
                    <motion.path
                      d="M0,5 Q25,2 50,5 T100,5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className="text-primary"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.8, delay: 0.8 }}
                    />
                  </motion.svg>
                </span>
              </h1>
            </StaggerItem>

            <StaggerItem>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed text-pretty">
                {t("index:hero.description")}
              </p>
            </StaggerItem>

            <StaggerItem>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Button
                  size="xl"
                  onClick={() => navigate(session ? "/dashboard" : "/auth")}
                  className="group min-w-[200px] shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
                >
                  {session ? t("index:hero.ctaSignedIn") : t("index:hero.cta")}
                  <ArrowRight className="h-5 w-5 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
                <Button
                  size="xl"
                  variant="outline"
                  className="group min-w-[200px] border-2"
                  onClick={() => {
                    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  {t("index:hero.explore")}
                  <Sparkles className="h-4 w-4 ml-2 transition-transform group-hover:scale-110" />
                </Button>
              </div>
            </StaggerItem>

            {/* Stats Row */}
            <StaggerItem>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto pt-8">
                {stats.map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
                    whileHover={{ y: -4 }}
                    className="p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 shadow-sm hover:shadow-md transition-all"
                  >
                    <stat.icon className="h-5 w-5 text-primary mb-2 mx-auto" />
                    <div className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">
                      {stat.value}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t(`index:${stat.labelKey}`)}</div>
                  </motion.div>
                ))}
              </div>
            </StaggerItem>
          </StaggerContainer>
        </div>
      </main>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 border-t border-border/50 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12 sm:mb-16"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4"
            >
              <Zap className="h-3 w-3" />
              {t("index:features.badge")}
            </motion.div>
            <h2
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("index:features.titlePrefix")}{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {t("index:features.titleHighlight")}
              </span>
            </h2>
            <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
              {t("index:features.subtitle")}
            </p>
          </motion.div>

          <StaggerContainer
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
            staggerDelay={0.08}
          >
            {features.map((feature, i) => (
              <StaggerItem key={feature.titleKey}>
                <motion.div
                  whileHover={{ y: -6, scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                  className="group relative h-full p-6 rounded-2xl bg-card border border-border shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden"
                >
                  {/* Gradient overlay on hover */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none`}
                  />

                  <div className="relative">
                    <motion.div
                      whileHover={{ rotate: 12, scale: 1.1 }}
                      transition={{ duration: 0.3 }}
                      className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.bgColor} ${feature.textColor} mb-4`}
                    >
                      <feature.icon className="h-6 w-6" />
                    </motion.div>

                    <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                      {t(`index:${feature.titleKey}`)}
                    </h3>

                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t(`index:${feature.descKey}`)}
                    </p>

                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      whileHover={{ x: 0, opacity: 1 }}
                      className="mt-4 flex items-center text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-all"
                    >
                      {t("index:features.learnMore")}
                      <ArrowRight className="h-3 w-3 ml-1 transition-transform group-hover:translate-x-0.5" />
                    </motion.div>
                  </div>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>

          {/* Benefits list */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-16 sm:mt-20 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto"
          >
            {benefits.map((benefit, i) => (
              <motion.div
                key={benefit}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium text-foreground">{t(benefit)}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary-light to-accent p-8 sm:p-12 text-center text-primary-foreground shadow-2xl"
          >
            {/* Animated shapes */}
            <motion.div
              className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-2xl"
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 6, repeat: Infinity }}
            />
            <motion.div
              className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-2xl"
              animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 6, repeat: Infinity, delay: 1 }}
            />

            <div className="relative">
              <h2
                className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("index:cta.title")}
              </h2>
              <p className="text-lg opacity-90 mt-4 max-w-2xl mx-auto">
                {t("index:cta.subtitle")}
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
                <Button
                  size="xl"
                  variant="secondary"
                  onClick={() => navigate(session ? "/dashboard" : "/auth")}
                  className="group min-w-[200px] shadow-lg"
                >
                  {session ? t("index:hero.ctaSignedIn") : t("index:cta.getStarted")}
                  <ArrowRight className="h-5 w-5 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
                <Button
                  size="xl"
                  variant="ghost"
                  onClick={() => navigate("/auth")}
                  className="min-w-[200px] hover:bg-white/10 text-primary-foreground"
                >
                  {t("index:cta.signIn")}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-4 sm:px-6 bg-muted/20">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <GraduationCap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">AcademiQ</span>
            <span>{t("index:footer.tagline")}</span>
          </div>
          <p>{t("index:footer.copyright")}</p>
        </div>
      </footer>
    </AnimatedPage>
  );
};

export default Index;