import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { GraduationCap, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 overflow-hidden relative">
      {/* Background decorations */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-20 w-72 h-72 bg-indigo-200/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-200/15 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />
      </div>

      <div className="text-center space-y-8 animate-slide-up max-w-md">
        {/* Logo */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
          <GraduationCap className="h-8 w-8 text-white" />
        </div>

        {/* 404 Text */}
        <div className="space-y-3">
          <h1 className="text-8xl font-extrabold font-heading text-gradient tracking-tighter">404</h1>
          <h2 className="text-2xl font-bold font-heading text-foreground">Page not found</h2>
          <p className="text-muted-foreground leading-relaxed">
            Oops! It looks like you've wandered off the learning path. 
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild className="rounded-full bg-primary hover:bg-primary/90 shadow-md px-6">
            <Link to="/">
              <Home className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </Button>
          <Button variant="outline" asChild className="rounded-full px-6">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
