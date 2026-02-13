import { useState, useMemo } from "react";
import { Search, Filter, Building2, MapPin, DollarSign, TrendingUp, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface ResearchSnippet {
  id: number;
  companyName: string;
  websiteUrl: string;
  industry: string | null;
  revenueRange: string | null;
  geographicFocus: string | null;
  createdAt: string;
  
  // Extracted from research report
  executiveSummary?: string;
  recommendation?: "Buy-Side" | "Sell-Side" | "Dual Approach";
  confidence?: "High" | "Medium" | "Low";
  estimatedRevenue?: string;
  estimatedValuation?: string;
  topReason?: string;
}

interface ResearchLibraryProps {
  reports: ResearchSnippet[];
  onSelectReport: (reportId: number) => void;
}

export function ResearchLibrary({ reports, onSelectReport }: ResearchLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [strategyFilter, setStrategyFilter] = useState<string>("all");
  const [confidenceFilter, setConfidenceFilter] = useState<string>("all");

  // Extract unique values for filters
  const industries = useMemo(() => {
    const uniqueIndustries = new Set(
      reports
        .map((r) => r.industry)
        .filter((i): i is string => i !== null && i !== undefined)
    );
    return Array.from(uniqueIndustries).sort();
  }, [reports]);

  const regions = useMemo(() => {
    const uniqueRegions = new Set(
      reports
        .map((r) => r.geographicFocus)
        .filter((g): g is string => g !== null && g !== undefined)
    );
    return Array.from(uniqueRegions).sort();
  }, [reports]);

  // Filter and search logic
  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      // Search query (searches name, industry, region)
      const matchesSearch =
        searchQuery === "" ||
        report.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.industry?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.geographicFocus?.toLowerCase().includes(searchQuery.toLowerCase());

      // Industry filter
      const matchesIndustry =
        industryFilter === "all" || report.industry === industryFilter;

      // Region filter
      const matchesRegion =
        regionFilter === "all" || report.geographicFocus === regionFilter;

      // Strategy filter
      const matchesStrategy =
        strategyFilter === "all" || report.recommendation === strategyFilter;

      // Confidence filter
      const matchesConfidence =
        confidenceFilter === "all" || report.confidence === confidenceFilter;

      return (
        matchesSearch &&
        matchesIndustry &&
        matchesRegion &&
        matchesStrategy &&
        matchesConfidence
      );
    });
  }, [reports, searchQuery, industryFilter, regionFilter, strategyFilter, confidenceFilter]);

  const clearFilters = () => {
    setSearchQuery("");
    setIndustryFilter("all");
    setRegionFilter("all");
    setStrategyFilter("all");
    setConfidenceFilter("all");
  };

  const hasActiveFilters =
    searchQuery !== "" ||
    industryFilter !== "all" ||
    regionFilter !== "all" ||
    strategyFilter !== "all" ||
    confidenceFilter !== "all";

  return (
    <div className="flex flex-col h-full">
      {/* Search and Filter Bar */}
      <div className="p-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies, industries, or regions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters} size="sm">
              Clear Filters
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Select value={industryFilter} onValueChange={setIndustryFilter}>
            <SelectTrigger className="w-[200px]">
              <Building2 className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Industries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Industries</SelectItem>
              {industries.map((industry) => (
                <SelectItem key={industry} value={industry}>
                  {industry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="w-[200px]">
              <MapPin className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {regions.map((region) => (
                <SelectItem key={region} value={region}>
                  {region}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={strategyFilter} onValueChange={setStrategyFilter}>
            <SelectTrigger className="w-[200px]">
              <TrendingUp className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Strategies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Strategies</SelectItem>
              <SelectItem value="Buy-Side">Buy-Side</SelectItem>
              <SelectItem value="Sell-Side">Sell-Side</SelectItem>
              <SelectItem value="Dual Approach">Dual Approach</SelectItem>
            </SelectContent>
          </Select>

          <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Confidence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Confidence</SelectItem>
              <SelectItem value="High">High Confidence</SelectItem>
              <SelectItem value="Medium">Medium Confidence</SelectItem>
              <SelectItem value="Low">Low Confidence</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 text-sm text-muted-foreground">
          Showing {filteredReports.length} of {reports.length} companies
        </div>
      </div>

      {/* Results Grid */}
      <ScrollArea className="flex-1">
        <div className="p-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredReports.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No companies found matching your search criteria</p>
              {hasActiveFilters && (
                <Button
                  variant="link"
                  onClick={clearFilters}
                  className="mt-2"
                >
                  Clear filters to see all companies
                </Button>
              )}
            </div>
          ) : (
            filteredReports.map((report) => (
              <CompanyCard
                key={report.id}
                report={report}
                onClick={() => onSelectReport(report.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface CompanyCardProps {
  report: ResearchSnippet;
  onClick: () => void;
}

function CompanyCard({ report, onClick }: CompanyCardProps) {
  const getConfidenceColor = (confidence?: string) => {
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

  const getStrategyColor = (strategy?: string) => {
    switch (strategy) {
      case "Buy-Side":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
      case "Sell-Side":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400";
      case "Dual Approach":
        return "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400";
      default:
        return "bg-gray-500/10 text-gray-700 dark:text-gray-400";
    }
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <CardTitle className="text-lg line-clamp-1">
            {report.companyName}
          </CardTitle>
          {report.confidence && (
            <Badge
              variant="secondary"
              className={getConfidenceColor(report.confidence)}
            >
              {report.confidence}
            </Badge>
          )}
        </div>
        {report.recommendation && (
          <Badge variant="outline" className={getStrategyColor(report.recommendation)}>
            {report.recommendation}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {report.executiveSummary && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {report.executiveSummary}
          </p>
        )}

        <Separator />

        <div className="space-y-2 text-sm">
          {report.industry && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{report.industry}</span>
            </div>
          )}

          {report.geographicFocus && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{report.geographicFocus}</span>
            </div>
          )}

          {report.estimatedRevenue && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{report.estimatedRevenue}</span>
            </div>
          )}

          {report.estimatedValuation && (
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground font-medium">
                EV: {report.estimatedValuation}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              {new Date(report.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {report.topReason && (
          <>
            <Separator />
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Key Insight:</span>{" "}
              <span className="line-clamp-2">{report.topReason}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
