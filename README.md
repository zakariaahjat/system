# Logitech Inventory Reconciliation System

## Overview
Smart, reusable system for reconciling Logitech inventory across multiple Excel/CSV sources. Built to handle files with different column headers, perform intelligent matching by EAN (primary key) with fallback to internal product codes, and generate consolidated reconciliation reports.

## File Types Handled
1. **Monthly Sales/Stock Lists** (August, September, October, future months) - Sales quantities per product
2. **Produit File** (Product Master) - Contains EAN/barcode and internal product code (bridge between codes and EANs)
3. **Arrivage Disty** (Supplier file) - Contains product code, purchase price (Prix Achat HT), selling price (Prix Vente TTC)
4. **Ma Config** - Contains current product stock information

## Key Features
- **Smart Header Detection**: Automatically recognizes equivalent columns using configurable aliases, header normalization, and fuzzy matching
- **Intelligent Matching**:
  - Primary: Match by EAN (normalized as strings to preserve leading zeros)
  - Fallback: If EAN missing, match by exact internal product code across Produit and Arrivage Disty, retrieve verified EAN from Produit and propagate
  - Cross-mapping: Connect records through Produit mapping (EAN ↔ internal code)
- **Never invents EANs** or silently merges ambiguous matches
- **Consolidated Table** with: EAN, Code Produit, Nom Produit, monthly quantities (Août/Septembre/Octobre + future months), Total mensuel, Moyenne mensuelle, Stock Ma Config, Prix Achat HT, Prix Vente TTC, Confidence, Sources
- **Review Screen** showing matched, unmatched, duplicate, conflicting, and missing records
- **Moyenne mensuelle calculation**: Average of available monthly quantities. Missing months are excluded from the average (not counted as zero) - see documentation below
- **Source tracking**: Every value shows where it came from (audit trail)
- **Reusable** for any future month and any files with different headers
- **Validation**: Quantities and prices validated, no duplicate counting
- **Export**: Excel (.XLSX) and CSV formats
- **Audit log** of all changes

## Moyenne Mensuelle Calculation Rule
**Rule (clearly documented):** Moyenne mensuelle = (Sum of quantities from months that have data) / (Number of months that have data). 
- Months with actual sales/stock data are included
- Missing months (no file/data for that month) are **excluded** from the average calculation (not treated as 0)
- Only months with valid numeric quantities contribute to both numerator and denominator
- This prevents skewing the average when adding new months over time

## Directory Structure
```
compaire excel/
├── README.md                    # This file
├── index.html                   # Main web application
├── css/
│   └── style.css               # Styles
├── js/
│   ├── app.js                  # Main application logic
│   ├── matcher.js              # Matching engine
│   ├── headerDetector.js       # Header detection & normalization
│   └── utils.js                # Utilities
├── sample_data/                # Sample files for testing
├── logs/                       # Audit logs
└── INSTRUCTIONS.md             # Month-by-month usage instructions
```

## Quick Start
1. Open `index.html` in a web browser (works offline - no server required)
2. Upload your 4 types of files
3. Review auto-detected headers and adjust mapping if needed (with confirmation for uncertain matches)
4. Run reconciliation
5. Review results in the dashboard (check unmatched/conflicts)
6. Export to Excel/CSV

## Testing
Sample data files are provided in `sample_data/` to test the system. See INSTRUCTIONS.md for details.
