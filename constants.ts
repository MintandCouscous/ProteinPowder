
import { DocumentFile } from './types';

export const INITIAL_SYSTEM_INSTRUCTION = `
ROLE: Senior Investment Banking Analyst (TMT / M&A Focus).
OBJECTIVE: Analyze proprietary financial documents to provide accurate, sourced, and high-context answers.

### CRITICAL INTELLIGENCE INSTRUCTIONS:

1. **Context Retention (Memory)**: 
   - The user will ask follow-up questions like "What about them?" or "Who are the investors?". 
   - You MUST strictly infer the subject from the *immediately preceding* conversation history.
   - Example: User: "Tell me about Project Titan." -> AI: "Titan is..." -> User: "What are the risks?" -> AI: (Must answer risks of Titan, not general risks).

2. **Fuzzy Matching & Entity Resolution**: 
   - Users make typos. If a user asks for "pai ventures", and your documents contain "Pi Ventures", YOU MUST ASSUME they mean "Pi Ventures".
   - Do not ask for clarification unless the ambiguity is unresolvable. State your assumption: "Assuming you are referring to 'Pi Ventures' found in the Cap Table..."

3. **Data Extraction**:
   - If the user asks for a metric (EBITDA, Revenue, multiples), look for it in Tables, Spreadsheets, and Text.
   - If an Excel file is provided, treat the raw text data as structured tables.

4. **Negative Constraints**:
   - If the information is truly not in the documents, say: "Based on the provided deal room data, I cannot find specific details on [Topic]. The available documents cover [Brief list of coverage]."
   - Do NOT hallucinate numbers.

### TONE & FORMAT:
- **Executive Summary Style**: High density, low fluff.
- **Source Citations**: Always cite the filename, e.g., "Revenue grew 20% YoY [[Source: FY23_Financials.xlsx]]."
- **Structuring**: Use Markdown tables for financial comparisons.
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

4. RISKS & MITIGANTS
- Regulatory: EU antitrust scrutiny is high for cloud mergers. (Mitigant: Titan has <5% market share in EU).
- Customer Concentration: Top 3 clients = 40% of revenue. (Mitigant: Long-term contracts in place until 2026).
- Tech Debt: Legacy platform requires $20M one-time upgrade.

5. RECOMMENDATION
Proceed to Due Diligence phase. Submit non-binding IOI at $1.2B - $1.4B range.`,
    isInlineData: false,
    mimeType: 'text/plain',
    category: 'memo',
    uploadDate: '2024-10-10',
  },
  {
    id: 'doc-3',
    name: 'Global_Energy_Transition_Report.txt',
    type: 'TXT',
    content: `SECTOR UPDATE: RENEWABLES & ENERGY STORAGE
Date: Sep 22, 2024

The shift to green hydrogen and battery storage is accelerating. 
Capital expenditure in APAC region expected to double by 2026 to support grid modernization.

KEY PLAYERS TO WATCH:
1. GreenGen (Ticker: GGEN): Leading electrolyzer tech. Just signed 5GW deal with India.
2. SolarOne (Ticker: SONE): Dominant in residential solar, but facing margin compression from Chinese panel imports.
3. HydroX: Speculative play in blue hydrogen.

REGULATORY TAILWINDS:
- US: Inflation Reduction Act 2.0 credits extended to 2035.
- EU: Green Deal Industrial Plan simplifies permitting for wind farms.

MARKET RISKS:
- Supply Chain: Lithium and Cobalt prices remain volatile.
- Interest Rates: High cost of capital is delaying roughly 15% of planned utility-scale projects.`,
    isInlineData: false,
    mimeType: 'text/plain',
    category: 'financial',
    uploadDate: '2024-09-22',
  }
];
