import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { GraduationCap, ArrowRight, BookOpen, Users } from "lucide-react";

const Index = () => {
  const { session } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>AcademiQ</span>
          </div>
          <Button
            onClick={() => navigate(session ? "/dashboard" : "/auth")}
            size="sm"
          >
            {session ? "Dashboard" : "Get Started"}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-2xl text-center space-y-6">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Academic Management,{" "}
            <span className="text-primary">Simplified</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Create assignments, submit work, and track progress — all in one clean, focused platform for teachers and students.
          </p>
          <Button
            size="lg"
            onClick={() => navigate(session ? "/dashboard" : "/auth")}
            className="text-base px-8"
          >
            {session ? "Go to Dashboard" : "Start Now"}
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8">
            {[
              { icon: BookOpen, title: "Assignments", desc: "Create & manage with ease" },
              { icon: Users, title: "Role-Based", desc: "Teacher & Student views" },
              { icon: GraduationCap, title: "Grading", desc: "Feedback & grades in one place" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl bg-card border p-5 text-left">
                <Icon className="h-6 w-6 text-primary mb-2" />
                <h3 className="font-semibold text-sm">{title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
