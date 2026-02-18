import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Users,
  ShieldCheck,
  TrendingUp,
  FileText,
  Calendar,
  CheckCircle,
  Clock,
  Flame,
} from "lucide-react";

const SECTOR_EMOJIS: Record<string, string> = {
  healthcare: "🏥",
  "home healthcare": "🏥",
  technology: "💻",
  manufacturing: "🏭",
  logistics: "🚛",
  construction: "🏗️",
  "food & beverage": "🍽️",
  "financial services": "💰",
  insurance: "🛡️",
  "business services": "📊",
  education: "🎓",
  energy: "⚡",
  retail: "🛒",
  "real estate": "🏠",
  automotive: "🚗",
  defense: "🎖️",
  agriculture: "🌾",
  telecom: "📡",
  media: "📺",
  pharma: "💊",
};

function getSectorEmoji(sectorName: string): string {
  const lower = sectorName.toLowerCase();
  for (const [key, emoji] of Object.entries(SECTOR_EMOJIS)) {
    if (lower.includes(key)) return emoji;
  }
  return "📈";
}

function getHeatColor(score: number): string {
  if (score >= 9) return "bg-red-500 text-white";
  if (score >= 7) return "bg-orange-500 text-white";
  if (score >= 5) return "bg-yellow-500 text-black";
  return "bg-gray-400 text-white";
}

export default function WeeklyIntelligencePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/weekly-intelligence/latest"],
  });

  const trend = data?.trend;
  const sectors = data?.sectors || [];

  const totalCompanies = sectors.reduce((sum: number, s: any) => sum + (s.companyCount || 0), 0);
  const totalContacts = sectors.reduce((sum: number, s: any) => sum + (s.contactCount || 0), 0);
  const totalPeFiltered = sectors.reduce((sum: number, s: any) => sum + (s.peBackedFiltered || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                Weekly Intelligence
              </h1>
              <p className="text-sm text-muted-foreground">
                Sell-side lead generation &mdash; market intelligence for company owners
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="container max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Status bar */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <p className="text-muted-foreground">Loading latest scan...</p>
            ) : trend ? (
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Last Scan: {new Date(trend.weekStarting).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {trend.scanCompletedAt ? (
                    <Badge className="bg-green-500/10 text-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Complete
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <Clock className="h-3 w-3 mr-1" />
                      In Progress
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <strong>{sectors.length}</strong> Sectors
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 className="h-4 w-4 text-blue-500" />
                    <strong>{totalCompanies}</strong> Companies
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-purple-500" />
                    <strong>{totalContacts}</strong> Contacts
                  </span>
                  {totalPeFiltered > 0 && (
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="h-4 w-4 text-green-600" />
                      <strong>{totalPeFiltered}</strong> PE-Backed Filtered
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Scans Yet</h3>
                <p className="text-muted-foreground">
                  Weekly intelligence scans will appear here once the first scan runs.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hot Sectors Grid */}
        {sectors.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sectors.map((sector: any) => (
              <Card key={sector.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span>{getSectorEmoji(sector.sectorName)}</span>
                      {sector.sectorName}
                    </CardTitle>
                    <Badge className={getHeatColor(sector.heatScore)}>
                      <Flame className="h-3 w-3 mr-1" />
                      {sector.heatScore}/10
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sector.reasoning && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {sector.reasoning}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      <Building2 className="h-3 w-3 mr-1" />
                      {sector.companyCount} companies
                    </Badge>
                    <Badge variant="outline">
                      <Users className="h-3 w-3 mr-1" />
                      {sector.contactCount} contacts
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {sector.dealActivity && (
                      <Badge variant="secondary" className="text-xs">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {sector.dealActivity}
                      </Badge>
                    )}
                    {sector.averageMultiple && (
                      <Badge variant="secondary" className="text-xs">
                        {sector.averageMultiple}
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      $20-100M Revenue Range
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      PE-Backed Excluded
                    </Badge>
                  </div>

                  <div className="pt-2 border-t flex items-center justify-between">
                    {sector.newsletterSentAt ? (
                      <Badge className="bg-green-500/10 text-green-700 text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Sent
                      </Badge>
                    ) : (
                      <span />
                    )}
                    {sector.newsletterId ? (
                      <Link href={`/newsletter/${sector.newsletterId}`}>
                        <Button variant="outline" size="sm">
                          <FileText className="h-4 w-4 mr-2" />
                          View Newsletter
                        </Button>
                      </Link>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Newsletter pending
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
