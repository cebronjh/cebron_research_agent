import { Switch, Route, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import AgentPage from "@/pages/agent";
import LibraryPage from "@/pages/library-page";
import ReviewQueuePage from "@/pages/review-queue";
import ResearchPage from "@/pages/research";
import WeeklyIntelligencePage from "@/pages/weekly-intelligence";
import NewsletterDetailPage from "@/pages/newsletter-detail";
import LoginPage from "@/pages/login-page";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery({
    queryKey: ["/api/auth/status"],
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.authenticated) {
    navigate("/login");
    return null;
  }

  return <>{children}</>;
}

function App() {
  return (
    <div className="min-h-screen bg-background">
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/">
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        </Route>
        <Route path="/agent">
          <ProtectedRoute>
            <AgentPage />
          </ProtectedRoute>
        </Route>
        <Route path="/library">
          <ProtectedRoute>
            <LibraryPage />
          </ProtectedRoute>
        </Route>
        <Route path="/review-queue">
          <ProtectedRoute>
            <ReviewQueuePage />
          </ProtectedRoute>
        </Route>
        <Route path="/research">
          <ProtectedRoute>
            <ResearchPage />
          </ProtectedRoute>
        </Route>
        <Route path="/weekly-intelligence">
          <ProtectedRoute>
            <WeeklyIntelligencePage />
          </ProtectedRoute>
        </Route>
        <Route path="/newsletter/:id">
          {(params) => (
            <ProtectedRoute>
              <NewsletterDetailPage id={params.id} />
            </ProtectedRoute>
          )}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function HomePage() {
  const [, navigate] = useLocation();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Cebron Research</h1>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-6 py-16">
        <div className="max-w-3xl">
          <h2 className="text-5xl font-bold mb-6">M&A Discovery Agent</h2>
          <p className="text-xl text-muted-foreground mb-8">
            AI-powered research and lead generation for lower-middle market M&A opportunities.
          </p>
          <div className="flex gap-4 mb-12">
            <Link href="/agent">
              <Button size="lg">Agent Dashboard</Button>
            </Link>
            <Link href="/review-queue">
              <Button size="lg" variant="outline">Review Queue</Button>
            </Link>
            <Link href="/library">
              <Button size="lg" variant="outline">Research Library</Button>
            </Link>
            <Link href="/research">
              <Button size="lg" variant="outline">Company Research</Button>
            </Link>
            <Link href="/weekly-intelligence">
              <Button size="lg" variant="outline">Weekly Intelligence</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function NotFound() {
  return (
    <div className="container mx-auto px-6 py-16">
      <h1 className="text-4xl font-bold mb-4">404 - Not Found</h1>
      <Link href="/">
        <Button>Go Home</Button>
      </Link>
    </div>
  );
}

export default App;
