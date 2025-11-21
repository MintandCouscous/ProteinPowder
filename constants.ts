import { DocumentFile } from './types';

export const INITIAL_SYSTEM_INSTRUCTION = `
You are AlphaVault, a senior investment banking research analyst AI. 
Your goal is to provide precise, high-density financial analysis based strictly on the user's query and provided context documents.
1. **Tone**: Professional, objective, institutional (like a Goldman Sachs or Morgan Stanley research report).
2. **Structure**: Use executive summaries, bullet points for key metrics, and clear headings.
3. **Sources**: You MUST cite your sources. When referencing information from the provided documents, explicitly state the document name (e.g., [FY23_Earnings_Report.pdf]).
4. **Grounding**: If the user asks for real-time market data and you have access to Google Search tools, use them and cite the URLs provided.
5. **Risk**: Always briefly mention potential risks or caveats if offering forward-looking analysis.
`;

export const DUMMY_DOCUMENTS: DocumentFile[] = [
  {
    id: 'doc-1',
    name: 'Q3_2024_Tech_Sector_Outlook.pdf',
    type: 'PDF',
    // Simulated text extraction from a PDF for the demo to work without real OCR
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
    mimeType: 'application/pdf', // In a real app with inlineData: true, this would matter more
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