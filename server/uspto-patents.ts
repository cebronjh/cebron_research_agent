// server/uspto-patents.ts

/**
 * USPTO Patent Integration
 * 
 * API: https://developer.uspto.gov/
 * Cost: FREE (no API key needed)
 * Rate limit: 1000+ requests/day
 */

interface Patent {
  patentNumber: string;
  title: string;
  abstract: string;
  inventors: string[];
  assignee: string;
  filingDate: string;
  grantDate: string;
  status: 'active' | 'expired' | 'pending';
  classifications: string[];
}

interface PatentIntelligence {
  totalPatents: number;
  activePatents: number;
  pendingApplications: number;
  patents: Patent[];
  keyInventors: { name: string; count: number }[];
  technologyAreas: string[];
  recentActivity: boolean;
  innovationScore: 'High' | 'Medium' | 'Low' | 'None';
}

export class USPTOPatentService {
  private baseUrl = 'https://api.patentsview.org/patents/query';

  /**
   * Search for patents by company name
   */
  async searchPatents(companyName: string): Promise<PatentIntelligence> {
    try {
      // Query USPTO API
      const query = {
        q: { assignee_organization: companyName },
        f: [
          'patent_number',
          'patent_title',
          'patent_abstract',
          'patent_date',
          'app_date',
          'inventor_last_name',
          'inventor_first_name',
          'assignee_organization',
          'cpc_section_id',
        ],
        o: { per_page: 100 },
      };

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query),
      });

      if (!response.ok) {
        console.error('USPTO API error:', response.statusText);
        return this.emptyResult();
      }

      const data = await response.json();
      
      if (!data.patents || data.patents.length === 0) {
        console.log(`No patents found for ${companyName}`);
        return this.emptyResult();
      }

      return this.analyzePatents(data.patents);
      
    } catch (error) {
      console.error('Error fetching patents:', error);
      return this.emptyResult();
    }
  }

  /**
   * Analyze patents to extract intelligence
   */
  private analyzePatents(rawPatents: any[]): PatentIntelligence {
    const patents: Patent[] = rawPatents.map((p) => ({
      patentNumber: p.patent_number,
      title: p.patent_title,
      abstract: p.patent_abstract || '',
      inventors: p.inventors?.map((i: any) => 
        `${i.inventor_first_name} ${i.inventor_last_name}`
      ) || [],
      assignee: p.assignee_organization || '',
      filingDate: p.app_date || '',
      grantDate: p.patent_date || '',
      status: this.determineStatus(p.patent_date),
      classifications: p.cpcs?.map((c: any) => c.cpc_section_id) || [],
    }));

    // Count active vs expired
    const now = new Date();
    const activePatents = patents.filter((p) => {
      const grantDate = new Date(p.grantDate);
      const expiryDate = new Date(grantDate);
      expiryDate.setFullYear(grantDate.getFullYear() + 20); // Patents last 20 years
      return expiryDate > now && p.status === 'active';
    });

    // Find key inventors
    const inventorCounts = new Map<string, number>();
    patents.forEach((p) => {
      p.inventors.forEach((inventor) => {
        inventorCounts.set(inventor, (inventorCounts.get(inventor) || 0) + 1);
      });
    });

    const keyInventors = Array.from(inventorCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Extract technology areas
    const techAreas = new Set<string>();
    patents.forEach((p) => {
      p.classifications.forEach((c) => techAreas.add(c));
    });

    // Check for recent activity
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(now.getFullYear() - 2);
    const recentActivity = patents.some(
      (p) => new Date(p.filingDate) > twoYearsAgo
    );

    // Innovation score
    const innovationScore = this.calculateInnovationScore(
      patents.length,
      activePatents.length,
      recentActivity
    );

    return {
      totalPatents: patents.length,
      activePatents: activePatents.length,
      pendingApplications: 0, // Would need separate API for applications
      patents,
      keyInventors,
      technologyAreas: Array.from(techAreas).slice(0, 10),
      recentActivity,
      innovationScore,
    };
  }

  /**
   * Determine patent status
   */
  private determineStatus(grantDate: string): 'active' | 'expired' | 'pending' {
    if (!grantDate) return 'pending';
    
    const grant = new Date(grantDate);
    const expiry = new Date(grant);
    expiry.setFullYear(grant.getFullYear() + 20);
    
    return expiry > new Date() ? 'active' : 'expired';
  }

  /**
   * Calculate innovation score
   */
  private calculateInnovationScore(
    total: number,
    active: number,
    recentActivity: boolean
  ): 'High' | 'Medium' | 'Low' | 'None' {
    if (total === 0) return 'None';
    if (active >= 5 && recentActivity) return 'High';
    if (active >= 3 || recentActivity) return 'Medium';
    return 'Low';
  }

  /**
   * Empty result when no patents found
   */
  private emptyResult(): PatentIntelligence {
    return {
      totalPatents: 0,
      activePatents: 0,
      pendingApplications: 0,
      patents: [],
      keyInventors: [],
      technologyAreas: [],
      recentActivity: false,
      innovationScore: 'None',
    };
  }

  /**
   * Format patent data for research report
   */
  formatForReport(intelligence: PatentIntelligence): string {
    if (intelligence.totalPatents === 0) {
      return `## Patent & IP Intelligence

No patents found in USPTO database. Company may:
- Be too new to have filed patents
- Operate in a non-patentable industry
- Use trade secrets instead of patents
- Have patents under a different entity name`;
    }

    let report = `## Patent & IP Intelligence

**Innovation Score: ${intelligence.innovationScore}**

### Patent Portfolio
- **Total Patents:** ${intelligence.totalPatents}
- **Active Patents:** ${intelligence.activePatents} (valid until expiry)
- **Recent Activity:** ${intelligence.recentActivity ? 'Yes - filed patents in last 2 years' : 'No recent filings'}

`;

    if (intelligence.keyInventors.length > 0) {
      report += `### Key Inventors (Retention Risk)
`;
      intelligence.keyInventors.forEach((inventor) => {
        report += `- **${inventor.name}** (${inventor.count} patents)\n`;
      });
      report += '\n';
    }

    if (intelligence.technologyAreas.length > 0) {
      report += `### Technology Areas
${intelligence.technologyAreas.map(area => `- ${area}`).join('\n')}

`;
    }

    if (intelligence.patents.length > 0) {
      report += `### Recent Patents (Sample)
`;
      // Show 3 most recent patents
      const recent = intelligence.patents
        .sort((a, b) => new Date(b.grantDate).getTime() - new Date(a.grantDate).getTime())
        .slice(0, 3);

      recent.forEach((patent) => {
        report += `
**${patent.title}**
- Patent #: ${patent.patentNumber}
- Grant Date: ${patent.grantDate}
- Status: ${patent.status}
- Inventors: ${patent.inventors.slice(0, 3).join(', ')}
`;
      });
    }

    report += `
### M&A Implications
`;
    if (intelligence.innovationScore === 'High') {
      report += `- ✓ Strong IP moat - defensible competitive position
- ✓ Active R&D culture - innovation-driven
- ✓ Key inventors to retain in acquisition
- ✓ Patent portfolio adds valuation premium`;
    } else if (intelligence.innovationScore === 'Medium') {
      report += `- Moderate IP protection
- Some innovation capability
- Patents may be aging (expiring soon)
- Consider R&D investment post-acquisition`;
    } else {
      report += `- Limited IP protection
- No recent patent activity
- May rely on trade secrets or execution
- Innovation risk in competitive market`;
    }

    return report;
  }
}

// Usage in agent workflow
export async function addPatentIntelligence(
  companyName: string,
  baseReport: string
): Promise<string> {
  const patentService = new USPTOPatentService();
  const intelligence = await patentService.searchPatents(companyName);
  const patentSection = patentService.formatForReport(intelligence);
  
  // Append to research report
  return `${baseReport}\n\n${patentSection}`;
}
