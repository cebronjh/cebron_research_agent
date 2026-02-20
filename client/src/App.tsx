import { Switch, Route, Link } from "wouter";
import { Button } from "@/components/ui/button";
import AgentPage from "@/pages/agent";
import LibraryPage from "@/pages/library-page";
import ReviewQueuePage from "@/pages/review-queue";
import ResearchPage from "@/pages/research";
import WeeklyIntelligencePage from "@/pages/weekly-intelligence";
import NewsletterDetailPage from "@/pages/newsletter-detail";

function App() {
  return (
    <div className="min-h-screen bg-background">
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/agent" component={AgentPage} />
        <Route path="/library" component={LibraryPage} />
        <Route path="/review-queue" component={ReviewQueuePage} />
        <Route path="/research" component={ResearchPage} />
        <Route path="/weekly-intelligence" component={WeeklyIntelligencePage} />
        <Route path="/newsletter/:id">
          {(params) => <NewsletterDetailPage id={params.id} />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold">Cebron Research</h1>
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
