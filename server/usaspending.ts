interface FederalContract {
  contractId: string;
  awardAmount: number;
  description: string;
  awardingAgency: string;
  startDate: string;
  endDate: string;
  contractType: string;
  naicsCode: string;
  placeOfPerformance: string;
}

interface FederalGrant {
  grantId: string;
  awardAmount: number;
  description: string;
  awardingAgency: string;
  startDate: string;
  endDate: string;
}

interface GovernmentIntelligence {
  totalContracts: number;
  totalContractValue: number;
  activeContracts: number;
  activeContractValue: number;
  totalGrants: number;
  totalGrantValue: number;
  topAgencies: { agency: string; value: number }[];
  contracts: FederalContract[];
  grants: FederalGrant[];
  governmentDependency: 'High' | 'Medium' | 'Low' | 'None';
  securityClearance: boolean;
}

export class USASpendingService {
  private baseUrl = 'https://api.usaspending.gov/api/v2';

  async getGovernmentContracts(companyName: string): Promise<GovernmentIntelligence> {
    try {
      const [contracts, grants] = await Promise.all([
        this.searchContracts(companyName),
        this.searchGrants(companyName),
      ]);

      const totalContractValue = contracts.reduce((sum, c) => sum + c.awardAmount, 0);
      const totalGrantValue = grants.reduce((sum, g) => sum + g.awardAmount, 0);

      const now = new Date();
      const activeContracts = contracts.filter(c => new Date(c.endDate) > now);
      const activeContractValue = activeContracts.reduce((sum, c) => sum + c.awardAmount, 0);

      const agencyTotals = this.groupByAgency(contracts);
      const topAgencies = Object.entries(agencyTotals)
        .map(([agency, value]) => ({ agency, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      const securityClearance = contracts.some(c => 
        c.description.toLowerCase().includes('secret') ||
        c.description.toLowerCase().includes('classified') ||
        c.naicsCode.startsWith('5416')
      );

      const governmentDependency = this.calculateDependency(
        totalContractValue,
        activeContractValue,
        contracts.length
      );

      return {
        totalContracts: contracts.length,
        totalContractValue,
        activeContracts: activeContracts.length,
        activeContractValue,
        totalGrants: grants.length,
        totalGrantValue,
        topAgencies,
        contracts: contracts.slice(0, 20),
        grants: grants.slice(0, 10),
        governmentDependency,
        securityClearance,
      };
    } catch (error) {
      console.error('Error fetching USASpending data:', error);
      return this.emptyResult();
    }
  }

  private async searchContracts(companyName: string): Promise<FederalContract[]> {
    try {
      const searchPayload = {
        filters: {
          recipient_search_text: [companyName],
          award_type_codes: ['A', 'B', 'C', 'D'],
          time_period: [
            {
              start_date: '2020-01-01',
              end_date: new Date().toISOString().split('T')[0],
            }
          ],
        },
        page: 1,
        limit: 100,
        sort: 'Award Amount',
        order: 'desc',
      };

      const response = await fetch(`${this.baseUrl}/search/spending_by_award/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchPayload),
      });

      if (!response.ok) {
        console.error('USASpending API error:', response.statusText);
        return [];
      }

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        return [];
      }

      return data.results.map((item: any) => ({
        contractId: item.Award_ID || item.generated_unique_award_id || '',
        awardAmount: parseFloat(item.Award_Amount || item.total_obligation || 0),
        description: item.Description || item.description || '',
        awardingAgency: item.Awarding_Agency || item.awarding_agency_name || '',
        startDate: item.Start_Date || item.period_of_performance_start_date || '',
        endDate: item.End_Date || item.period_of_performance_current_end_date || '',
        contractType: item.Award_Type || item.type_description || '',
        naicsCode: item.NAICS_Code || item.naics_code || '',
        placeOfPerformance: item.Place_of_Performance || item.pop_city_name || '',
      }));
    } catch (error) {
      console.error('Error searching contracts:', error);
      return [];
    }
  }

  private async searchGrants(companyName: string): Promise<FederalGrant[]> {
    try {
      const searchPayload = {
        filters: {
          recipient_search_text: [companyName],
          award_type_codes: ['02', '03', '04', '05'],
          time_period: [
            {
              start_date: '2020-01-01',
              end_date: new Date().toISOString().split('T')[0],
            }
          ],
        },
        page: 1,
        limit: 50,
      };

      const response = await fetch(`${this.baseUrl}/search/spending_by_award/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchPayload),
      });

      if (!response.ok) return [];

      const data = await response.json();

      if (!data.results || data.results.length === 0) return [];

      return data.results.map((item: any) => ({
        grantId: item.generated_unique_award_id || '',
        awardAmount: parseFloat(item.total_obligation || 0),
        description: item.description || '',
        awardingAgency: item.awarding_agency_name || '',
        startDate: item.period_of_performance_start_date || '',
        endDate: item.period_of_performance_current_end_date || '',
      }));
    } catch (error) {
      console.error('Error searching grants:', error);
      return [];
    }
  }

  private groupByAgency(contracts: FederalContract[]): Record<string, number> {
    const totals: Record<string, number> = {};
    
    contracts.forEach(contract => {
      const agency = contract.awardingAgency || 'Unknown';
      totals[agency] = (totals[agency] || 0) + contract.awardAmount;
    });
    
    return totals;
  }

  private calculateDependency(
    totalValue: number,
    activeValue: number,
    contractCount: number
  ): 'High' | 'Medium' | 'Low' | 'None' {
    if (totalValue === 0) return 'None';
    if (activeValue > 10000000 || contractCount > 20) return 'High';
    if (activeValue > 1000000 || contractCount > 5) return 'Medium';
    return 'Low';
  }

  private emptyResult(): GovernmentIntelligence {
    return {
      totalContracts: 0,
      totalContractValue: 0,
      activeContracts: 0,
      activeContractValue: 0,
      totalGrants: 0,
      totalGrantValue: 0,
      topAgencies: [],
      contracts: [],
      grants: [],
      governmentDependency: 'None',
      securityClearance: false,
    };
  }

  formatForReport(intelligence: GovernmentIntelligence, companyName: string): string {
    if (intelligence.totalContracts === 0 && intelligence.totalGrants === 0) {
      return `## Federal Government Contracts

No federal contracts or grants found for "${companyName}". This indicates:
- Not a registered federal contractor
- May operate under different legal entity name
- No federal government revenue in USASpending database
- Focus on commercial/private sector customers`;
    }

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    };

    let report = `## Federal Government Contracts

**Government Dependency: ${intelligence.governmentDependency}**
**Security Clearance Required: ${intelligence.securityClearance ? 'Yes' : 'No'}**

### 📊 Contract Summary

- **Total Contracts (since 2020):** ${intelligence.totalContracts}
- **Total Contract Value:** ${formatCurrency(intelligence.totalContractValue)}
- **Active Contracts:** ${intelligence.activeContracts}
- **Active Contract Value:** ${formatCurrency(intelligence.activeContractValue)}
`;

    if (intelligence.totalGrants > 0) {
      report += `- **Total Grants:** ${intelligence.totalGrants}
- **Total Grant Value:** ${formatCurrency(intelligence.totalGrantValue)}
`;
    }

    report += '\n';

    if (intelligence.topAgencies.length > 0) {
      report += `### 🏛️ Top Federal Agencies

`;
      intelligence.topAgencies.forEach(({ agency, value }) => {
        const percentage = ((value / intelligence.totalContractValue) * 100).toFixed(1);
        report += `- **${agency}:** ${formatCurrency(value)} (${percentage}%)\n`;
      });
      report += '\n';
    }

    if (intelligence.contracts.length > 0) {
      report += `### 📋 Recent Major Contracts

`;
      intelligence.contracts.slice(0, 5).forEach(contract => {
        report += `- **${contract.awardingAgency}**
  - Amount: ${formatCurrency(contract.awardAmount)}
  - Type: ${contract.contractType}
  - Period: ${contract.startDate} to ${contract.endDate}
  - NAICS: ${contract.naicsCode}
  - Description: ${contract.description.substring(0, 200)}${contract.description.length > 200 ? '...' : ''}

`;
      });
    }

    if (intelligence.grants.length > 0) {
      report += `### 🎓 Federal Grants

`;
      intelligence.grants.slice(0, 3).forEach(grant => {
        report += `- **${grant.awardingAgency}**
  - Amount: ${formatCurrency(grant.awardAmount)}
  - Period: ${grant.startDate} to ${grant.endDate}
  - Description: ${grant.description.substring(0, 200)}${grant.description.length > 200 ? '...' : ''}

`;
      });
    }

    report += `### 💡 Strategic Insights

`;

    if (intelligence.governmentDependency === 'High') {
      report += `- ⚠️ **High Government Dependency**: Significant federal revenue exposure
- Federal budget cuts or policy changes could materially impact revenue
- Strong relationships with federal agencies provide competitive moat
- May require security clearances for key personnel
`;
    } else if (intelligence.governmentDependency === 'Medium') {
      report += `- Federal contracts provide meaningful revenue diversification
- Government business validates product/service quality
- Opportunity to expand federal footprint
`;
    } else if (intelligence.governmentDependency === 'Low') {
      report += `- Limited federal exposure provides flexibility
- Opportunity to pursue federal growth if desired
- Lower regulatory burden from federal contracting
`;
    }

    if (intelligence.securityClearance) {
      report += `- 🔐 **Security Clearance Requirements**: Indicates work on sensitive/classified projects
- May create barriers to entry for competitors
- Key personnel retention critical for contract continuity
`;
    }

    return report;
  }
}
