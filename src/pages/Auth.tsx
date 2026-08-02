import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, BookOpen, Eye, EyeOff, Loader2, ArrowRight, Sparkles, Users, BarChart3 } from "lucide-react";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isLogin) {
        if (!email || !password) {
          toast({
            title: "Error",
            description: "Please enter both email and password",
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
            title: "Error",
            description: "Please fill in all fields",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        if (password.length < 8) {
          toast({
            title: "Error",
            description: "Password must be at least 8 characters",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          toast({
            title: "Error",
            description: "Passwords do not match",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        await signUp(email, password, fullName, selectedRole);
        toast({
          title: "Account created!",
          description: "You can now sign in with your credentials",
        });
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setFullName("");
        setIsLogin(true);
      }
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Left Panel — Brand ── */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-primary">
        {/* Decorative shapes */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-white/5 rounded-full blur-xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-white/5 rounded-full blur-xl" />
        <div className="absolute top-1/3 right-1/3 w-48 h-48 bg-purple-400/10 rounded-full blur-xl animate-float" />

        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white">
          <div className="flex items-center gap-3 mb-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm shadow-lg">
              <GraduationCap className="h-7 w-7 text-white" />
            </div>
            <span className="text-2xl font-extrabold font-heading tracking-tight">Smart Learn</span>
          </div>

          <h2 className="text-4xl xl:text-5xl font-extrabold font-heading tracking-tight leading-[1.1] mb-6">
            Your academic journey,<br />
            <span className="text-white/70">starts here.</span>
          </h2>

          <p className="text-white/80 text-lg max-w-md leading-relaxed mb-12">
            Join thousands of students and teachers using Smart Learn to manage assignments, track performance, and unlock AI-powered insights.
          </p>

          <div className="space-y-5">
            {[
              { icon: Sparkles, text: "AI-generated question papers & auto-grading" },
              { icon: Users, text: "Google Classroom-style class management" },
              { icon: BarChart3, text: "Real-time analytics & performance tracking" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3.5 text-white/80">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm shrink-0">
                  <Icon className="h-4.5 w-4.5 text-white" />
                </div>
                <span className="text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel — Form ── */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-12">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Mobile logo */}
          <div className="text-center lg:hidden">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight font-heading">
              Smart Learn
            </h1>
            <p className="mt-1 text-muted-foreground">Academic Management System</p>
          </div>

          {/* Desktop heading */}
          <div className="hidden lg:block">
            <h1 className="text-3xl font-extrabold font-heading tracking-tight">
              {isLogin ? "Welcome back" : "Create account"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {isLogin ? "Sign in to access your dashboard" : "Fill in your details to get started"}
            </p>
          </div>

          <Card className="border-0 shadow-card-md lg:shadow-none lg:border-0 lg:bg-transparent">
            {/* Mobile card header */}
            <CardHeader className="space-y-1 pb-4 lg:hidden">
              <CardTitle className="text-xl font-heading">{isLogin ? "Sign in" : "Create account"}</CardTitle>
              <CardDescription>
                {isLogin ? "Enter your credentials to access your dashboard" : "Fill in your details to get started"}
              </CardDescription>
            </CardHeader>

            <CardContent className="lg:px-0">
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-sm font-semibold">Full Name</Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="John Doe"
                        required
                        className="h-11 rounded-xl bg-muted/40 border-muted-foreground/15 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">I am a</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedRole("student")}
                          className={`group flex flex-col items-center gap-2.5 rounded-xl border-2 p-4 transition-all duration-200 ${
                            selectedRole === "student"
                              ? "border-primary bg-primary/5 shadow-glow-sm"
                              : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                          }`}
                        >
                          <BookOpen className={`h-6 w-6 transition-transform duration-200 group-hover:scale-110 ${selectedRole === "student" ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-sm font-semibold ${selectedRole === "student" ? "text-primary" : "text-muted-foreground"}`}>
                            Student
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedRole("teacher")}
                          className={`group flex flex-col items-center gap-2.5 rounded-xl border-2 p-4 transition-all duration-200 ${
                            selectedRole === "teacher"
                              ? "border-primary bg-primary/5 shadow-glow-sm"
                              : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                          }`}
                        >
                          <GraduationCap className={`h-6 w-6 transition-transform duration-200 group-hover:scale-110 ${selectedRole === "teacher" ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-sm font-semibold ${selectedRole === "teacher" ? "text-primary" : "text-muted-foreground"}`}>
                            Teacher
                          </span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="h-11 rounded-xl bg-muted/40 border-muted-foreground/15 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={isLogin ? 1 : 8}
                      className="pr-10 h-11 rounded-xl bg-muted/40 border-muted-foreground/15 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
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
                  {!isLogin && <p className="text-xs text-muted-foreground">Minimum 8 characters</p>}
                </div>
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-semibold">Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={8}
                        className="pr-10 h-11 rounded-xl bg-muted/40 border-muted-foreground/15 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
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
                      <p className="text-xs text-emerald-600 font-medium">✓ Passwords match</p>
                    )}
                    {password && confirmPassword && password !== confirmPassword && (
                      <p className="text-xs text-red-600 font-medium">✗ Passwords do not match</p>
                    )}
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 font-semibold text-[15px] shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Please wait...
                    </>
                  ) : isLogin ? (
                    <>
                      Sign In
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>
              <div className="mt-6 text-center text-sm text-muted-foreground">
                {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setEmail("");
                    setPassword("");
                    setConfirmPassword("");
                    setFullName("");
                  }}
                  className="font-semibold text-primary hover:text-primary/80 transition-colors underline-offset-4 hover:underline"
                >
                  {isLogin ? "Sign up" : "Sign in"}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;
