// server/apollo-enrichment.ts

interface DecisionMaker {
  name: string;
  title: string;
  company: string;
  linkedinUrl?: string;
}

interface EnrichedContact extends DecisionMaker {
  email?: string;
  phone?: string;
  verified: boolean;
  apolloUrl?: string;
}

export class ApolloEnrichment {
  private apiKey: string;
  private baseUrl = 'https://api.apollo.io/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Enrich contacts from research report
   */
  async enrichContacts(
    decisionMakers: DecisionMaker[]
  ): Promise<EnrichedContact[]> {
    const enrichedContacts: EnrichedContact[] = [];

    for (const contact of decisionMakers) {
      try {
        const enriched = await this.enrichSingleContact(contact);
        enrichedContacts.push(enriched);
      } catch (error) {
        console.error(`Failed to enrich ${contact.name}:`, error);
        // Return original contact without enrichment
        enrichedContacts.push({
          ...contact,
          verified: false,
        });
      }
    }

    return enrichedContacts;
  }

  /**
   * Enrich a single contact using Apollo API
   */
  private async enrichSingleContact(
    contact: DecisionMaker
  ): Promise<EnrichedContact> {
    // Search for person in Apollo
    const searchResult = await this.searchPerson({
      name: contact.name,
      companyName: contact.company,
      title: contact.title,
    });

    if (!searchResult || searchResult.people.length === 0) {
      return {
        ...contact,
        verified: false,
      };
    }

    const person = searchResult.people[0];

    return {
      name: contact.name,
      title: contact.title,
      company: contact.company,
      linkedinUrl: contact.linkedinUrl || person.linkedin_url,
      email: person.email,
      phone: person.phone_numbers?.[0]?.sanitized_number,
      verified: true,
      apolloUrl: person.id ? `https://app.apollo.io/#/people/${person.id}` : undefined,
    };
  }

  /**
   * Search for person in Apollo
   */
  private async searchPerson(params: {
    name: string;
    companyName: string;
    title?: string;
  }): Promise<any> {
    const response = await fetch(`${this.baseUrl}/people/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': this.apiKey,
      },
      body: JSON.stringify({
        q_keywords: params.name,
        organization_names: [params.companyName],
        person_titles: params.title ? [params.title] : undefined,
        per_page: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Apollo API error: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get company enrichment data
   */
  async enrichCompany(params: {
    companyName: string;
    domain?: string;
  }): Promise<any> {
    const response = await fetch(`${this.baseUrl}/organizations/enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': this.apiKey,
      },
      body: JSON.stringify({
        name: params.companyName,
        domain: params.domain,
      }),
    });

    if (!response.ok) {
      throw new Error(`Apollo API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.organization;
  }

  /**
   * Extract decision-makers from Claude research report
   */
  extractDecisionMakersFromReport(reportText: string): DecisionMaker[] {
    const decisionMakers: DecisionMaker[] = [];
    
    // Find the "Key Contacts & Decision-Maker Intelligence" section
    const contactsSection = reportText.match(
      /##\s*8\.\s*Key Contacts.*?\n([\s\S]*?)(?=\n##|$)/i
    );

    if (!contactsSection) {
      return decisionMakers;
    }

    const sectionText = contactsSection[1];

    // Extract individual contacts
    // Pattern: **[Name]** - [Title]
    const contactMatches = sectionText.matchAll(
      /\*\*\[?([^\]]+?)\]?\*\*\s*-\s*([^\n]+)/g
    );

    for (const match of contactMatches) {
      const name = match[1].trim();
      const title = match[2].trim();

      // Try to find LinkedIn URL for this contact
      const linkedinMatch = sectionText.match(
        new RegExp(`${name}[\\s\\S]*?LinkedIn.*?(https?://[^\\s)]+)`, 'i')
      );

      decisionMakers.push({
        name,
        title,
        company: '', // Will be filled from report metadata
        linkedinUrl: linkedinMatch?.[1],
      });
    }

    return decisionMakers;
  }
}

// Usage in agent workflow
export async function enrichResearchWithApollo(
  companyName: string,
  reportText: string
): Promise<string> {
  const apolloApiKey = process.env.APOLLO_API_KEY;
  if (!apolloApiKey) {
    console.log('Apollo API key not configured, skipping enrichment');
    return reportText;
  }

  const apollo = new ApolloEnrichment(apolloApiKey);

  // Extract decision-makers from research
  let decisionMakers = apollo.extractDecisionMakersFromReport(reportText);

  // Add company name
  decisionMakers = decisionMakers.map(dm => ({
    ...dm,
    company: companyName,
  }));

  if (decisionMakers.length === 0) {
    console.log('No decision-makers found in report');
    return reportText;
  }

  console.log(`Enriching ${decisionMakers.length} contacts with Apollo...`);

  // Enrich contacts
  const enrichedContacts = await apollo.enrichContacts(decisionMakers);

  // Count successes
  const verified = enrichedContacts.filter(c => c.verified).length;
  console.log(`Apollo enriched ${verified}/${decisionMakers.length} contacts`);

  // Update research report with enriched contact info
  const updatedSection = buildEnrichedContactsSection(enrichedContacts);

  // Replace the contacts section in the report
  const updatedReport = reportText.replace(
    /##\s*8\.\s*Key Contacts.*?\n[\s\S]*?(?=\n##|$)/i,
    updatedSection
  );

  console.log('Report enriched with Apollo contact data');
  return updatedReport;
}

function buildEnrichedContactsSection(contacts: EnrichedContact[]): string {
  let section = '## 8. Key Contacts & Decision-Maker Intelligence\n\n';

  for (const contact of contacts) {
    section += `**${contact.name}** - ${contact.title}\n`;
    
    if (contact.email) {
      section += `- **Email:** ${contact.email} ✓ (verified by Apollo)\n`;
    }
    
    if (contact.phone) {
      section += `- **Phone:** ${contact.phone}\n`;
    }
    
    if (contact.linkedinUrl) {
      section += `- **LinkedIn:** ${contact.linkedinUrl}\n`;
    }
    
    if (contact.apolloUrl) {
      section += `- **Apollo Profile:** ${contact.apolloUrl}\n`;
    }
    
    section += '\n';
  }

  return section;
}
