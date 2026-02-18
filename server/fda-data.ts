// server/fda-data.ts

/**
 * FDA openFDA API Integration
 * 
 * API: https://open.fda.gov
 * Cost: FREE (no API key required)
 * Rate limit: 240 requests per minute, 120,000 per day
 */

interface FDADevice {
  deviceName: string;
  productCode: string;
  regulationNumber: string;
  deviceClass: string;
  registrationNumber: string;
}

interface FDA510k {
  k_number: string;
  device_name: string;
  applicant: string;
  date_received: string;
  decision_date: string;
  decision_description: string;
}

interface FDARecall {
  recall_number: string;
  product_description: string;
  reason_for_recall: string;
  recall_initiation_date: string;
  classification: string;
  status: string;
}

interface FDAIntelligence {
  registeredDevices: FDADevice[];
  clearances510k: FDA510k[];
  recalls: FDARecall[];
  adverseEvents: number;
  regulatoryRisk: 'Low' | 'Medium' | 'High';
  complianceScore: number;
}

export class FDADataService {
  private baseUrl = 'https://api.fda.gov';

  /**
   * Get all FDA data for a company
   */
  async getCompanyFDAData(companyName: string): Promise<FDAIntelligence> {
    try {
      // Run queries in parallel
      const [devices, clearances, recalls, adverseEvents] = await Promise.all([
        this.getDeviceRegistrations(companyName),
        this.get510kClearances(companyName),
        this.getRecalls(companyName),
        this.getAdverseEventCount(companyName),
      ]);

      // Calculate regulatory risk
      const regulatoryRisk = this.calculateRegulatoryRisk(
        recalls.length,
        adverseEvents,
        clearances.length
      );

      // Calculate compliance score (0-100)
      const complianceScore = this.calculateComplianceScore(
        devices.length,
        clearances.length,
        recalls.length,
        adverseEvents
      );

      return {
        registeredDevices: devices,
        clearances510k: clearances,
        recalls,
        adverseEvents,
        regulatoryRisk,
        complianceScore,
      };
    } catch (error) {
      console.error('Error fetching FDA data:', error);
      return this.emptyResult();
    }
  }

  /**
   * Get device registrations
   */
  private async getDeviceRegistrations(companyName: string): Promise<FDADevice[]> {
    try {
      const searchTerm = encodeURIComponent(companyName);
      const url = `${this.baseUrl}/device/registrationlisting.json?search=firm_name:"${searchTerm}"&limit=100`;

      const response = await fetch(url);
      if (!response.ok) return [];

      const data = await response.json();
      
      if (!data.results) return [];

      return data.results.map((item: any) => ({
        deviceName: item.proprietary_name || item.device_name || 'Unknown',
        productCode: item.product_code || '',
        regulationNumber: item.regulation_number || '',
        deviceClass: item.device_class || '',
        registrationNumber: item.registration_number || '',
      }));
    } catch (error) {
      console.error('Error fetching device registrations:', error);
      return [];
    }
  }

  /**
   * Get 510(k) clearances (FDA approvals)
   */
  private async get510kClearances(companyName: string): Promise<FDA510k[]> {
    try {
      const searchTerm = encodeURIComponent(companyName);
      const url = `${this.baseUrl}/device/510k.json?search=applicant:"${searchTerm}"&limit=100`;

      const response = await fetch(url);
      if (!response.ok) return [];

      const data = await response.json();
      
      if (!data.results) return [];

      return data.results.map((item: any) => ({
        k_number: item.k_number || '',
        device_name: item.device_name || '',
        applicant: item.applicant || '',
        date_received: item.date_received || '',
        decision_date: item.decision_date || '',
        decision_description: item.decision_description || '',
      }));
    } catch (error) {
      console.error('Error fetching 510k clearances:', error);
      return [];
    }
  }

  /**
   * Get product recalls
   */
  private async getRecalls(companyName: string): Promise<FDARecall[]> {
    try {
      const searchTerm = encodeURIComponent(companyName);
      const url = `${this.baseUrl}/device/recall.json?search=firm_name:"${searchTerm}"&limit=100`;

      const response = await fetch(url);
      if (!response.ok) return [];

      const data = await response.json();
      
      if (!data.results) return [];

      return data.results.map((item: any) => ({
        recall_number: item.recall_number || '',
        product_description: item.product_description || '',
        reason_for_recall: item.reason_for_recall || '',
        recall_initiation_date: item.recall_initiation_date || '',
        classification: item.classification || '',
        status: item.status || '',
      }));
    } catch (error) {
      console.error('Error fetching recalls:', error);
      return [];
    }
  }

  /**
   * Get adverse event count
   */
  private async getAdverseEventCount(companyName: string): Promise<number> {
    try {
      const searchTerm = encodeURIComponent(companyName);
      const url = `${this.baseUrl}/device/event.json?search=manufacturer_name:"${searchTerm}"&count=date_received`;

      const response = await fetch(url);
      if (!response.ok) return 0;

      const data = await response.json();
      
      if (!data.results) return 0;

      // Sum up all adverse events
      return data.results.reduce((sum: number, item: any) => sum + (item.count || 0), 0);
    } catch (error) {
      console.error('Error fetching adverse events:', error);
      return 0;
    }
  }

  /**
   * Calculate regulatory risk level
   */
  private calculateRegulatoryRisk(
    recalls: number,
    adverseEvents: number,
    clearances: number
  ): 'Low' | 'Medium' | 'High' {
    // High risk indicators
    if (recalls > 2) return 'High';
    if (adverseEvents > 50) return 'High';
    
    // Medium risk indicators
    if (recalls > 0) return 'Medium';
    if (adverseEvents > 10) return 'Medium';
    
    // Low risk (clean record)
    if (clearances > 0 && recalls === 0 && adverseEvents < 5) return 'Low';
    
    return 'Medium';
  }

  /**
   * Calculate compliance score (0-100)
   */
  private calculateComplianceScore(
    devices: number,
    clearances: number,
    recalls: number,
    adverseEvents: number
  ): number {
    let score = 100;

    // Deduct for recalls
    score -= recalls * 15;

    // Deduct for adverse events
    if (adverseEvents > 50) score -= 30;
    else if (adverseEvents > 10) score -= 15;
    else if (adverseEvents > 0) score -= 5;

    // Add for having clearances
    if (clearances > 5) score += 10;
    else if (clearances > 0) score += 5;

    // Add for having registered devices
    if (devices > 10) score += 10;
    else if (devices > 0) score += 5;

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Empty result when no FDA data found
   */
  private emptyResult(): FDAIntelligence {
    return {
      registeredDevices: [],
      clearances510k: [],
      recalls: [],
      adverseEvents: 0,
      regulatoryRisk: 'Medium',
      complianceScore: 50,
    };
  }

  /**
   * Format FDA data for research report
   */
  formatForReport(intelligence: FDAIntelligence): string {
    if (intelligence.registeredDevices.length === 0 && 
        intelligence.clearances510k.length === 0) {
      return `## FDA Regulatory Intelligence

No FDA device registrations or clearances found. Company may:
- Not manufacture FDA-regulated devices
- Operate under a different legal entity name
- Be too new to appear in FDA databases
- Focus on services rather than physical devices`;
    }

    let report = `## FDA Regulatory Intelligence

**Regulatory Risk: ${intelligence.regulatoryRisk}**
**Compliance Score: ${intelligence.complianceScore}/100**

`;

    // Device registrations
    if (intelligence.registeredDevices.length > 0) {
      report += `### Registered Medical Devices (${intelligence.registeredDevices.length})

`;
      intelligence.registeredDevices.slice(0, 5).forEach((device) => {
        report += `**${device.deviceName}**
- Product Code: ${device.productCode}
- Device Class: ${device.deviceClass}
- Registration: ${device.registrationNumber}

`;
      });
      
      if (intelligence.registeredDevices.length > 5) {
        report += `*...and ${intelligence.registeredDevices.length - 5} more devices*

`;
      }
    }

    // 510(k) clearances
    if (intelligence.clearances510k.length > 0) {
      report += `### FDA 510(k) Clearances (${intelligence.clearances510k.length})

`;
      intelligence.clearances510k.slice(0, 3).forEach((clearance) => {
        report += `**${clearance.device_name}**
- K-Number: ${clearance.k_number}
- Decision: ${clearance.decision_description}
- Date: ${clearance.decision_date}

`;
      });
      
      if (intelligence.clearances510k.length > 3) {
        report += `*...and ${intelligence.clearances510k.length - 3} more clearances*

`;
      }
    }

    // Recalls
    if (intelligence.recalls.length > 0) {
      report += `### ⚠️ Product Recalls (${intelligence.recalls.length})

`;
      intelligence.recalls.forEach((recall) => {
        report += `**${recall.product_description}**
- Recall #: ${recall.recall_number}
- Reason: ${recall.reason_for_recall}
- Date: ${recall.recall_initiation_date}
- Classification: ${recall.classification}
- Status: ${recall.status}

`;
      });
    } else {
      report += `### ✓ Clean Recall History

No FDA recalls found - strong quality control.

`;
    }

    // Adverse events
    if (intelligence.adverseEvents > 0) {
      report += `### Adverse Events

**Total Reports:** ${intelligence.adverseEvents}

`;
      if (intelligence.adverseEvents > 50) {
        report += `⚠️ High volume of adverse event reports. Requires investigation during due diligence.

`;
      } else if (intelligence.adverseEvents > 10) {
        report += `Some adverse events reported. Normal for active medical device manufacturers.

`;
      } else {
        report += `Low number of adverse events. Good safety profile.

`;
      }
    }

    // M&A implications
    report += `### M&A Implications

`;
    
    if (intelligence.regulatoryRisk === 'Low') {
      report += `- ✓ Low regulatory risk - strong compliance history
- ✓ Clean FDA record reduces acquisition risk
- ✓ No ongoing enforcement actions
- ✓ Established regulatory processes`;
    } else if (intelligence.regulatoryRisk === 'Medium') {
      report += `- Moderate regulatory oversight required
- Review adverse event reports during diligence
- Verify quality management systems
- Budget for potential remediation`;
    } else {
      report += `- ⚠️ High regulatory risk - requires deep diligence
- Active recalls may impact valuation
- Potential FDA enforcement pending
- Legal/regulatory costs post-acquisition
- Consider escrow for regulatory liabilities`;
    }

    return report;
  }
}

// Usage in agent workflow
export async function addFDAIntelligence(
  companyName: string,
  baseReport: string
): Promise<string> {
  const fdaService = new FDADataService();
  const intelligence = await fdaService.getCompanyFDAData(companyName);
  const fdaSection = fdaService.formatForReport(intelligence);
  
  // Append to research report
  return `${baseReport}\n\n${fdaSection}`;
}
