import { useState, useMemo, useRef, useEffect } from "react";
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
  Plus,
  Folder,
  FolderPlus,
  FileText,
  X,
  Mail,
  Send,
  Edit2,
  CheckCircle,
  Loader2,
  Copy,
  MessageSquare,
  MoreVertical,
  FolderInput,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";

// Types
type FolderNode = {
  id: number;
  name: string;
  parentId: number | null;
  children: FolderNode[];
  path: string; // e.g., "Apple > Gaming"
};

type FolderTreeNode = FolderNode & {
  count: number; // reports in this folder (excluding descendants)
};

// Utility functions
function buildFolderTree(
  flat: any[],
  parentId: number | null = null,
  path: string = ""
): FolderNode[] {
  return flat
    .filter((f) => f.parentId === parentId)
    .map((f) => {
      const newPath = path ? `${path} > ${f.name}` : f.name;
      return {
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        path: newPath,
        children: buildFolderTree(flat, f.id, newPath),
      };
    });
}

function getDescendantIds(node: FolderNode): number[] {
  const ids = [node.id];
  for (const child of node.children) {
    ids.push(...getDescendantIds(child));
  }
  return ids;
}

function findNodeById(nodes: FolderNode[], id: number): FolderNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNodeById(node.children, id);
    if (found) return found;
  }
  return null;
}

function getAncestorIds(flat: any[], id: number): number[] {
  const ids: number[] = [];
  let current = flat.find((f) => f.id === id);
  while (current?.parentId) {
    ids.push(current.parentId);
    current = flat.find((f) => f.id === current!.parentId);
  }
  return ids;
}

export default function LibraryPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [filterIndustry, setFilterIndustry] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date");
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(
    new Set()
  );
  const [newFolderParentId, setNewFolderParentId] = useState<number | null>(
    null
  );
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: reports, isLoading } = useQuery({
    queryKey: ["/api/reports"],
  });

  const { data: savedFolders = [] } = useQuery({
    queryKey: ["/api/folders"],
  });

  const { data: fullReport, isLoading: isLoadingReport } = useQuery({
    queryKey: [`/api/reports/${selectedReportId}`],
    enabled: selectedReportId !== null,
  });

  const createFolderMutation = useMutation({
    mutationFn: async ({ name, parentId }: { name: string; parentId: number | null }) => {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create folder");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Folder Created", description: `"${data.name}" folder has been created` });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setNewFolderDialogOpen(false);
      setNewFolderName("");
      setNewFolderParentId(null);
      if (newFolderParentId) {
        setExpandedFolderIds((prev) => new Set([...prev, newFolderParentId]));
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete folder");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Folder Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
    },
  });

  // Memos for tree structure and counts
  const folderTree = useMemo(() => {
    return buildFolderTree(savedFolders);
  }, [savedFolders]);

  const folderPathMap = useMemo(() => {
    const map = new Map<number, string>();
    if (!savedFolders) return map;

    function traverse(flat: any[], id: number): string {
      const folder = flat.find((f) => f.id === id);
      if (!folder) return "";
      if (!folder.parentId) return folder.name;
      const parentPath = traverse(flat, folder.parentId);
      return parentPath ? `${parentPath} > ${folder.name}` : folder.name;
    }

    savedFolders.forEach((f: any) => {
      map.set(f.id, traverse(savedFolders, f.id));
    });

    return map;
  }, [savedFolders]);

  const descendantCounts = useMemo(() => {
    const counts = new Map<number, number>();
    if (!reports || !folderTree) return counts;

    function countDescendants(node: FolderNode): number {
      const ids = getDescendantIds(node);
      const count = reports.filter((r: any) => ids.includes(r.folderId)).length;
      counts.set(node.id, count);
      for (const child of node.children) {
        countDescendants(child);
      }
      return count;
    }

    folderTree.forEach((node) => countDescendants(node));
    return counts;
  }, [reports, folderTree]);

  const allFoldersFlat = useMemo(() => {
    if (!savedFolders) return [];
    return savedFolders.map((f: any) => ({
      id: f.id,
      path: folderPathMap.get(f.id) || f.name,
    }));
  }, [savedFolders, folderPathMap]);

  const getNewFolderParentPath = useMemo(() => {
    if (!newFolderParentId) return "Root";
    return folderPathMap.get(newFolderParentId) || "Unknown";
  }, [newFolderParentId, folderPathMap]);

  // Filter reports based on selection
  const filteredReports = reports
    ?.filter((report: any) => {
      // Folder filtering
      if (selectedFolder === "all") {
        if (report.isArchived) return false;
      } else if (selectedFolder === "starred") {
        if (!report.isStarred) return false;
        if (report.isArchived) return false;
      } else if (selectedFolder === "archived") {
        if (!report.isArchived) return false;
      } else if (selectedFolder.startsWith("folder:")) {
        const folderId = parseInt(selectedFolder.slice("folder:".length));
        if (!isNaN(folderId)) {
          // Get the folder node
          const folderNode = findNodeById(folderTree, folderId);
          if (!folderNode) return false;
          // Get all descendant IDs including the folder itself
          const descendantIds = getDescendantIds(folderNode);
          if (!descendantIds.includes(report.folderId)) return false;
        }
      }

      // Search filter
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

  const industries = [...new Set(reports?.map((r: any) => r.industry).filter(Boolean))];

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
                <button
                  onClick={() => setSelectedFolder("all")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedFolder === "all"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4" />
                    <span className="font-medium">All Reports</span>
                  </div>
                  <Badge variant="secondary">
                    {reports?.filter((r: any) => !r.isArchived).length || 0}
                  </Badge>
                </button>

                <button
                  onClick={() => setSelectedFolder("starred")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedFolder === "starred"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    <span className="font-medium">Starred</span>
                  </div>
                  <Badge variant="secondary">
                    {reports?.filter((r: any) => r.isStarred && !r.isArchived).length || 0}
                  </Badge>
                </button>

                <button
                  onClick={() => setSelectedFolder("archived")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedFolder === "archived"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Archive className="h-4 w-4" />
                    <span className="font-medium">Archived</span>
                  </div>
                  <Badge variant="secondary">
                    {reports?.filter((r: any) => r.isArchived).length || 0}
                  </Badge>
                </button>

                <Separator className="my-2" />

                <ScrollArea className="h-80">
                  <div className="space-y-1 pr-4">
                    {folderTree.map((node) => (
                      <FolderTreeItem
                        key={node.id}
                        node={node}
                        depth={0}
                        selectedFolder={selectedFolder}
                        onSelectFolder={setSelectedFolder}
                        expandedIds={expandedFolderIds}
                        onToggleExpanded={(id) => {
                          setExpandedFolderIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(id)) {
                              next.delete(id);
                            } else {
                              next.add(id);
                            }
                            return next;
                          });
                        }}
                        descendantCounts={descendantCounts}
                        onCreateSubfolder={(parentId) => {
                          setNewFolderParentId(parentId);
                          setNewFolderDialogOpen(true);
                          setNewFolderName("");
                        }}
                        onDeleteFolder={(id) => deleteFolderMutation.mutate(id)}
                      />
                    ))}
                  </div>
                </ScrollArea>

                <Separator className="my-2" />
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-gray-100 transition-colors"
                  onClick={() => {
                    setNewFolderParentId(null);
                    setNewFolderDialogOpen(true);
                    setNewFolderName("");
                  }}
                >
                  <FolderPlus className="h-4 w-4" />
                  <span>New Folder</span>
                </button>
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
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Starred</span>
                  <span className="font-bold">{reports?.filter((r: any) => r.isStarred).length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Archived</span>
                  <span className="font-bold">{reports?.filter((r: any) => r.isArchived).length || 0}</span>
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
                    allFoldersFlat={allFoldersFlat}
                    folderPathMap={folderPathMap}
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
                    {selectedFolder !== "all" ? "No reports in this folder." : "Start by running a discovery search"}
                  </p>
                  {selectedFolder === "all" && (
                    <Link href="/agent">
                      <Button>Go to Agent Dashboard</Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent className="max-w-sm bg-white text-black">
          <DialogHeader>
            <DialogTitle className="text-black">
              Create New Folder {newFolderParentId ? `in ${getNewFolderParentPath}` : ""}
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Enter a name for your new folder
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Folder name (e.g., 'Gaming Companies', 'Q4 Targets')"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newFolderName.trim()) {
                  createFolderMutation.mutate({
                    name: newFolderName.trim(),
                    parentId: newFolderParentId,
                  });
                }
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setNewFolderDialogOpen(false);
                  setNewFolderName("");
                  setNewFolderParentId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  createFolderMutation.mutate({
                    name: newFolderName.trim(),
                    parentId: newFolderParentId,
                  });
                }}
                disabled={!newFolderName.trim() || createFolderMutation.isPending}
              >
                {createFolderMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Create Folder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedReportId !== null} onOpenChange={(open) => !open && setSelectedReportId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-white text-black">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl text-black">
                {fullReport?.companyName || "Loading..."}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {fullReport?.report && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-black border-gray-300 hover:bg-gray-100"
                    onClick={() => {
                      const printWindow = window.open("", "_blank");
                      if (printWindow) {
                        printWindow.document.write(`
                          <html><head><title>${fullReport.companyName} - Research Report</title>
                          <style>
                            body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #111; line-height: 1.6; }
                            h1 { font-size: 24px; margin-bottom: 8px; }
                            h2 { font-size: 20px; margin-top: 24px; }
                            h3 { font-size: 16px; }
                            pre { white-space: pre-wrap; font-family: inherit; }
                            .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
                            @media print { body { margin: 20px; } }
                          </style></head><body>
                          <h1>${fullReport.companyName}</h1>
                          <div class="meta">
                            ${fullReport.industry ? `Industry: ${fullReport.industry} | ` : ""}
                            ${fullReport.revenueRange ? `Revenue: ${fullReport.revenueRange} | ` : ""}
                            ${fullReport.geographicFocus || ""}
                          </div>
                          <pre>${fullReport.report.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
                          </body></html>
                        `);
                        printWindow.document.close();
                        printWindow.print();
                      }
                    }}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Print / PDF
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-black hover:bg-gray-100"
                  onClick={() => setSelectedReportId(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {fullReport?.websiteUrl && (
              <DialogDescription>
                <a
                  href={fullReport.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1"
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
                <div className="max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm bg-white text-black p-4 rounded-lg">
                    {fullReport.report}
                  </pre>
                </div>
                <Separator className="my-6" />
                {selectedReportId && <OutreachSection reportId={selectedReportId} />}
              </>
            ) : (
              <div className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No report content available.</p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FolderTreeItem({
  node,
  depth,
  selectedFolder,
  onSelectFolder,
  expandedIds,
  onToggleExpanded,
  descendantCounts,
  onCreateSubfolder,
  onDeleteFolder,
}: {
  node: FolderNode;
  depth: number;
  selectedFolder: string;
  onSelectFolder: (id: string) => void;
  expandedIds: Set<number>;
  onToggleExpanded: (id: number) => void;
  descendantCounts: Map<number, number>;
  onCreateSubfolder: (parentId: number) => void;
  onDeleteFolder: (id: number) => void;
}) {
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedFolder === `folder:${node.id}`;
  const count = descendantCounts.get(node.id) || 0;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center justify-between px-2 py-1 rounded text-sm transition-colors ${
          isSelected ? "bg-primary text-primary-foreground" : "hover:bg-gray-100"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <button
          className="flex items-center gap-1 flex-1 text-left"
          onClick={() => {
            if (hasChildren) {
              onToggleExpanded(node.id);
            }
            onSelectFolder(`folder:${node.id}`);
          }}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpanded(node.id);
              }}
              className="p-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <div className="w-4" />
          )}
          <Folder className="h-4 w-4" />
          <span className="font-medium truncate">{node.name}</span>
        </button>
        <Badge variant="secondary" className="ml-2 flex-shrink-0">
          {count}
        </Badge>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCreateSubfolder(node.id);
          }}
          className="p-1 hover:bg-gray-200 rounded ml-1 opacity-0 hover:opacity-100 transition-opacity"
          title="Add subfolder"
        >
          <FolderPlus className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteFolder(node.id);
          }}
          className="p-1 hover:bg-red-100 hover:text-red-600 rounded ml-1 opacity-0 hover:opacity-100 transition-opacity"
          title="Delete folder"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <FolderTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedFolder={selectedFolder}
              onSelectFolder={onSelectFolder}
              expandedIds={expandedIds}
              onToggleExpanded={onToggleExpanded}
              descendantCounts={descendantCounts}
              onCreateSubfolder={onCreateSubfolder}
              onDeleteFolder={onDeleteFolder}
            />
          ))}
        </div>
      )}
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
        <h3 className="text-lg font-semibold flex items-center gap-2 text-black">
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

      {isLoading && <p className="text-sm text-muted-foreground">Loading outreach messages...</p>}

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
                {msg.strategy && <Badge variant="outline">{msg.strategy}</Badge>}
                {msg.wasSent && (
                  <Badge className="bg-green-500/10 text-green-700">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Sent
                  </Badge>
                )}
                {msg.wasEdited && <Badge variant="secondary">Edited</Badge>}
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
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
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

function ReportCard({
  report,
  allFoldersFlat,
  folderPathMap,
  onViewReport,
}: {
  report: any;
  allFoldersFlat: { id: number; path: string }[];
  folderPathMap: Map<number, string>;
  onViewReport: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(report.companyName);
  const [newFolderFromCardOpen, setNewFolderFromCardOpen] = useState(false);
  const [newFolderFromCardName, setNewFolderFromCardName] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const nameMutation = useMutation({
    mutationFn: async (companyName: string) => {
      const res = await fetch(`/api/reports/${report.id}/name`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName }),
      });
      if (!res.ok) throw new Error("Failed to update name");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      setEditingName(false);
    },
  });

  const saveName = () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== report.companyName) {
      nameMutation.mutate(trimmed);
    } else {
      setNameValue(report.companyName);
      setEditingName(false);
    }
  };

  const starMutation = useMutation({
    mutationFn: async (isStarred: boolean) => {
      const res = await fetch(`/api/reports/${report.id}/star`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isStarred }),
      });
      if (!res.ok) throw new Error("Failed to toggle star");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
    },
  });

  const folderMutation = useMutation({
    mutationFn: async (folderId: number | null) => {
      const res = await fetch(`/api/reports/${report.id}/folder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      });
      if (!res.ok) throw new Error("Failed to move report");
      return res.json();
    },
    onSuccess: (_data, folderId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      const folderPath = folderId ? folderPathMap.get(folderId) : "All Reports";
      toast({
        title: folderId ? `Moved to ${folderPath}` : "Moved to All Reports",
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (isArchived: boolean) => {
      const res = await fetch(`/api/reports/${report.id}/archive`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived }),
      });
      if (!res.ok) throw new Error("Failed to archive");
      return res.json();
    },
    onSuccess: (_data, isArchived) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      toast({ title: isArchived ? "Archived" : "Unarchived" });
    },
  });

  const createAndMoveFolderMutation = useMutation({
    mutationFn: async (folderName: string) => {
      const createRes = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: folderName, parentId: null }),
      });
      const folder = await createRes.json();

      if (!createRes.ok) throw new Error(folder.error || "Failed to create folder");

      const moveRes = await fetch(`/api/reports/${report.id}/folder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: folder.id }),
      });
      if (!moveRes.ok) throw new Error("Failed to move report");
      return moveRes.json();
    },
    onSuccess: (_data, folderName) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      toast({
        title: "Folder Created & Report Moved",
        description: `Report moved to "${folderName}"`,
      });
      setNewFolderFromCardOpen(false);
      setNewFolderFromCardName("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleMenuAction = (folderId: number | null) => {
    setMenuOpen(false);
    folderMutation.mutate(folderId);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {editingName ? (
                <input
                  ref={nameInputRef}
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") {
                      setNameValue(report.companyName);
                      setEditingName(false);
                    }
                  }}
                  className="text-xl font-semibold bg-transparent border-b-2 border-primary outline-none px-0 py-0 min-w-0 flex-1"
                />
              ) : (
                <CardTitle
                  className="text-xl cursor-pointer hover:text-primary transition-colors group/name flex items-center gap-1"
                  title="Click to edit company name"
                  onClick={() => {
                    setNameValue(report.companyName);
                    setEditingName(true);
                  }}
                >
                  {report.companyName}
                  <Edit2 className="h-3 w-3 opacity-0 group-hover/name:opacity-50 transition-opacity" />
                </CardTitle>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => starMutation.mutate(!report.isStarred)}
                disabled={starMutation.isPending}
                className="ml-auto"
              >
                <Star
                  className={`h-4 w-4 ${report.isStarred ? "fill-yellow-400 text-yellow-400" : ""}`}
                />
              </Button>
              <div className="relative" ref={menuRef}>
                <Button variant="ghost" size="icon" onClick={() => setMenuOpen(!menuOpen)}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] bg-white border rounded-md shadow-lg py-1">
                    {report.isArchived ? (
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 text-left"
                        onClick={() => {
                          setMenuOpen(false);
                          archiveMutation.mutate(false);
                        }}
                      >
                        <ArchiveRestore className="h-4 w-4" />
                        Unarchive
                      </button>
                    ) : (
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 text-left"
                        onClick={() => {
                          setMenuOpen(false);
                          archiveMutation.mutate(true);
                        }}
                      >
                        <Archive className="h-4 w-4" />
                        Archive
                      </button>
                    )}
                    {report.folderId && (
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 text-left"
                        onClick={() => handleMenuAction(null)}
                      >
                        <Folder className="h-4 w-4" />
                        Remove from folder
                      </button>
                    )}
                    {allFoldersFlat.filter((f) => f.id !== report.folderId).length > 0 && (
                      <div className="border-t my-1" />
                    )}
                    {allFoldersFlat
                      .filter((f) => f.id !== report.folderId)
                      .map((folder) => (
                        <button
                          key={folder.id}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 text-left"
                          onClick={() => handleMenuAction(folder.id)}
                        >
                          <FolderInput className="h-4 w-4" />
                          Move to {folder.path}
                        </button>
                      ))}
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 text-left"
                      onClick={() => {
                        setMenuOpen(false);
                        setNewFolderFromCardOpen(true);
                        setNewFolderFromCardName("");
                      }}
                    >
                      <FolderPlus className="h-4 w-4" />
                      New folder...
                    </button>
                  </div>
                )}
              </div>
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
          {report.folderId && !report.isArchived && (
            <Badge variant="secondary">
              <Folder className="h-3 w-3 mr-1" />
              {folderPathMap.get(report.folderId) || "Unknown"}
            </Badge>
          )}
          {report.isArchived && (
            <Badge variant="secondary">
              <Archive className="h-3 w-3 mr-1" />
              Archived
            </Badge>
          )}
        </div>

        {report.executiveSummary && (
          <p className="text-sm text-muted-foreground line-clamp-2">{report.executiveSummary}</p>
        )}

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

      <Dialog open={newFolderFromCardOpen} onOpenChange={setNewFolderFromCardOpen}>
        <DialogContent className="max-w-sm bg-white text-black">
          <DialogHeader>
            <DialogTitle className="text-black">Create New Folder</DialogTitle>
            <DialogDescription className="text-gray-600">
              Create a folder and move this report into it
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Folder name"
              value={newFolderFromCardName}
              onChange={(e) => setNewFolderFromCardName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newFolderFromCardName.trim()) {
                  createAndMoveFolderMutation.mutate(newFolderFromCardName.trim());
                }
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setNewFolderFromCardOpen(false);
                  setNewFolderFromCardName("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  createAndMoveFolderMutation.mutate(newFolderFromCardName.trim())
                }
                disabled={
                  !newFolderFromCardName.trim() || createAndMoveFolderMutation.isPending
                }
              >
                {createAndMoveFolderMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Create & Move
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
