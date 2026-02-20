import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, BookOpen, AlertCircle, BarChart3, Search } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            Cebron Research Agent
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            AI-powered M&A target discovery and research platform
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link href="/agent">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <Bot className="h-10 w-10 mb-4 text-primary" />
                <CardTitle>Discovery Agent</CardTitle>
                <CardDescription>
                  Configure automated discovery, set criteria, and monitor workflows
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">Open Agent</Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/review-queue">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border-orange-200 bg-orange-50/50">
              <CardHeader>
                <AlertCircle className="h-10 w-10 mb-4 text-orange-600" />
                <CardTitle>Review Queue</CardTitle>
                <CardDescription>
                  Review and approve companies pending manual approval
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  View Queue
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/research">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border-blue-200 bg-blue-50/50">
              <CardHeader>
                <Search className="h-10 w-10 mb-4 text-blue-600" />
                <CardTitle>Company Research</CardTitle>
                <CardDescription>
                  Research specific companies by name or upload a list
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Research Now
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/library">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <BookOpen className="h-10 w-10 mb-4 text-primary" />
                <CardTitle>Research Library</CardTitle>
                <CardDescription>
                  Browse completed research reports and organize targets
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">View Library</Button>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
