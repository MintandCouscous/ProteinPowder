
import { DocumentFile } from './types';

export const INITIAL_SYSTEM_INSTRUCTION = `
ROLE: Senior Investment Banking Analyst (TMT / M&A Focus).
OBJECTIVE: Analyze proprietary financial documents to provide accurate, sourced, and high-context answers.

### CORE BEHAVIORS (v1.2.1):

1. **Deep Context Awareness (Critical)**: 
   - Treat this as a continuous conversation, not isolated queries.
   - **Implied Subjects**: If the user asks "What about them?", "Are they profitable?", or "Did we reach out?", you MUST infer the entity from the *immediately preceding* interaction.
   - **Follow-up Logic**: If a user refines a question (e.g., "and for Q3?"), apply that constraint to the previously discussed topic.

2. **Fuzzy Entity Matching**: 
   - Users often use shorthand or have typos (e.g., "pai" = "Pi Ventures", "chiratae" = "Chiratae Ventures", "sequoia" = "Sequoia Capital").
   - **Action**: Automatically infer the correct entity based on phonetics and context found in the documents. 
   - **Do NOT** say "I cannot find 'pai'". Instead, say "Assuming you refer to 'Pi Ventures' found in the outreach tracker..."

3. **Data Synthesis**:
   - **Excel/CSV Handling**: Aggressively scan tabular data. Treat row headers as entities and column headers as metrics.
   - **Cross-Referencing**: If one doc has "Revenue" and another has "Deal Status", combine them into a single answer.

4. **Negative Constraints**:
   - If information is truly missing after fuzzy matching, say: "Based on the provided deal room data, I cannot find specific details on [Topic]."

### TONE & FORMAT:
- **Executive Summary Style**: High density, low fluff.
- **Source Citations**: Always cite the filename, e.g., "Revenue grew 20% YoY [[Source: FY23_Financials.xlsx]]."
- **Tables**: Use Markdown tables for all financial comparisons.
`;

export const DUMMY_DOCUMENTS: DocumentFile[] = [
  {
    id: 'doc-1',
    name: 'Q3_2024_Tech_Sector_Outlook.pdf',
    type: 'PDF',
    content: `
SECTOR REPORT: TECHNOLOGY, MEDIA, & TELECOM (TMT)
Quarter: Q3 2024
Author: AlphaVault Research Division

1. MACROECONOMIC OVERVIEW
The technology sector showed resilience in Q3 despite lingering inflation concerns. 
Aggregate revenue for the S&P 500 Tech Index grew by 8.4% YoY, beating estimates of 6.2%.
Key Drivers:
- AI Infrastructure spending (up 45% YoY)
- Cloud Services stabilization
- Enterprise Software renewal rates holding steady at 92%

2. SUB-SECTOR PERFORMANCE
- Semiconductors: Outperformed broader market (+12%). Demand for GPU clusters remains the primary catalyst.
- Software: Mixed results. Cybersecurity spending remains robust, but seat-based SaaS pricing is under pressure.
- Hardware: Consumer electronics demand remains soft, down 2% YoY.

3. VALUATION METRICS
- Sector Forward P/E: 24x (vs 5-year avg of 22x)
- EV/Sales: 6.5x
- Free Cash Flow Yield: 3.8%

4. OUTLOOK
We maintain an OVERWEIGHT rating on Semiconductors and Data Center infrastructure.
We downgrade Consumer Hardware to NEUTRAL due to lack of near-term catalysts.
    `, 
    isInlineData: false, 
    mimeType: 'application/pdf',
    category: 'market',
    uploadDate: '2024-10-15',
  },
  {
    id: 'doc-2',
    name: 'Project_Titan_Merger_Memo.txt',
    type: 'TXT',
    content: `CONFIDENTIAL MEMORANDUM
TO: Investment Committee
FROM: TMT Coverage Team
DATE: Oct 10, 2024
SUBJECT: Project Titan - Potential Acquisition Target

1. EXECUTIVE SUMMARY
Titan Corp represents a strategic consolidation opportunity in the cloud infrastructure space. 
They specialize in "Edge Compute Optimization" - a critical growth vertical.
Current valuation trading at 12x EBITDA, below peer average of 15x.

2. KEY FINANCIALS (LTM)
- Revenue: $450M (CAGR 18%)
- EBITDA: $99M (22% margin)
- Net Debt/EBITDA: 3.5x (Deleveraging from 4.5x in FY22)
- Capex Intensity: 12% of Revenue

3. SYNERGIES
- Cost Synergies: Est. $30M annually via headcount rationalization and shared HQ costs.
- Revenue Synergies: Cross-selling Titan's Edge product to our Enterprise client base could yield $50M+ by Year 2.

4. RISKS
- Customer Concentration: Top 3 clients account for 40% of revenue.
- Tech Debt: Older stack requires $15M modernization investment.
    `, 
    isInlineData: false, 
    mimeType: 'text/plain',
    category: 'memo',
    uploadDate: '2024-10-10',
  },
  {
    id: 'doc-3',
    name: 'Global_Energy_Transition_Report.txt',
    type: 'TXT',
    content: `GLOBAL ENERGY TRANSITION 2024
Focus: Renewable Infrastructure Financing

1. MARKET TRENDS
Capital deployment in renewable energy projects reached $1.1T in 2023.
Solar PV remains the dominant technology, accounting for 60% of new capacity.

2. REGULATORY HEADWINDS
- Grid interconnection delays in the US are averaging 18-24 months.
- EU supply chain due diligence laws are increasing compliance costs for battery importers.

3. INVESTMENT OPPORTUNITIES
- Battery Energy Storage Systems (BESS): Revenue arbitrage opportunities in volatile markets.
- Green Hydrogen: While promising, LCOE remains uncompetitive without significant subsidies ($3/kg target).

4. RISKS
- Interest Rate Sensitivity: High cost of capital is squeezing IRR for levered projects.
- Commodity Volatility: Lithium and Cobalt pricing instability affects project modeling.
    `, 
    isInlineData: false, 
    mimeType: 'text/plain',
    category: 'financial',
    uploadDate: '2024-09-20',
  }
];
