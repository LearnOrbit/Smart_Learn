import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, BookOpen, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { loadPageNamespace } from "@/i18n";

type AppRole = "student" | "teacher";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("student");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  // `pages` namespace + nested key prefix `auth.` → looks up
  // `pages.auth.<key>` in the active locale.
  const { t } = useTranslation("pages");

  // Bring in the auth page's translations on first mount. The
  // `loaded` Set inside `loadPageNamespace` makes this idempotent
  // — switching languages doesn't re-fetch, it just re-resolves
  // the existing bundle.
  useEffect(() => {
    void loadPageNamespace("auth");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isLogin) {
        if (!email || !password) {
          toast({
            title: t("auth.errors.title"),
            description: t("auth.errors.missingCredentials"),
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        await signIn(email, password);
        navigate("/dashboard");
      } else {
        if (!email || !password || !fullName) {
          toast({
            title: t("auth.errors.title"),
            description: t("auth.errors.missingFields"),
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        if (password.length < 8) {
          toast({
            title: t("auth.errors.title"),
            description: t("auth.errors.passwordTooShort"),
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          toast({
            title: t("auth.errors.title"),
            description: t("auth.errors.passwordMismatch"),
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        await signUp(email, password, fullName, selectedRole);
        toast({
          title: t("auth.success.accountCreatedTitle"),
          description: t("auth.success.accountCreatedDescription"),
        });
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setFullName("");
        setIsLogin(true);
      }
    } catch (error: unknown) {
      toast({
        title: t("auth.errors.title"),
        description: error instanceof Error ? error.message : t("auth.errors.unexpected"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <GraduationCap className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            AcademiQ
          </h1>
          <p className="mt-1 text-muted-foreground">{t("auth.tagline")}</p>
        </div>

        <Card>
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">{isLogin ? t("auth.signIn") : t("auth.createAccount")}</CardTitle>
            <CardDescription>
              {isLogin ? t("auth.signInDescription") : t("auth.createAccountDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">{t("auth.fullName")}</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={t("auth.fullNamePlaceholder")}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("auth.iAmA")}</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedRole("student")}
                        className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
                          selectedRole === "student"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground/30"
                        }`}
                      >
                        <BookOpen className={`h-6 w-6 ${selectedRole === "student" ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-sm font-medium ${selectedRole === "student" ? "text-primary" : "text-muted-foreground"}`}>
                          {t("auth.student")}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRole("teacher")}
                        className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
                          selectedRole === "teacher"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground/30"
                        }`}
                      >
                        <GraduationCap className={`h-6 w-6 ${selectedRole === "teacher" ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-sm font-medium ${selectedRole === "teacher" ? "text-primary" : "text-muted-foreground"}`}>
                          {t("auth.teacher")}
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.emailPlaceholder")}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("auth.passwordPlaceholder")}
                    required
                    minLength={isLogin ? 1 : 8}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {!isLogin && <p className="text-xs text-muted-foreground">{t("auth.minChars")}</p>}
              </div>
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t("auth.passwordPlaceholder")}
                      required
                      minLength={8}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {password && confirmPassword && password === confirmPassword && (
                    <p className="text-xs text-green-600">{t("auth.passwordsMatch")}</p>
                  )}
                  {password && confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-600">{t("auth.passwordsDoNotMatch")}</p>
                  )}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? t("auth.pleaseWait") : isLogin ? t("auth.signInCta") : t("auth.createAccountCta")}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
                {isLogin ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setEmail("");
                  setPassword("");
                  setConfirmPassword("");
                  setFullName("");
                }}
                className="font-medium text-primary hover:underline"
              >
                {isLogin ? t("auth.signUp") : t("auth.signIn")}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
