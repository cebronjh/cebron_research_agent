// server/uspto-patents.ts

/**
 * USPTO Patents API Integration
 * 
 * API: https://api.patentsview.org
 * Cost: FREE (no API key required)
 * Rate limit: No published limit
 * 
 * Provides patent intelligence for M&A analysis
 */

interface Patent {
  patentNumber: string;
  title: string;
  filingDate: string;
  grantDate: string;
  abstract: string;
  inventors: string[];
  assignee: string;
  citations: number;
  technologyArea: string;
}

interface PatentIntelligence {
  totalPatents: number;
  activePatents: Patent[];
  pendingApplications: number;
  keyInventors: { name: string; patentCount: number }[];
  technologyAreas: { area: string; count: number }[];
  innovationScore: 'High' | 'Medium' | 'Low' | 'None';
  patentValuation: string;
  oldestPatent?: string;
  newestPatent?: string;
}

export class USPTOPatentService {
  private baseUrl = 'https://api.patentsview.org';

  /**
   * Get all patent intelligence for a company
   */
  async getCompanyPatentIntelligence(companyName: string): Promise<PatentIntelligence> {
    try {
      const patents = await this.searchPatents(companyName);

      if (patents.length === 0) {
        return this.emptyResult();
      }

      // Extract key inventors
      const inventors = this.extractKeyInventors(patents);

      // Group by technology area
      const techAreas = this.groupByTechnology(patents);

      // Calculate innovation score
      const innovationScore = this.calculateInnovationScore(patents.length, techAreas);

      // Estimate patent valuation
      const valuation = this.estimatePatentValuation(patents.length, innovationScore);

      // Get date range
      const dates = patents.map(p => new Date(p.grantDate || p.filingDate)).filter(d => !isNaN(d.getTime()));
      const oldestPatent = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))).toISOString().split('T')[0] : undefined;
      const newestPatent = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))).toISOString().split('T')[0] : undefined;

      return {
        totalPatents: patents.length,
        activePatents: patents.slice(0, 20),
        pendingApplications: 0, // Would need separate API call
        keyInventors: inventors,
        technologyAreas: techAreas,
        innovationScore,
        patentValuation: valuation,
        oldestPatent,
        newestPatent,
      };
    } catch (error) {
      console.error('Error fetching patent data:', error);
      return this.emptyResult();
    }
  }

  /**
   * Search USPTO for company patents
   */
  private async searchPatents(companyName: string): Promise<Patent[]> {
    try {
      const searchUrl = `${this.baseUrl}/patents/query?q={"_and":[{"assignee_organization":"${encodeURIComponent(companyName)}"}]}&f=["patent_number","patent_title","patent_date","app_date","patent_abstract","inventor_first_name","inventor_last_name","assignee_organization","cited_patent_count"]&o={"per_page":100}`;

      const response = await fetch(searchUrl);
      if (!response.ok) {
        console.error('USPTO API error:', response.statusText);
        return [];
      }

      const data = await response.json();

      if (!data.patents || data.patents.length === 0) {
        return [];
      }

      return data.patents.map((item: any) => ({
        patentNumber: item.patent_number || '',
        title: item.patent_title || '',
        filingDate: item.app_date || '',
        grantDate: item.patent_date || '',
        abstract: item.patent_abstract || '',
        inventors: this.extractInventorNames(item),
        assignee: item.assignee_organization || companyName,
        citations: parseInt(item.cited_patent_count) || 0,
        technologyArea: this.categorizeTechnology(item.patent_title || '', item.patent_abstract || ''),
      }));
    } catch (error) {
      console.error('Error searching patents:', error);
      return [];
    }
  }

  /**
   * Extract inventor names from patent data
   */
  private extractInventorNames(patent: any): string[] {
    const names: string[] = [];
    
    if (Array.isArray(patent.inventor_first_name) && Array.isArray(patent.inventor_last_name)) {
      for (let i = 0; i < patent.inventor_first_name.length; i++) {
        const firstName = patent.inventor_first_name[i] || '';
        const lastName = patent.inventor_last_name[i] || '';
        if (firstName || lastName) {
          names.push(`${firstName} ${lastName}`.trim());
        }
      }
    }

    return names;
  }

  /**
   * Categorize patent by technology area
   */
  private categorizeTechnology(title: string, abstract: string): string {
    const text = (title + ' ' + abstract).toLowerCase();

    if (text.match(/robot|automation|mechanical/)) return 'Robotics & Automation';
    if (text.match(/software|algorithm|computer|ai|machine learning/)) return 'Software & AI';
    if (text.match(/medical|surgical|diagnostic|therapeutic/)) return 'Medical Devices';
    if (text.match(/pharma|drug|compound|molecule/)) return 'Pharmaceuticals';
    if (text.match(/biotech|genetic|protein|antibody/)) return 'Biotechnology';
    if (text.match(/chemical|material|polymer/)) return 'Materials & Chemistry';
    if (text.match(/electronic|circuit|semiconductor/)) return 'Electronics';
    if (text.match(/communication|network|wireless/)) return 'Telecommunications';
    if (text.match(/energy|battery|solar|power/)) return 'Energy';

    return 'Other';
  }

  /**
   * Extract key inventors
   */
  private extractKeyInventors(patents: Patent[]): { name: string; patentCount: number }[] {
    const inventorCounts: Record<string, number> = {};

    patents.forEach(patent => {
      patent.inventors.forEach(inventor => {
        if (inventor && inventor.trim()) {
          inventorCounts[inventor] = (inventorCounts[inventor] || 0) + 1;
        }
      });
    });

    return Object.entries(inventorCounts)
      .map(([name, count]) => ({ name, patentCount: count }))
      .sort((a, b) => b.patentCount - a.patentCount)
      .slice(0, 5);
  }

  /**
   * Group patents by technology area
   */
  private groupByTechnology(patents: Patent[]): { area: string; count: number }[] {
    const areaCounts: Record<string, number> = {};

    patents.forEach(patent => {
      const area = patent.technologyArea;
      areaCounts[area] = (areaCounts[area] || 0) + 1;
    });

    return Object.entries(areaCounts)
      .map(([area, count]) => ({ area, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Calculate innovation score
   */
  private calculateInnovationScore(
    patentCount: number,
    techAreas: { area: string; count: number }[]
  ): 'High' | 'Medium' | 'Low' | 'None' {
    if (patentCount === 0) return 'None';
    if (patentCount >= 10) return 'High';
    if (patentCount >= 5) return 'Medium';
    return 'Low';
  }

  /**
   * Estimate patent portfolio valuation
   */
  private estimatePatentValuation(patentCount: number, innovationScore: string): string {
    if (patentCount === 0) return '$0';

    let baseValue = 0;
    if (innovationScore === 'High') baseValue = patentCount * 1500000; // $1.5M per patent
    else if (innovationScore === 'Medium') baseValue = patentCount * 800000; // $800K per patent
    else baseValue = patentCount * 400000; // $400K per patent

    const low = baseValue * 0.7;
    const high = baseValue * 1.3;

    const formatMillion = (num: number) => `$${(num / 1000000).toFixed(1)}M`;

    return `${formatMillion(low)}-${formatMillion(high)}`;
  }

  /**
   * Empty result
   */
  private emptyResult(): PatentIntelligence {
    return {
      totalPatents: 0,
      activePatents: [],
      pendingApplications: 0,
      keyInventors: [],
      technologyAreas: [],
      innovationScore: 'None',
      patentValuation: '$0',
    };
  }

  /**
   * Format patent data for research report
   */
  formatForReport(intelligence: PatentIntelligence, companyName: string): string {
    if (intelligence.totalPatents === 0) {
      return `## Patent & IP Intelligence (USPTO)

No patents found for "${companyName}" in USPTO database. This indicates:
- No issued patents under this company name
- May operate under different legal entity for IP
- Technology may be trade-secret based rather than patented
- Early stage company without patent filings yet
- Acquired technology rather than internally developed

**Innovation Score:** None

**M&A Implications:**
- No patent moat - technology may be replicable
- Verify if operating under license from another entity
- Check for trade secrets and know-how value
- May rely on speed-to-market rather than IP protection`;
    }

    let report = `## Patent & IP Intelligence (USPTO)

**Innovation Score:** ${intelligence.innovationScore}
**Total Active Patents:** ${intelligence.totalPatents}
**Estimated Patent Portfolio Value:** ${intelligence.patentValuation}
`;

    if (intelligence.oldestPatent && intelligence.newestPatent) {
      report += `**Patent Date Range:** ${intelligence.oldestPatent} to ${intelligence.newestPatent}
`;
    }

    report += '\n';

    // Core patents
    if (intelligence.activePatents.length > 0) {
      report += `### Core Patent Portfolio

`;
      intelligence.activePatents.slice(0, 5).forEach((patent, index) => {
        report += `**${index + 1}. ${patent.title}**
- Patent #: ${patent.patentNumber}
- Grant Date: ${patent.grantDate}
- Citations: ${patent.citations} (${patent.citations > 10 ? 'strong validation' : patent.citations > 5 ? 'moderate validation' : 'early stage'})
- Technology: ${patent.technologyArea}

`;
      });

      if (intelligence.activePatents.length > 5) {
        report += `*...and ${intelligence.activePatents.length - 5} more patents*

`;
      }
    }

    // Key inventors
    if (intelligence.keyInventors.length > 0) {
      report += `### Key Inventors (Retention Risk Assessment)

`;
      intelligence.keyInventors.forEach(inventor => {
        const riskLevel = inventor.patentCount >= 5 ? 'CRITICAL' : inventor.patentCount >= 3 ? 'HIGH' : 'MEDIUM';
        report += `**${inventor.name}** - ${inventor.patentCount} patents
- Retention Risk: ${riskLevel}
- ${inventor.patentCount >= 5 ? 'Core technical talent - employment agreement essential' : inventor.patentCount >= 3 ? 'Important technical contributor - retention bonus recommended' : 'Contributing inventor - standard retention'}

`;
      });
    }

    // Technology areas
    if (intelligence.technologyAreas.length > 0) {
      report += `### Technology Focus Areas

`;
      intelligence.technologyAreas.forEach(area => {
        const percentage = ((area.count / intelligence.totalPatents) * 100).toFixed(0);
        report += `- **${area.area}:** ${area.count} patents (${percentage}%)
`;
      });
      report += '\n';
    }

    // M&A implications
    report += `### M&A Implications

`;

    if (intelligence.innovationScore === 'High') {
      report += `✓ **STRONG IP MOAT**
- ${intelligence.totalPatents} patents create significant competitive barriers
- Patent portfolio valued at ${intelligence.patentValuation}
- Technology protected for 20 years from filing date
- Defensible market position

⚠️ **KEY PERSON DEPENDENCY**
- ${intelligence.keyInventors[0]?.name || 'Lead inventor'} holds ${intelligence.keyInventors[0]?.patentCount || 'multiple'} core patents
- Need strong employment agreement with IP assignment clauses
- Retention bonus recommended: 1-2% of purchase price
- Non-compete and non-solicitation essential

✓ **VALUATION IMPACT**
- Patent portfolio adds ${intelligence.patentValuation} standalone value
- Technology moat supports premium valuation
- IP can be licensed separately if needed
- Increases strategic buyer interest`;
    } else if (intelligence.innovationScore === 'Medium') {
      report += `✓ **MODERATE IP PROTECTION**
- ${intelligence.totalPatents} patents provide some competitive advantage
- Patent portfolio valued at ${intelligence.patentValuation}
- Sufficient for market differentiation
- Room for additional patent development

⚠️ **INVENTOR RETENTION**
- Key technical talent should be retained post-acquisition
- Standard retention agreements recommended
- Patents may have limited life remaining (check expiration dates)

💡 **OPPORTUNITY**
- Expand patent portfolio post-acquisition
- File additional applications in related areas
- International patent filings if not already done`;
    } else {
      report += `⚠️ **LIMITED IP PROTECTION**
- Only ${intelligence.totalPatents} patents - limited moat
- May rely on trade secrets and know-how
- Technology could be reverse-engineered
- Speed-to-market is key competitive advantage

🔍 **DUE DILIGENCE PRIORITIES**
- Verify trade secret protection measures
- Review employment agreements for IP assignment
- Check for freedom-to-operate (no infringement of others' patents)
- Assess technology roadmap and R&D pipeline

💡 **POST-ACQUISITION STRATEGY**
- Invest in patent prosecution (file additional patents)
- Protect key innovations before competitors
- Budget $100K-$200K/year for IP development`;
    }

    return report;
  }
}

/**
 * Add patent intelligence to research report
 */
export async function addPatentIntelligence(
  companyName: string,
  baseReport: string
): Promise<string> {
  const patentService = new USPTOPatentService();
  const intelligence = await patentService.getCompanyPatentIntelligence(companyName);
  const patentSection = patentService.formatForReport(intelligence, companyName);
  
  return `${baseReport}\n\n${patentSection}`;
}

/**
 * Evaluate if company has significant IP upside for <$10M revenue exception
 * Uses Claude to assess patent quality
 */
export async function evaluatePatentUpside(companyName: string): Promise<boolean> {
  try {
    // Search USPTO for patents
    const searchUrl = `https://api.patentsview.org/patents/query?q={"_and":[{"assignee_organization":"${encodeURIComponent(companyName)}"}]}&f=["patent_number","patent_title","patent_date","patent_abstract"]&o={"per_page":10}`;
    
    const response = await fetch(searchUrl);
    if (!response.ok) return false;
    
    const data = await response.json();
    const patents = data.patents || [];
    
    // Need at least 3 patents to consider
    if (patents.length < 3) {
      console.log(`[Agent] ${companyName} has only ${patents.length} patents - insufficient for IP upside`);
      return false;
    }

    // Use Claude to evaluate patent quality
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const patentSummary = patents.slice(0, 5).map((p: any) => 
      `- ${p.patent_title} (${p.patent_date}): ${(p.patent_abstract || '').substring(0, 200)}`
    ).join('\n');

    const prompt = `Evaluate if this patent portfolio represents significant IP upside that justifies pursuing a company with <$10M revenue:

Company: ${companyName}
Patent Count: ${patents.length}

Recent Patents:
${patentSummary}

Consider:
1. Technology innovation level (breakthrough vs incremental)
2. Market potential (large addressable market?)
3. Defensibility (strong patents vs weak)
4. Commercialization stage (early R&D vs market-ready)

Respond ONLY with JSON:
{
  "hasSignificantIPUpside": <true|false>,
  "reasoning": "<2-3 sentence explanation>"
}`;

    const result = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const text = result.content[0].type === "text" ? result.content[0].text : "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    const evaluation = JSON.parse(clean);

    console.log(`[Agent] IP Upside for ${companyName}: ${evaluation.hasSignificantIPUpside} - ${evaluation.reasoning}`);

    return evaluation.hasSignificantIPUpside;
  } catch (error) {
    console.error("Error evaluating patent upside:", error);
    return false;
  }
}
