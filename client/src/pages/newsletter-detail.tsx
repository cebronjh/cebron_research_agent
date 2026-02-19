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
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Copy,
  Mail,
  Phone,
  Globe,
  DollarSign,
  Building2,
  User,
  CheckCircle,
  FileText,
  Download,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

function getOwnershipColor(type: string | null): string {
  if (!type) return "bg-gray-100 text-gray-700";
  const lower = type.toLowerCase();
  if (lower.includes("founder")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (lower.includes("family")) return "bg-purple-50 text-purple-700 border-purple-200";
  if (lower.includes("independent")) return "bg-green-50 text-green-700 border-green-200";
  return "bg-gray-100 text-gray-700";
}

export default function NewsletterDetailPage({ id }: { id: string }) {
  const newsletterId = parseInt(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [`/api/newsletters/${newsletterId}`],
    enabled: !isNaN(newsletterId),
  });

  const markSentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/newsletters/${newsletterId}/mark-sent`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark as sent");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Marked as Sent", description: "Newsletter marked as sent" });
      queryClient.invalidateQueries({ queryKey: [`/api/newsletters/${newsletterId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-intelligence/latest"] });
    },
  });

  const newsletter = data?.newsletter;
  const sector = data?.sector;
  const trendWeek = data?.trendWeek;
  const contacts: any[] = data?.contacts || [];

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied to clipboard` });
    } catch {
      // Fallback for older browsers or permission issues
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast({ title: `${label} copied to clipboard` });
    }
  };

  const copyNewsletterHtml = async () => {
    try {
      // Copy as rich HTML so it pastes formatted into email clients
      const blob = new Blob([newsletter.content], { type: "text/html" });
      const plainBlob = new Blob([newsletter.content], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": blob,
          "text/plain": plainBlob,
        }),
      ]);
      toast({ title: "Newsletter copied as formatted HTML" });
    } catch {
      // Fallback: copy raw HTML text
      await copyToClipboard(newsletter.content, "Newsletter");
    }
  };

  const copyAllEmails = async () => {
    const emails = contacts
      .map((c) => c.contactEmail)
      .filter(Boolean);
    if (emails.length === 0) {
      toast({ title: "No emails to copy", variant: "destructive" });
      return;
    }
    await copyToClipboard(emails.join(", "), `${emails.length} emails`);
  };

  const exportCsv = () => {
    const headers = ["Company Name", "Contact Name", "Email", "Phone", "Website", "Estimated Revenue", "Ownership Type"];
    const rows = contacts.map((c) => [
      c.companyName || "",
      c.contactName || "",
      c.contactEmail || "",
      c.contactPhone || "",
      c.companyWebsite || "",
      c.estimatedRevenue || "",
      c.ownershipType || "",
    ]);
    const csv = [headers, ...rows].map((row) =>
      row.map((cell: string) => `"${cell.replace(/"/g, '""')}"`).join(",")
    ).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sector?.sectorName || "contacts"}-contacts.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV downloaded" });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-muted-foreground">Loading newsletter...</p>
      </div>
    );
  }

  if (!newsletter) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Newsletter Not Found</h3>
          <Link href="/weekly-intelligence">
            <Button variant="outline">Back to Weekly Intelligence</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/weekly-intelligence">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{newsletter.subject}</h1>
              {trendWeek && (
                <p className="text-sm text-muted-foreground">
                  Week of {new Date(trendWeek.weekStarting).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <ShieldCheck className="h-3 w-3 mr-1" />
                Independent Companies Only
              </Badge>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <DollarSign className="h-3 w-3 mr-1" />
                $20-100M Revenue
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="container max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Sector quick stats */}
        {sector && (
          <div className="flex flex-wrap gap-4">
            {sector.heatScore && (
              <Badge variant="secondary">Heat Score: {sector.heatScore}/10</Badge>
            )}
            {sector.dealActivity && (
              <Badge variant="secondary">{sector.dealActivity}</Badge>
            )}
            {sector.averageMultiple && (
              <Badge variant="secondary">{sector.averageMultiple}</Badge>
            )}
          </div>
        )}

        {/* Newsletter content */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Newsletter Content
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={copyNewsletterHtml}
              >
                <Copy className="h-3 w-3 mr-2" />
                Copy Newsletter
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className="bg-gray-50 p-6 rounded-lg border"
              dangerouslySetInnerHTML={{ __html: newsletter.content }}
            />
          </CardContent>
        </Card>

        {/* Contacts section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Contacts ({contacts.length})
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Founder-led and family-owned companies only &mdash; $20M-$100M annual revenue
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={copyAllEmails}>
                  <Mail className="h-3 w-3 mr-2" />
                  Copy All Emails
                </Button>
                <Button variant="outline" size="sm" onClick={exportCsv}>
                  <Download className="h-3 w-3 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {contacts.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No contacts found for this sector yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {contacts.map((contact: any) => (
                  <Card key={contact.id} className="border">
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          {contact.contactName && (
                            <p className="font-medium flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {contact.contactName}
                            </p>
                          )}
                          <p className="text-sm font-medium flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            {contact.companyName}
                          </p>
                        </div>
                        {contact.ownershipType && (
                          <Badge variant="outline" className={`text-xs ${getOwnershipColor(contact.ownershipType)}`}>
                            {contact.ownershipType}
                          </Badge>
                        )}
                      </div>

                      {contact.contactEmail && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {contact.contactEmail}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => copyToClipboard(contact.contactEmail, "Email")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}

                      {contact.contactPhone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {contact.contactPhone}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {contact.estimatedRevenue && (
                          <Badge variant="secondary" className="text-xs">
                            <DollarSign className="h-3 w-3 mr-1" />
                            {contact.estimatedRevenue}
                          </Badge>
                        )}
                        {contact.companyWebsite && (
                          <a
                            href={contact.companyWebsite.startsWith("http") ? contact.companyWebsite : `https://${contact.companyWebsite}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <Globe className="h-3 w-3" />
                            Website
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mark as Sent */}
        <div className="flex justify-end">
          {newsletter.sentAt ? (
            <Badge className="bg-green-500/10 text-green-700 text-sm py-2 px-4">
              <CheckCircle className="h-4 w-4 mr-2" />
              Sent on {new Date(newsletter.sentAt).toLocaleDateString()}
            </Badge>
          ) : (
            <Button
              onClick={() => markSentMutation.mutate()}
              disabled={markSentMutation.isPending}
            >
              {markSentMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Mark as Sent
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
