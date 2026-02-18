import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X, Building2, MapPin, DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";

interface PendingCompany {
  id: number;
  companyName: string;
  websiteUrl: string;
  description: string | null;
  industry: string | null;
  estimatedRevenue: string | null;
  geographicFocus: string | null;
  agentScore: number;
  confidence: "High" | "Medium" | "Low";
  scoringReason: string;
  autoApprovalReason: string | null;
  createdAt: string;
}

export function PendingReviewQueue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<number | null>(null);

  const { data: pendingCompanies = [], isLoading } = useQuery({
    queryKey: ["/api/discovery-queue/pending"],
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/discovery-queue/${id}/approve`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to approve");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Company Approved",
        description: data.message || "Research has been started",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/discovery-queue/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      setProcessingId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve company",
        variant: "destructive",
      });
      setProcessingId(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/discovery-queue/${id}/reject`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to reject");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Company Rejected",
        description: "The company has been removed from the queue",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/discovery-queue/pending"] });
      setProcessingId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject company",
        variant: "destructive",
      });
      setProcessingId(null);
    },
  });

  const handleApprove = (id: number) => {
    setProcessingId(id);
    approveMutation.mutate(id);
  };

  const handleReject = (id: number) => {
    setProcessingId(id);
    rejectMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading pending companies...</p>
      </div>
    );
  }

  if (pendingCompanies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Building2 className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Companies Pending Review</h3>
        <p className="text-muted-foreground max-w-md">
          All discovered companies have been processed. Run a new discovery workflow to find more opportunities.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <h2 className="text-2xl font-bold mb-2">Manual Review Queue</h2>
        <p className="text-muted-foreground">
          {pendingCompanies.length} {pendingCompanies.length === 1 ? "company" : "companies"} waiting for approval
        </p>
      </div>

      {/* Companies List */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-4">
          {pendingCompanies.map((company) => (
            <CompanyReviewCard
              key={company.id}
              company={company}
              onApprove={() => handleApprove(company.id)}
              onReject={() => handleReject(company.id)}
              isProcessing={processingId === company.id}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

interface CompanyReviewCardProps {
  company: PendingCompany;
  onApprove: () => void;
  onReject: () => void;
  isProcessing: boolean;
}

function CompanyReviewCard({ company, onApprove, onReject, isProcessing }: CompanyReviewCardProps) {
  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "High":
        return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "Medium":
        return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
      case "Low":
        return "bg-red-500/10 text-red-700 dark:text-red-400";
      default:
        return "bg-gray-500/10 text-gray-700 dark:text-gray-400";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600 dark:text-green-400";
    if (score >= 6) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2">{company.companyName}</CardTitle>
            <CardDescription className="text-sm">
              {company.websiteUrl && (
                <a
                  href={company.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {company.websiteUrl}
                </a>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={getConfidenceColor(company.confidence)}>
              {company.confidence} Confidence
            </Badge>
            <Badge variant="outline" className={getScoreColor(company.agentScore)}>
              {company.agentScore.toFixed(1)}/10
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {company.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {company.description}
          </p>
        )}

        <Separator />

        <div className="grid grid-cols-2 gap-4 text-sm">
          {company.industry && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>{company.industry}</span>
            </div>
          )}

          {company.geographicFocus && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{company.geographicFocus}</span>
            </div>
          )}

          {company.estimatedRevenue && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span>{company.estimatedRevenue}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className={getScoreColor(company.agentScore)}>
              Score: {company.agentScore.toFixed(1)}/10
            </span>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">AI Scoring Reason:</h4>
          <p className="text-sm text-muted-foreground">{company.scoringReason}</p>
        </div>

        {company.autoApprovalReason && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-yellow-600 dark:text-yellow-400 mb-1">
                  Requires Manual Review
                </h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  {company.autoApprovalReason}
                </p>
              </div>
            </div>
          </div>
        )}

        <Separator />

        <div className="flex gap-3">
          <Button
            onClick={onApprove}
            disabled={isProcessing}
            className="flex-1 bg-green-600 hover:bg-green-700"
            size="lg"
          >
            <Check className="mr-2 h-4 w-4" />
            {isProcessing ? "Processing..." : "Approve & Research"}
          </Button>
          <Button
            onClick={onReject}
            disabled={isProcessing}
            variant="destructive"
            className="flex-1"
            size="lg"
          >
            <X className="mr-2 h-4 w-4" />
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
