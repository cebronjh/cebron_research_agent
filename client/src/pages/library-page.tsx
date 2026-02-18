import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Card,
  CardContent,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen,
  ArrowLeft,
  Search,
  Star,
  Archive,
  Clock,
  TrendingUp,
  ExternalLink,
  Tag,
  Plus,
  Folder,
  FileText,
  X,
  Mail,
  Send,
  Edit2,
  CheckCircle,
  Loader2,
  Copy,
  MessageSquare,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";

type Folder = {
  id: string;
  name: string;
  type: string;
  count: number;
};

export default function LibraryPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [filterIndustry, setFilterIndustry] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date");
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);

  const { data: reports, isLoading } = useQuery({
    queryKey: ["/api/reports"],
  });

  const { data: fullReport, isLoading: isLoadingReport } = useQuery({
    queryKey: [`/api/reports/${selectedReportId}`],
    enabled: selectedReportId !== null,
  });

  const folders: Folder[] = [
    { id: "all", name: "All Reports", type: "custom", count: reports?.length || 0 },
    { id: "starred", name: "Starred", type: "starred", count: 0 },
    { id: "archived", name: "Archived", type: "archived", count: 0 },
  ];

  const industries = [...new Set(reports?.map((r: any) => r.industry).filter(Boolean))];

  const filteredReports = reports
    ?.filter((report: any) => {
      if (searchTerm && !report.companyName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (filterIndustry !== "all" && report.industry !== filterIndustry) {
        return false;
      }
      return true;
    })
    .sort((a: any, b: any) => {
      if (sortBy === "date") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "name") {
        return a.companyName.localeCompare(b.companyName);
      }
      return 0;
    });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <BookOpen className="h-6 w-6" />
                  Research Library
                </h1>
                <p className="text-sm text-muted-foreground">
                  {filteredReports?.length || 0} companies researched
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Folders</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolder(folder.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedFolder === folder.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {folder.type === "starred" && <Star className="h-4 w-4" />}
                      {folder.type === "archived" && <Archive className="h-4 w-4" />}
                      {folder.type === "custom" && <Folder className="h-4 w-4" />}
                      <span className="font-medium">{folder.name}</span>
                    </div>
                    <Badge variant="secondary">{folder.count}</Badge>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-lg">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Reports</span>
                  <span className="font-bold">{reports?.length || 0}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="col-span-12 lg:col-span-9 space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search companies..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select value={filterIndustry} onValueChange={setFilterIndustry}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Industries" />
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

                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Date (Newest)</SelectItem>
                      <SelectItem value="name">Name (A-Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {isLoading ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Loading reports...</p>
                </CardContent>
              </Card>
            ) : filteredReports && filteredReports.length > 0 ? (
              <div className="space-y-4">
                {filteredReports.map((report: any) => (
                  <ReportCard 
                    key={report.id} 
                    report={report}
                    onViewReport={(id) => setSelectedReportId(id)}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Reports Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start by running a discovery search
                  </p>
                  <Link href="/agent">
                    <Button>Go to Agent Dashboard</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Dialog open={selectedReportId !== null} onOpenChange={(open) => !open && setSelectedReportId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl">
                {fullReport?.companyName || "Loading..."}
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedReportId(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {fullReport?.websiteUrl && (
              <DialogDescription>
                <a
                  href={fullReport.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  {fullReport.websiteUrl}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </DialogDescription>
            )}
          </DialogHeader>

          <ScrollArea className="max-h-[70vh] pr-4">
            {isLoadingReport ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">Loading report...</p>
              </div>
            ) : fullReport?.report ? (
              <>
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {fullReport.report}
                  </pre>
                </div>
                <Separator className="my-6" />
                {selectedReportId && (
                  <OutreachSection reportId={selectedReportId} />
                )}
              </>
            ) : (
              <div className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No report content available.
                </p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OutreachSection({ reportId }: { reportId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const { data: outreachMessages = [], isLoading } = useQuery({
    queryKey: [`/api/reports/${reportId}/outreach`],
  });

  const generateMutation = useMutation({
    mutationFn: async (strategy: string) => {
      const res = await fetch(`/api/reports/${reportId}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate outreach");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Outreach Generated", description: "New outreach message created" });
      queryClient.invalidateQueries({ queryKey: [`/api/reports/${reportId}/outreach`] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, editedMessage }: { id: number; editedMessage: string }) => {
      const res = await fetch(`/api/outreach/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editedMessage }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Outreach message updated" });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: [`/api/reports/${reportId}/outreach`] });
    },
  });

  const markSentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/outreach/${id}/sent`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to mark as sent");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Marked as Sent" });
      queryClient.invalidateQueries({ queryKey: [`/api/reports/${reportId}/outreach`] });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Outreach Messages
        </h3>
        <Button
          size="sm"
          onClick={() => generateMutation.mutate("buy-side")}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          {generateMutation.isPending ? "Generating..." : "Generate Outreach"}
        </Button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading outreach messages...</p>
      )}

      {outreachMessages.length === 0 && !isLoading && (
        <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed">
          <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No outreach messages yet. Generate one to get started.
          </p>
        </div>
      )}

      {outreachMessages.map((msg: any) => (
        <Card key={msg.id} className="border">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {msg.strategy && (
                  <Badge variant="outline">{msg.strategy}</Badge>
                )}
                {msg.wasSent && (
                  <Badge className="bg-green-500/10 text-green-700">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Sent
                  </Badge>
                )}
                {msg.wasEdited && (
                  <Badge variant="secondary">Edited</Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(msg.createdAt).toLocaleDateString()}
              </span>
            </div>

            {editingId === msg.id ? (
              <div className="space-y-2">
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={10}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => saveMutation.mutate({ id: msg.id, editedMessage: editText })}
                    disabled={saveMutation.isPending}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm bg-gray-50 p-3 rounded-lg border">
                {msg.editedMessage || msg.originalMessage}
              </pre>
            )}

            {editingId !== msg.id && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(msg.editedMessage || msg.originalMessage)}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(msg.id);
                    setEditText(msg.editedMessage || msg.originalMessage);
                  }}
                >
                  <Edit2 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                {!msg.wasSent && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markSentMutation.mutate(msg.id)}
                    disabled={markSentMutation.isPending}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Mark Sent
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ReportCard({ report, onViewReport }: { report: any; onViewReport: (id: number) => void }) {
  const [isStarred, setIsStarred] = useState(false);
  const [tags, setTags] = useState<string[]>([]);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <CardTitle className="text-xl">{report.companyName}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsStarred(!isStarred)}
                className="ml-auto"
              >
                <Star className={`h-4 w-4 ${isStarred ? "fill-yellow-400 text-yellow-400" : ""}`} />
              </Button>
            </div>
            {report.websiteUrl && (
              <p className="text-sm text-muted-foreground">{report.websiteUrl}</p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {report.industry && <Badge variant="outline">{report.industry}</Badge>}
          {report.revenueRange && (
            <Badge variant="outline">
              <TrendingUp className="h-3 w-3 mr-1" />
              {report.revenueRange}
            </Badge>
          )}
          {report.geographicFocus && <Badge variant="outline">{report.geographicFocus}</Badge>}
        </div>

        {report.executiveSummary && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {report.executiveSummary}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              <Tag className="h-3 w-3" />
              {tag}
            </Badge>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs"
            onClick={() => {
              const newTag = prompt("Add tag:");
              if (newTag) setTags([...tags, newTag]);
            }}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Tag
          </Button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {new Date(report.createdAt).toLocaleDateString()}
          </div>
          <Button variant="outline" size="sm" onClick={() => onViewReport(report.id)}>
            <FileText className="h-4 w-4 mr-2" />
            View Report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
