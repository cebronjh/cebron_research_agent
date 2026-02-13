// client/src/components/agent-dashboard.tsx

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Bot,
  Check,
  X,
  AlertCircle,
  PlayCircle,
  Settings,
  Calendar,
} from "lucide-react";

export function AgentDashboard() {
  const queryClient = useQueryClient();
  
  // Fetch active workflows
  const { data: workflows } = useQuery({
    queryKey: ["/api/agent/workflows"],
  });
  
  // Fetch pending approvals
  const { data: pendingApprovals } = useQuery({
    queryKey: ["/api/agent/approvals/pending"],
  });
  
  const approveCompany = useMutation({
    mutationFn: async (companyId: number) => {
      const res = await fetch(`/api/agent/approvals/${companyId}/approve`, {
        method: "POST",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/approvals/pending"] });
    },
  });
  
  const rejectCompany = useMutation({
    mutationFn: async (companyId: number) => {
      const res = await fetch(`/api/agent/approvals/${companyId}/reject`, {
        method: "POST",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/approvals/pending"] });
    },
  });
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-8 w-8" />
            Discovery Agent
          </h1>
          <p className="text-muted-foreground mt-1">
            Automated lead discovery and research pipeline
          </p>
        </div>
        <Button>
          <Settings className="h-4 w-4 mr-2" />
          Configure Agent
        </Button>
      </div>

      {/* Active Workflow Status */}
      {workflows && workflows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Workflow</CardTitle>
            <CardDescription>
              Most recent discovery run
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WorkflowStatus workflow={workflows[0]} />
          </CardContent>
        </Card>
      )}

      {/* Approval Queue */}
      {pendingApprovals && pendingApprovals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Pending Approval ({pendingApprovals.length})
            </CardTitle>
            <CardDescription>
              Review these companies before research
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingApprovals.map((company: any) => (
                <ApprovalCard
                  key={company.id}
                  company={company}
                  onApprove={() => approveCompany.mutate(company.id)}
                  onReject={() => rejectCompany.mutate(company.id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Configuration */}
      <AgentConfigCard />
    </div>
  );
}

function WorkflowStatus({ workflow }: { workflow: any }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "running":
        return "bg-blue-500 animate-pulse";
      case "awaiting_approval":
        return "bg-orange-500";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const progress =
    workflow.companiesResearched / workflow.companiesAutoApproved || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${getStatusColor(workflow.status)}`} />
            <span className="font-medium capitalize">{workflow.status}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Started {new Date(workflow.createdAt).toLocaleString()}
          </p>
        </div>
        <Badge variant="outline">
          {workflow.triggerType === "scheduled" ? (
            <Calendar className="h-3 w-3 mr-1" />
          ) : (
            <PlayCircle className="h-3 w-3 mr-1" />
          )}
          {workflow.triggerType}
        </Badge>
      </div>

      <Separator />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Found</p>
          <p className="text-2xl font-bold">{workflow.companiesFound}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Auto-Approved</p>
          <p className="text-2xl font-bold text-green-600">
            {workflow.companiesAutoApproved}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Manual Review</p>
          <p className="text-2xl font-bold text-orange-600">
            {workflow.companiesManualReview}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Researched</p>
          <p className="text-2xl font-bold text-blue-600">
            {workflow.companiesResearched}
          </p>
        </div>
      </div>

      {workflow.status === "researching" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Research Progress</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalCard({
  company,
  onApprove,
  onReject,
}: {
  company: any;
  onApprove: () => void;
  onReject: () => void;
}) {
  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600 bg-green-50";
    if (score >= 6) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "High":
        return "bg-green-500/10 text-green-700";
      case "Medium":
        return "bg-yellow-500/10 text-yellow-700";
      case "Low":
        return "bg-red-500/10 text-red-700";
      default:
        return "bg-gray-500/10 text-gray-700";
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-semibold">{company.companyName}</h4>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {company.description}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <div className={`px-3 py-1 rounded-full font-bold ${getScoreColor(company.agentScore)}`}>
            {company.agentScore}/10
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {company.confidence && (
          <Badge variant="secondary" className={getConfidenceColor(company.confidence)}>
            {company.confidence} Confidence
          </Badge>
        )}
        {company.industry && (
          <Badge variant="outline">{company.industry}</Badge>
        )}
        {company.estimatedRevenue && (
          <Badge variant="outline">{company.estimatedRevenue}</Badge>
        )}
        {company.geographicFocus && (
          <Badge variant="outline">{company.geographicFocus}</Badge>
        )}
      </div>

      <div className="text-sm">
        <p className="font-medium">Agent's Assessment:</p>
        <p className="text-muted-foreground">{company.scoringReason}</p>
      </div>

      {company.recentActivity && (
        <div className="text-sm">
          <p className="font-medium">Recent Activity:</p>
          <p className="text-muted-foreground">{company.recentActivity}</p>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button
          onClick={onApprove}
          className="flex-1"
          variant="default"
        >
          <Check className="h-4 w-4 mr-2" />
          Approve & Research
        </Button>
        <Button
          onClick={onReject}
          variant="outline"
          className="flex-1"
        >
          <X className="h-4 w-4 mr-2" />
          Reject
        </Button>
      </div>
    </div>
  );
}

function AgentConfigCard() {
  const [config, setConfig] = useState({
    name: "Healthcare Midwest Discovery",
    query: "healthcare medical",
    industry: "Healthcare",
    revenueRange: "$20M-$100M",
    geographicFocus: "Midwest",
    strategy: "buy-side" as "buy-side" | "sell-side" | "dual",
    schedule: "0 9 * * MON,WED,FRI",
    minScore: 7,
    requiredConfidence: "High" as "High" | "Medium" | "Low",
    isActive: true,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Configuration</CardTitle>
        <CardDescription>
          Set parameters for automated discovery
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="config-name">Configuration Name</Label>
            <Input
              id="config-name"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="query">Search Query</Label>
            <Input
              id="query"
              placeholder="e.g., healthcare medical devices"
              value={config.query}
              onChange={(e) => setConfig({ ...config, query: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                value={config.industry}
                onChange={(e) => setConfig({ ...config, industry: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="revenue">Revenue Range</Label>
              <Input
                id="revenue"
                value={config.revenueRange}
                onChange={(e) => setConfig({ ...config, revenueRange: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="region">Geographic Focus</Label>
              <Input
                id="region"
                value={config.geographicFocus}
                onChange={(e) => setConfig({ ...config, geographicFocus: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="strategy">Strategy</Label>
              <Select
                value={config.strategy}
                onValueChange={(value: any) => setConfig({ ...config, strategy: value })}
              >
                <SelectTrigger id="strategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy-side">Buy-Side</SelectItem>
                  <SelectItem value="sell-side">Sell-Side</SelectItem>
                  <SelectItem value="dual">Dual Approach</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium">Auto-Approval Rules</h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minScore">Minimum Score</Label>
                <Select
                  value={config.minScore.toString()}
                  onValueChange={(value) => setConfig({ ...config, minScore: parseInt(value) })}
                >
                  <SelectTrigger id="minScore">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 6, 7, 8, 9].map((score) => (
                      <SelectItem key={score} value={score.toString()}>
                        {score}/10 or higher
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confidence">Required Confidence</Label>
                <Select
                  value={config.requiredConfidence}
                  onValueChange={(value: any) => setConfig({ ...config, requiredConfidence: value })}
                >
                  <SelectTrigger id="confidence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High Only</SelectItem>
                    <SelectItem value="Medium">Medium or Higher</SelectItem>
                    <SelectItem value="Low">Any Confidence</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Companies meeting these criteria will be automatically researched.
              Others will need manual approval.
            </p>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="active">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Runs Mon/Wed/Fri at 9 AM
                </p>
              </div>
              <Switch
                id="active"
                checked={config.isActive}
                onCheckedChange={(checked) => setConfig({ ...config, isActive: checked })}
              />
            </div>
          </div>
        </div>

        <Button className="w-full">
          Save Configuration
        </Button>
      </CardContent>
    </Card>
  );
}
