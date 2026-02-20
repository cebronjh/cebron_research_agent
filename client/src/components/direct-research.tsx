import { useState, useRef, useMemo } from "react";
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
import { useToast } from "@/components/ui/use-toast";
import {
  Search,
  Upload,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Trash2,
} from "lucide-react";

interface CompanyEntry {
  name: string;
  websiteUrl?: string;
}

export function DirectResearch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Single company form
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [strategy, setStrategy] = useState<string>("buy-side");

  // Bulk upload
  const [bulkCompanies, setBulkCompanies] = useState<CompanyEntry[]>([]);
  const [bulkStrategy, setBulkStrategy] = useState<string>("buy-side");

  // Poll workflows for progress tracking
  const { data: workflows } = useQuery({
    queryKey: ["/api/workflows"],
    refetchInterval: 3000,
  });

  // Find direct research workflows (running or recently completed)
  const directWorkflows = useMemo(() => {
    if (!Array.isArray(workflows)) return [];
    return workflows
      .filter((w: any) => w.triggerType === "direct")
      .slice(0, 5);
  }, [workflows]);

  const activeWorkflow = useMemo(() => {
    return directWorkflows.find((w: any) => w.status === "running");
  }, [directWorkflows]);

  // Fetch queue items for active workflow
  const { data: queueItems } = useQuery({
    queryKey: ["/api/workflows/" + activeWorkflow?.id + "/companies"],
    enabled: !!activeWorkflow,
    refetchInterval: 3000,
  });

  // Research mutation
  const researchMutation = useMutation({
    mutationFn: async (payload: { companies: CompanyEntry[]; strategy: string }) => {
      const res = await fetch("/api/research/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to start research");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      toast({ title: "Research started", description: "You can track progress below." });
      setCompanyName("");
      setWebsiteUrl("");
      setBulkCompanies([]);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSingleResearch = () => {
    if (!companyName.trim()) return;
    researchMutation.mutate({
      companies: [{ name: companyName.trim(), websiteUrl: websiteUrl.trim() || undefined }],
      strategy,
    });
  };

  const handleBulkResearch = () => {
    if (bulkCompanies.length === 0) return;
    researchMutation.mutate({
      companies: bulkCompanies,
      strategy: bulkStrategy,
    });
  };

  const handleDownloadTemplate = () => {
    const csv = "Company Name,Website URL\nAcme Corp,https://acmecorp.com\nGlobal Industries,\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "research-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim());
      // Skip header row
      const companies: CompanyEntry[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",");
        const name = parts[0]?.trim().replace(/^"|"$/g, "");
        const url = parts[1]?.trim().replace(/^"|"$/g, "");
        if (name) {
          companies.push({ name, websiteUrl: url || undefined });
        }
      }
      if (companies.length === 0) {
        toast({ title: "No companies found", description: "CSV must have at least one company after the header row.", variant: "destructive" });
        return;
      }
      if (companies.length > 25) {
        toast({ title: "Too many companies", description: "Maximum 25 companies per upload. Your file has " + companies.length + ".", variant: "destructive" });
        return;
      }
      setBulkCompanies(companies);
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeBulkCompany = (index: number) => {
    setBulkCompanies(prev => prev.filter((_, i) => i !== index));
  };

  const isResearching = researchMutation.isPending || !!activeWorkflow;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Company Research</h2>
        <p className="text-muted-foreground mt-1">
          Research specific companies by name or upload a list
        </p>
      </div>

      {/* Single Company Research */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Research a Company
          </CardTitle>
          <CardDescription>
            Enter a company name to generate a full M&A research report
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name *</Label>
              <Input
                id="company-name"
                placeholder="e.g. Acme Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSingleResearch()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website-url">Website URL (optional)</Label>
              <Input
                id="website-url"
                placeholder="e.g. https://acmecorp.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSingleResearch()}
              />
            </div>
          </div>
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label>Strategy</Label>
              <Select value={strategy} onValueChange={setStrategy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy-side">Buy-Side</SelectItem>
                  <SelectItem value="sell-side">Sell-Side</SelectItem>
                  <SelectItem value="dual">Dual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleSingleResearch}
              disabled={!companyName.trim() || isResearching}
            >
              {researchMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Research
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Research */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Research
          </CardTitle>
          <CardDescription>
            Upload a CSV file with multiple companies to research at once (max 25)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload CSV
              </Button>
            </div>
          </div>

          {bulkCompanies.length > 0 && (
            <>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">#</th>
                      <th className="text-left px-4 py-2 font-medium">Company Name</th>
                      <th className="text-left px-4 py-2 font-medium">Website URL</th>
                      <th className="px-4 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkCompanies.map((company, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-4 py-2 text-muted-foreground">{index + 1}</td>
                        <td className="px-4 py-2">{company.name}</td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {company.websiteUrl || "—"}
                        </td>
                        <td className="px-4 py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeBulkCompany(index)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-end gap-4">
                <div className="space-y-2">
                  <Label>Strategy</Label>
                  <Select value={bulkStrategy} onValueChange={setBulkStrategy}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy-side">Buy-Side</SelectItem>
                      <SelectItem value="sell-side">Sell-Side</SelectItem>
                      <SelectItem value="dual">Dual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleBulkResearch}
                  disabled={isResearching}
                >
                  {researchMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Research All ({bulkCompanies.length})
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Research Progress */}
      {directWorkflows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {activeWorkflow ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              )}
              Research Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {directWorkflows.map((workflow: any) => (
              <div key={workflow.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        workflow.status === "running" ? "default" :
                        workflow.status === "completed" ? "secondary" : "destructive"
                      }
                    >
                      {workflow.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {workflow.companiesResearched} / {workflow.companiesFound} companies researched
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(workflow.createdAt).toLocaleString()}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary rounded-full h-2 transition-all"
                    style={{
                      width: workflow.companiesFound > 0
                        ? `${(workflow.companiesResearched / workflow.companiesFound) * 100}%`
                        : "0%",
                    }}
                  />
                </div>

                {/* Per-company status for active workflow */}
                {workflow.id === activeWorkflow?.id && Array.isArray(queueItems) && queueItems.length > 0 && (
                  <div className="space-y-1.5">
                    {queueItems.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-2 text-sm">
                        {item.researchStatus === "completed" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        ) : item.researchStatus === "in_progress" ? (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
                        ) : item.researchStatus === "failed" ? (
                          <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span>{item.companyName}</span>
                        {item.reportId && (
                          <Link href={`/library`}>
                            <span className="text-xs text-blue-600 hover:underline flex items-center gap-1 cursor-pointer">
                              View Report <ExternalLink className="h-3 w-3" />
                            </span>
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Link to library when complete */}
                {workflow.status === "completed" && (
                  <Link href="/library">
                    <Button variant="outline" size="sm" className="mt-2">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Reports in Library
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
