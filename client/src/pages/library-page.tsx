import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ResearchLibrary } from "@/components/research-library";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Database } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ResearchSnippet {
  id: number;
  companyName: string;
  websiteUrl: string;
  industry: string | null;
  revenueRange: string | null;
  geographicFocus: string | null;
  createdAt: string;
  executiveSummary?: string;
  recommendation?: "Buy-Side" | "Sell-Side" | "Dual Approach";
  confidence?: "High" | "Medium" | "Low";
  estimatedRevenue?: string;
  estimatedValuation?: string;
  topReason?: string;
}

export default function LibraryPage() {
  const [, setLocation] = useLocation();

  const { data: reports, isLoading, error } = useQuery<ResearchSnippet[]>({
    queryKey: ["/api/reports/library"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleSelectReport = (reportId: number) => {
    setLocation(`/report/${reportId}`);
  };

  if (isLoading) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <Database className="h-12 w-12 mx-auto mb-4 animate-pulse text-muted-foreground" />
            <p className="text-muted-foreground">Loading research library...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>Error Loading Library</CardTitle>
            <CardDescription>
              Failed to load research reports. Please try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
            <Button onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-7xl mx-auto p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLocation("/")}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    Research Library
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Search and browse all company research
                  </p>
                </div>
              </div>
            </div>
            <Button onClick={() => setLocation("/")}>
              New Research
            </Button>
          </div>
        </div>
      </div>

      {/* Library Content */}
      <div className="flex-1 overflow-hidden">
        {reports && reports.length > 0 ? (
          <ResearchLibrary
            reports={reports}
            onSelectReport={handleSelectReport}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <Database className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h2 className="text-2xl font-semibold mb-2">No Research Yet</h2>
              <p className="text-muted-foreground mb-6">
                Your research library is empty. Start by researching your first
                company.
              </p>
              <Button onClick={() => setLocation("/")}>
                Research a Company
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
