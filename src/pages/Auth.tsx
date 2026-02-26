import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, BookOpen } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("student");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        navigate("/dashboard");
      } else {
        await signUp(email, password, fullName, selectedRole);
        toast({
          title: "Account created!",
          description: "Please check your email to verify your account before signing in.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
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
          <p className="mt-1 text-muted-foreground">Academic Management System</p>
        </div>

        <Card>
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">{isLogin ? "Sign in" : "Create account"}</CardTitle>
            <CardDescription>
              {isLogin ? "Enter your credentials to access your dashboard" : "Fill in your details to get started"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>I am a</Label>
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
                          Student
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
                          Teacher
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="font-medium text-primary hover:underline"
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
