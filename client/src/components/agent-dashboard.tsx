import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import {
  Bot,
  Check,
  X,
  AlertCircle,
  PlayCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export function AgentDashboard() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  // Fetch active workflows
  const { data: workflows } = useQuery({
    queryKey: ["/api/workflows"],
  });
  
  // Fetch pending approvals count
  const { data: pendingApprovals } = useQuery({
    queryKey: ["/api/discovery-queue/pending"],
  });

  const pendingCount = pendingApprovals?.length || 0;

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
        <div className="flex gap-2">
          {pendingCount > 0 && (
            <Button onClick={() => setLocation("/review-queue")} variant="outline">
              <AlertCircle className="h-4 w-4 mr-2 text-orange-500" />
              {pendingCount} Pending Review
            </Button>
          )}
        </div>
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

function AgentConfigCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showOptionalFilters, setShowOptionalFilters] = useState(false);
  const [savedConfigId, setSavedConfigId] = useState<number | null>(null);
  
  const [config, setConfig] = useState({
    name: "Healthcare Midwest Discovery",
    query: "healthcare medical",
    industry: "Healthcare",
    revenueRange: "$20M-$100M",
    geographicFocus: "Midwest",
    strategy: "buy-side" as "buy-side" | "sell-side" | "dual",
    
    // Optional filters - now arrays for multi-select
    employeeCount: [] as string[],
    yearsInBusiness: [] as string[],
    fundingStatus: [] as string[],
    growthStatus: [] as string[],
    
    schedule: "0 19 * * 0,2,4",
    minScore: 7,
    requiredConfidence: "High" as "High" | "Medium" | "Low",
    isActive: true,
  });

  const saveConfig = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/agent-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: config.name,
          searchCriteria: {
            query: config.query,
            industry: config.industry,
            revenueRange: config.revenueRange,
            geographicFocus: config.geographicFocus,
            strategy: config.strategy,
            // Optional filters
            employeeCount: config.employeeCount.length > 0 ? config.employeeCount : undefined,
            yearsInBusiness: config.yearsInBusiness.length > 0 ? config.yearsInBusiness : undefined,
            fundingStatus: config.fundingStatus.length > 0 ? config.fundingStatus : undefined,
            growthStatus: config.growthStatus.length > 0 ? config.growthStatus : undefined,
          },
          autoApprovalRules: {
            minScore: config.minScore,
            requiredConfidence: config.requiredConfidence,
          },
          schedule: config.schedule,
          isActive: config.isActive,
        }),
      });
      if (!res.ok) throw new Error("Failed to save configuration");
      return res.json();
    },
    onSuccess: (data) => {
      setSavedConfigId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      toast({
        title: "Configuration saved",
        description: `Configuration "${config.name}" has been saved successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save configuration",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const runDiscovery = useMutation({
    mutationFn: async () => {
      // First, save the config if not already saved
      let configId = savedConfigId;
      if (!configId) {
        const saveRes = await fetch("/api/agent-configs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: config.name,
            searchCriteria: {
              query: config.query,
              industry: config.industry,
              revenueRange: config.revenueRange,
              geographicFocus: config.geographicFocus,
              strategy: config.strategy,
              employeeCount: config.employeeCount.length > 0 ? config.employeeCount : undefined,
              yearsInBusiness: config.yearsInBusiness.length > 0 ? config.yearsInBusiness : undefined,
              fundingStatus: config.fundingStatus.length > 0 ? config.fundingStatus : undefined,
              growthStatus: config.growthStatus.length > 0 ? config.growthStatus : undefined,
            },
            autoApprovalRules: {
              minScore: config.minScore,
              requiredConfidence: config.requiredConfidence,
            },
            schedule: config.schedule,
            isActive: config.isActive,
          }),
        });
        if (!saveRes.ok) throw new Error("Failed to save configuration");
        const savedConfig = await saveRes.json();
        configId = savedConfig.id;
        setSavedConfigId(configId);
      }
      
      // Now run with the saved config ID
      const res = await fetch(`/api/discovery/run/${configId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to start discovery");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      toast({
        title: "Discovery started",
        description: "The agent is now searching for companies. Check back in a few minutes for results.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start discovery",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleArrayValue = (array: string[], value: string) => {
    if (array.includes(value)) {
      return array.filter(v => v !== value);
    } else {
      return [...array, value];
    }
  };

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
          {/* Configuration Name */}
          <div className="space-y-2">
            <Label htmlFor="config-name">Configuration Name</Label>
            <Input
              id="config-name"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
            />
          </div>

          {/* Search Query */}
          <div className="space-y-2">
            <Label htmlFor="query">Search Query</Label>
            <Input
              id="query"
              placeholder="e.g., healthcare medical devices"
              value={config.query}
              onChange={(e) => setConfig({ ...config, query: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Natural language description of companies you're looking for
            </p>
          </div>

          {/* Core Criteria */}
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
                placeholder="e.g., $20M-$100M"
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
                placeholder="e.g., Midwest, Northeast"
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

          {/* Optional Filters Toggle */}
          <div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setShowOptionalFilters(!showOptionalFilters)}
            >
              {showOptionalFilters ? (
                <ChevronUp className="h-4 w-4 mr-2" />
              ) : (
                <ChevronDown className="h-4 w-4 mr-2" />
              )}
              Optional Filters
            </Button>
          </div>

          {/* Optional Filters */}
          {showOptionalFilters && (
            <div className="space-y-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Select multiple options for each filter. Leave blank to skip.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {/* Employee Count - Multi-select */}
                <div className="space-y-2">
                  <Label>Employee Count</Label>
                  <div className="space-y-2 border rounded-lg p-3">
                    {["1-10", "10-50", "50-200", "200-500", "500+"].map((option) => (
                      <div key={option} className="flex items-center space-x-2">
                        <Checkbox
                          id={`emp-${option}`}
                          checked={config.employeeCount.includes(option)}
                          onCheckedChange={() => 
                            setConfig({
                              ...config,
                              employeeCount: toggleArrayValue(config.employeeCount, option)
                            })
                          }
                        />
                        <label
                          htmlFor={`emp-${option}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {option} employees
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Years in Business - Multi-select */}
                <div className="space-y-2">
                  <Label>Years in Business</Label>
                  <div className="space-y-2 border rounded-lg p-3">
                    {["5+", "10+", "15+", "20+"].map((option) => (
                      <div key={option} className="flex items-center space-x-2">
                        <Checkbox
                          id={`years-${option}`}
                          checked={config.yearsInBusiness.includes(option)}
                          onCheckedChange={() => 
                            setConfig({
                              ...config,
                              yearsInBusiness: toggleArrayValue(config.yearsInBusiness, option)
                            })
                          }
                        />
                        <label
                          htmlFor={`years-${option}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {option} years
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Funding Status - Multi-select */}
                <div className="space-y-2">
                  <Label>Funding Status</Label>
                  <div className="space-y-2 border rounded-lg p-3">
                    {["Bootstrapped", "VC-backed", "PE-backed", "Search Fund"].map((option) => (
                      <div key={option} className="flex items-center space-x-2">
                        <Checkbox
                          id={`funding-${option}`}
                          checked={config.fundingStatus.includes(option)}
                          onCheckedChange={() => 
                            setConfig({
                              ...config,
                              fundingStatus: toggleArrayValue(config.fundingStatus, option)
                            })
                          }
                        />
                        <label
                          htmlFor={`funding-${option}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {option}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Growth Status - Multi-select */}
                <div className="space-y-2">
                  <Label>Growth Status</Label>
                  <div className="space-y-2 border rounded-lg p-3">
                    {["High growth", "Stable", "Mature"].map((option) => (
                      <div key={option} className="flex items-center space-x-2">
                        <Checkbox
                          id={`growth-${option}`}
                          checked={config.growthStatus.includes(option)}
                          onCheckedChange={() => 
                            setConfig({
                              ...config,
                              growthStatus: toggleArrayValue(config.growthStatus, option)
                            })
                          }
                        />
                        <label
                          htmlFor={`growth-${option}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {option}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Auto-Approval Rules */}
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

          {/* Schedule */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="active">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Runs Sunday, Tuesday, Thursday at 7 PM CST
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

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            className="flex-1"
            onClick={() => saveConfig.mutate()}
            disabled={saveConfig.isPending}
          >
            {saveConfig.isPending ? "Saving..." : "Save Configuration"}
          </Button>
          <Button 
            variant="outline"
            onClick={() => runDiscovery.mutate()}
            disabled={runDiscovery.isPending}
          >
            <PlayCircle className="h-4 w-4 mr-2" />
            {runDiscovery.isPending ? "Running..." : "Run Now"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
