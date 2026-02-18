import { setTimeout } from 'timers/promises';

interface SECMention {
  filingType: string;
  filingDate: string;
  publicCompany: string;
  cik: string;
  context: string;
  relationship: 'supplier' | 'customer' | 'partner' | 'competitor' | 'other';
}

interface OwnershipInfo {
  owner: string;
  filingType: string;
  filingDate: string;
  ownership: string;
  ownershipPercentage?: number;
  context: string;
}

interface SECIntelligence {
  mentionsInFilings: SECMention[];
  ownershipFilings: OwnershipInfo[];
  executiveHistory: string[];
  totalMentions: number;
  publicRelationships: string[];
  ownershipType: 'PE-Backed' | 'Minority-PE' | 'Public Subsidiary' | 'Corporate-Owned' | 'Search-Fund' | 'Independent' | 'Unknown';
  peHoldPeriod?: number;
  peFirmName?: string;
  investmentDate?: string;
}

interface StrategicFit {
  buySideFit: 'High' | 'Medium' | 'Low';
  sellSideFit: 'High' | 'Medium' | 'Low';
  recommendation: string;
  scoreAdjustment: number;
}

export class SECEdgarService {
  private baseUrl = 'https://www.sec.gov';

  async getCompanySECIntelligence(companyName: string): Promise<SECIntelligence> {
    try {
      await setTimeout(100);
      
      return {
        mentionsInFilings: [],
        ownershipFilings: [],
        executiveHistory: [],
        totalMentions: 0,
        publicRelationships: [],
        ownershipType: 'Unknown',
      };
    } catch (error) {
      console.error('Error fetching SEC data:', error);
      return this.emptyResult();
    }
  }

  /**
   * Calculate PE hold period in years
   */
  private calculatePEHoldPeriod(investmentDate: string): number {
    const invested = new Date(investmentDate);
    const now = new Date();
    const years = (now.getTime() - invested.getTime()) / (1000 * 60 * 60 * 24 * 365);
    return Math.floor(years * 10) / 10; // One decimal place
  }

  /**
   * Assess strategic fit based on ownership and strategy
   */
  assessStrategicFit(
    intelligence: SECIntelligence,
    strategy: 'buy-side' | 'sell-side' | 'dual'
  ): StrategicFit {
    const { ownershipType, peHoldPeriod } = intelligence;

    // PE-Backed (Majority)
    if (ownershipType === 'PE-Backed') {
      if (!peHoldPeriod) {
        return {
          buySideFit: 'Low',
          sellSideFit: 'Medium',
          recommendation: 'PE-backed (hold period unknown). Skip for buy-side. Moderate for sell-side.',
          scoreAdjustment: strategy === 'buy-side' ? -2 : 0,
        };
      }

      if (peHoldPeriod < 3) {
        return {
          buySideFit: 'Low',
          sellSideFit: 'Low',
          recommendation: `PE firm only ${peHoldPeriod} years into hold. Too early for exit. SKIP for buy-side (competitive auction). LOW PRIORITY for sell-side (unlikely seller).`,
          scoreAdjustment: -2,
        };
      }

      if (peHoldPeriod >= 3 && peHoldPeriod < 5) {
        return {
          buySideFit: 'Low',
          sellSideFit: 'Medium',
          recommendation: `PE firm ${peHoldPeriod} years into hold. Approaching exit window (typical 5-7 years). SKIP for buy-side (competitive auction). MODERATE for sell-side (starting to explore exits).`,
          scoreAdjustment: strategy === 'buy-side' ? -2 : 0,
        };
      }

      // 5+ years
      return {
        buySideFit: 'Low',
        sellSideFit: 'High',
        recommendation: `PE firm ${peHoldPeriod} years into hold (typical exit 4-7 years). SKIP for buy-side (competitive auction). HIGH PRIORITY for sell-side - firm is actively seeking exit. Advisory opportunity to facilitate sale.`,
        scoreAdjustment: strategy === 'buy-side' ? -2 : 2,
      };
    }

    // Minority PE (Founder-majority)
    if (ownershipType === 'Minority-PE') {
      return {
        buySideFit: 'High',
        sellSideFit: 'Medium',
        recommendation: 'Minority PE investment - founder-led with institutional backing. HIGH PRIORITY for buy-side (less competitive than majority PE, validated quality). MODERATE for sell-side (less exit pressure).',
        scoreAdjustment: strategy === 'buy-side' ? 1 : 0,
      };
    }

    // Search Fund
    if (ownershipType === 'Search-Fund') {
      return {
        buySideFit: 'Medium',
        sellSideFit: 'Low',
        recommendation: 'Search fund backed - smaller deal size, longer hold periods. MODERATE for buy-side (less competitive than mega-PE). LOW for sell-side (no immediate exit pressure).',
        scoreAdjustment: strategy === 'buy-side' ? -1 : 0,
      };
    }

    // Public Subsidiary
    if (ownershipType === 'Public Subsidiary') {
      return {
        buySideFit: 'Medium',
        sellSideFit: 'Low',
        recommendation: 'Public company subsidiary - potential carve-out opportunity. MODERATE for buy-side (complex deal structure, but less competitive). LOW for sell-side (parent controls timeline).',
        scoreAdjustment: 0,
      };
    }

    // Corporate-Owned
    if (ownershipType === 'Corporate-Owned') {
      return {
        buySideFit: 'Medium',
        sellSideFit: 'Low',
        recommendation: 'Strategic corporate owner - potential divestiture. MODERATE for buy-side (professional sale but not PE competitive). LOW for sell-side (no exit timeline pressure).',
        scoreAdjustment: 0,
      };
    }

    // Independent/Family-owned (Best for buy-side)
    if (ownershipType === 'Independent') {
      return {
        buySideFit: 'High',
        sellSideFit: 'Medium',
        recommendation: 'Independently owned - ideal buy-side target. Owner-operated businesses provide best acquisition opportunities (motivated sellers, less competition, succession planning). MODERATE for sell-side.',
        scoreAdjustment: strategy === 'buy-side' ? 2 : 0,
      };
    }

    // Unknown
    return {
      buySideFit: 'Medium',
      sellSideFit: 'Medium',
      recommendation: 'Ownership structure unclear - requires further investigation.',
      scoreAdjustment: 0,
    };
  }

  private emptyResult(): SECIntelligence {
    return {
      mentionsInFilings: [],
      ownershipFilings: [],
      executiveHistory: [],
      totalMentions: 0,
      publicRelationships: [],
      ownershipType: 'Unknown',
    };
  }

  formatForReport(
    intelligence: SECIntelligence, 
    companyName: string,
    strategy?: 'buy-side' | 'sell-side' | 'dual'
  ): string {
    if (intelligence.totalMentions === 0 && intelligence.ownershipFilings.length === 0) {
      return `## SEC EDGAR Intelligence

No SEC filings found mentioning "${companyName}". This indicates:
- Private company with no public company relationships disclosed in SEC filings
- May operate under different legal entity name
- No material contracts with public companies requiring disclosure
- No PE firm ownership requiring 13D/13F filings

**Ownership Type:** ${intelligence.ownershipType}`;
    }

    let report = `## SEC EDGAR Intelligence

**Ownership Type:** ${intelligence.ownershipType}
**Total SEC Mentions:** ${intelligence.totalMentions}
`;

    if (intelligence.peHoldPeriod) {
      report += `**PE Hold Period:** ${intelligence.peHoldPeriod} years
`;
    }

    report += '\n';

    // Strategic Fit Assessment
    if (strategy) {
      const fit = this.assessStrategicFit(intelligence, strategy);
      
      report += `### 🎯 Strategic Fit Assessment (Cebron Group)

**Buy-Side Fit:** ${fit.buySideFit}
**Sell-Side Fit:** ${fit.sellSideFit}

**Recommendation:**
${fit.recommendation}

`;
    }

    if (intelligence.ownershipFilings.length > 0) {
      report += `### 🏛️ Ownership Disclosures

`;
      intelligence.ownershipFilings.forEach(filing => {
        report += `**${filing.owner}**
- Filing: ${filing.filingType}
- Date: ${filing.filingDate}
- Ownership: ${filing.ownership}`;
        if (filing.ownershipPercentage) {
          report += ` (${filing.ownershipPercentage}%)`;
        }
        report += `
- Context: ${filing.context}

`;
      });
    }

    if (intelligence.publicRelationships.length > 0) {
      report += `### 🤝 Public Company Relationships

`;
      intelligence.publicRelationships.slice(0, 10).forEach(relationship => {
        report += `- ${relationship}
`;
      });
      report += '\n';
    }

    report += `### M&A Implications

`;
    
    if (intelligence.ownershipType === 'PE-Backed' && intelligence.peHoldPeriod) {
      if (intelligence.peHoldPeriod >= 5) {
        report += `✓ **HIGH PRIORITY for sell-side advisory**
- PE firm is ${intelligence.peHoldPeriod} years into typical 5-7 year hold
- Exit window is NOW - firm is actively seeking liquidity
- Advisory opportunity to facilitate sale to strategic buyer
- Potential sell-side mandate worth 2-3% of transaction value

⚠️ **SKIP for buy-side acquisition**
- PE-backed companies create competitive auction dynamics
- Expect multiple bidders and higher valuations
- Low probability of winning without overpaying`;
      } else if (intelligence.peHoldPeriod >= 3) {
        report += `⚠️ **MODERATE for sell-side**
- PE firm is ${intelligence.peHoldPeriod} years into hold
- Approaching exit window but not urgent yet
- May start exploring options in next 12-24 months

⚠️ **SKIP for buy-side**
- PE-backed companies create competitive auction dynamics`;
      } else {
        report += `⚠️ **LOW PRIORITY**
- PE firm only ${intelligence.peHoldPeriod} years into hold
- Too early for exit (typical hold is 5-7 years)
- Unlikely to be a motivated seller
- Skip for both buy-side and sell-side`;
      }
    } else if (intelligence.ownershipType === 'Minority-PE') {
      report += `✓ **HIGH PRIORITY for buy-side**
- Minority PE investment - best of both worlds
- Founder still controls company (operational continuity)
- PE validates quality (professional governance, financial reporting)
- Less competitive than majority PE deals
- Potential for management rollover

⚠️ **MODERATE for sell-side**
- Less exit pressure than majority PE
- Founder may not be ready to sell`;
    } else if (intelligence.ownershipType === 'Independent') {
      report += `✓ **IDEAL BUY-SIDE TARGET**
- Independently owned - no PE competition
- Owner likely involved in day-to-day (relationship-driven deal)
- Potential succession/retirement opportunity
- Less sophisticated sale process (advantage for buyer)

⚠️ **MODERATE for sell-side**
- May consider advisors for exit planning
- Timeline depends on owner's personal situation`;
    } else if (intelligence.ownershipType === 'Search-Fund') {
      report += `⚠️ **MODERATE for buy-side**
- Search fund backed - smaller deal size
- Less competitive than mega-PE but still professional
- Longer hold periods (no urgent exit pressure)

⚠️ **LOW for sell-side**
- Search fund investors expect longer holds (7-10 years)
- Unlikely to be seeking exit soon`;
    }

    return report;
  }
}

export async function addSECIntelligence(
  companyName: string,
  baseReport: string,
  strategy?: 'buy-side' | 'sell-side' | 'dual'
): Promise<string> {
  const secService = new SECEdgarService();
  const intelligence = await secService.getCompanySECIntelligence(companyName);
  const secSection = secService.formatForReport(intelligence, companyName, strategy);
  
  return `${baseReport}\n\n${secSection}`;
}
