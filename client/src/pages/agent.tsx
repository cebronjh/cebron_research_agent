import { AgentDashboard } from "@/components/agent-dashboard";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function AgentPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Cebron Research</h1>
        </div>
      </header>
      <div className="container max-w-7xl mx-auto p-6">
        <AgentDashboard />
      </div>
    </div>
  );
}
