import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Check,
  X,
  Eye,
  Filter,
  Clock,
  TrendingUp,
  CheckSquare,
  Square,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function ReviewQueuePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filterIndustry, setFilterIndustry] = useState<string>("all");
  const [filterConfidence, setFilterConfidence] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("score");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data: companies, isLoading } = useQuery({
    queryKey: ["/api/discovery-queue/pending"],
  });

  const approveCompany = useMutation({
    mutationFn: async (companyId: number) => {
      const res = await fetch(`/api/discovery-queue/${companyId}/approve`, {
        method: "POST",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discovery-queue/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
    },
  });

  const rejectCompany = useMutation({
    mutationFn: async (companyId: number) => {
      const res = await fetch(`/api/discovery-queue/${companyId}/reject`, {
        method: "POST",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discovery-queue/pending"] });
    },
  });

  const bulkApprove = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await fetch("/api/discovery-queue/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Failed to bulk approve");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Bulk Approved", description: data.message });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/discovery-queue/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Bulk approve failed", variant: "destructive" });
    },
  });

  const bulkReject = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await fetch("/api/discovery-queue/bulk-reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Failed to bulk reject");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Bulk Rejected", description: data.message });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/discovery-queue/pending"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Bulk reject failed", variant: "destructive" });
    },
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!filteredCompanies) return;
    if (selectedIds.size === filteredCompanies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCompanies.map((c: any) => c.id)));
    }
  };

  const filteredCompanies = companies
    ?.filter((c: any) => {
      if (filterIndustry !== "all" && c.industry !== filterIndustry) return false;
      if (filterConfidence !== "all" && c.confidence !== filterConfidence) return false;
      return true;
    })
    .sort((a: any, b: any) => {
      if (sortBy === "score") return b.agentScore - a.agentScore;
      if (sortBy === "date") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "revenue") {
        const aRev = parseRevenue(a.estimatedRevenue);
        const bRev = parseRevenue(b.estimatedRevenue);
        return bRev - aRev;
      }
      return 0;
    });

  const industries = [...new Set(companies?.map((c: any) => c.industry).filter(Boolean))];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/agent">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Review Queue</h1>
                <p className="text-sm text-muted-foreground">
                  {filteredCompanies?.length || 0} companies pending review
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {selectedIds.size > 0 && (
                <>
                  <Badge variant="outline" className="text-sm px-3 py-1">
                    {selectedIds.size} selected
                  </Badge>
                  <Button
                    size="sm"
                    onClick={() => bulkApprove.mutate(Array.from(selectedIds))}
                    disabled={bulkApprove.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    {bulkApprove.isPending ? "Approving..." : "Approve Selected"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => bulkReject.mutate(Array.from(selectedIds))}
                    disabled={bulkReject.isPending}
                  >
                    <X className="h-4 w-4 mr-1" />
                    {bulkReject.isPending ? "Rejecting..." : "Reject Selected"}
                  </Button>
                </>
              )}
              <Badge variant="secondary" className="text-lg px-4 py-2">
                <Clock className="h-4 w-4 mr-2" />
                {filteredCompanies?.length || 0} Pending
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="container max-w-7xl mx-auto px-6 py-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Sort
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Industry</label>
                <Select value={filterIndustry} onValueChange={setFilterIndustry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Industries</SelectItem>
                    {industries.map((industry: any) => (
                      <SelectItem key={industry} value={industry}>
                        {industry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Confidence</label>
                <Select value={filterConfidence} onValueChange={setFilterConfidence}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Confidence</SelectItem>
                    <SelectItem value="High">High Only</SelectItem>
                    <SelectItem value="Medium">Medium+</SelectItem>
                    <SelectItem value="Low">Low+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Sort By</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="score">Score (High → Low)</SelectItem>
                    <SelectItem value="date">Date Added</SelectItem>
                    <SelectItem value="revenue">Revenue (High → Low)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading companies...</p>
          </div>
        ) : filteredCompanies && filteredCompanies.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectAll}
                className="text-muted-foreground"
              >
                {selectedIds.size === filteredCompanies.length ? (
                  <CheckSquare className="h-4 w-4 mr-2" />
                ) : (
                  <Square className="h-4 w-4 mr-2" />
                )}
                {selectedIds.size === filteredCompanies.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            {filteredCompanies.map((company: any) => (
              <CompanyReviewCard
                key={company.id}
                company={company}
                onApprove={() => approveCompany.mutate(company.id)}
                onReject={() => rejectCompany.mutate(company.id)}
                isApproving={approveCompany.isPending}
                isRejecting={rejectCompany.isPending}
                isSelected={selectedIds.has(company.id)}
                onToggleSelect={() => toggleSelect(company.id)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Check className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">All Clear!</h3>
              <p className="text-muted-foreground">
                No companies pending review. Great work!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function CompanyReviewCard({
  company,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  isSelected,
  onToggleSelect,
}: {
  company: any;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const getScoreColor = (score: number) => {
    if (score >= 8) return "bg-green-500";
    if (score >= 6) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "High":
        return "bg-green-500/10 text-green-700 border-green-200";
      case "Medium":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-200";
      case "Low":
        return "bg-red-500/10 text-red-700 border-red-200";
      default:
        return "bg-gray-500/10 text-gray-700 border-gray-200";
    }
  };

  return (
    <Card className={`hover:shadow-md transition-shadow ${isSelected ? "ring-2 ring-blue-500" : ""}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <button
              onClick={onToggleSelect}
              className="mt-1 text-muted-foreground hover:text-foreground"
            >
              {isSelected ? (
                <CheckSquare className="h-5 w-5 text-blue-500" />
              ) : (
                <Square className="h-5 w-5" />
              )}
            </button>
            <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <CardTitle className="text-xl">{company.companyName}</CardTitle>
              <div className={`h-10 w-10 rounded-full ${getScoreColor(company.agentScore)} flex items-center justify-center text-white font-bold`}>
                {company.agentScore}
              </div>
            </div>
            {company.websiteUrl && (
              <p className="text-sm text-muted-foreground">{company.websiteUrl}</p>
            )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={getConfidenceColor(company.confidence)}>
            {company.confidence} Confidence
          </Badge>
          {company.industry && (
            <Badge variant="outline">{company.industry}</Badge>
          )}
          {company.estimatedRevenue && (
            <Badge variant="outline">
              <TrendingUp className="h-3 w-3 mr-1" />
              {company.estimatedRevenue}
            </Badge>
          )}
          {company.geographicFocus && (
            <Badge variant="outline">{company.geographicFocus}</Badge>
          )}
        </div>

        {company.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {company.description}
          </p>
        )}

        {company.autoApprovalReason && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <p className="text-sm font-medium text-orange-900">
              ⚠️ Manual Review Required
            </p>
            <p className="text-sm text-orange-700 mt-1">
              {company.autoApprovalReason}
            </p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm font-medium text-blue-900 mb-1">
            Agent's Assessment:
          </p>
          <p className="text-sm text-blue-700">{company.scoringReason}</p>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={onApprove}
            disabled={isApproving || isRejecting}
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-2" />
            {isApproving ? "Approving..." : "Approve & Research"}
          </Button>
          <Button
            onClick={onReject}
            disabled={isApproving || isRejecting}
            variant="outline"
            className="flex-1"
          >
            <X className="h-4 w-4 mr-2" />
            {isRejecting ? "Rejecting..." : "Reject"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function parseRevenue(revenueStr: string): number {
  if (!revenueStr) return 0;
  const cleanStr = revenueStr.toLowerCase().replace(/[,$]/g, "");
  const num = parseFloat(cleanStr);
  if (cleanStr.includes("b")) return num * 1000000000;
  if (cleanStr.includes("m")) return num * 1000000;
  if (cleanStr.includes("k")) return num * 1000;
  return num;
}
