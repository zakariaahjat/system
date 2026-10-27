# Instructions for Using the Logitech Reconciliation System Every Month

## Monthly Workflow Checklist

### 1. Prepare Your Files
Collect the following files for the current month:

- [ ] **Monthly Sales/Stock Files** - Files for each month you want to include (e.g., `Mois_08.xlsx`, `Mois_09.xlsx`, `Mois_10.xlsx`, `Mois_11.xlsx`). 
  - Can be named with month numbers in filename
  - May have different column layouts each month
- [ ] **Produit File** (Product Master) - Usually stays consistent month to month, but verify it's up to date
  - Must contain EAN/Barcode and Internal Product Code
  - This is your reference file for EAN ↔ Code mapping
- [ ] **Arrivage Disty** (Supplier File) - Updated with latest prices
  - Contains product code, purchase price (HT), selling price (TTC)
- [ ] **Ma Config** - Current stock levels
  - Contains product stock information

### 2. Launch the System
1. Open `index.html` in your web browser (Chrome, Firefox, Edge recommended)
2. The system works entirely in your browser - no data is sent to any server

### 3. Upload Files
1. Go to "1. Chargement des fichiers"
2. Upload each file type in its designated card:
   - **Ventes/Stocks Mensuels**: You can select multiple files at once
   - **Fichier Produit**: Single file
   - **Arrivage Disty**: Single file
   - **Ma Config**: Single file
3. Files will be marked with ✓ when loaded

### 4. Detect and Map Headers
1. Click "Détecter et normaliser les en-têtes"
2. Review the auto-detected headers for each file
3. The system will show:
   - Detected headers
   - Auto-mapped columns (EAN, Code, Nom, Qté, Prix Achat, Prix Vente, Stock)
   - Confidence level for mappings

### 5. Verify Column Mapping (If Needed)
1. If any mapping shows "?" or is uncertain, go to "3. Mapping des colonnes"
2. Manually select the correct column for each field
3. **Pay special attention to:**
   - EAN/Code-barres (must be identified if present)
   - Code produit interne / Référence
   - Prix Achat HT
   - Prix Vente TTC
   - Quantités
4. Click "Confirmer le mapping"

### 6. Run Reconciliation
1. Click "Lancer la réconciliation"
2. The system will:
   - Build product master from Fichier Produit (EAN ↔ Code bridge)
   - Process monthly files and extract quantities by EAN
   - Link Arrivage Disty via code → EAN lookup through Produit file
   - Merge Ma Config stock data
   - Calculate totals and Moyenne mensuelle
   - Detect duplicates, conflicts, and unmatched records

### 7. Review Results
Check each tab carefully:

- **Tableau consolidé**: Full consolidated view of all products
  - Verify EANs are present where expected
  - Check monthly quantities look correct
  - Verify Moyenne mensuelle calculation
  - Review confidence levels
- **Correspondances**: Products successfully matched across sources
- **Non appariés**: Products that couldn't be matched - **REQUIRES ATTENTION**
  - These may need manual EAN assignment
  - Check if they exist in Produit file with different codes
- **Doublons**: Duplicate records detected
- **Conflits**: Data conflicts (e.g., different prices for same product)
- **Journal d'audit**: Complete trace of all operations and data sources

### 8. Export Results
1. From the consolidated tab, click "Exporter Excel" or "Exporter CSV"
2. Files are saved with timestamp: `Reconciliation_Logitech_YYYYMMDD_HHMMSS.xlsx/csv`
3. Save to your working directory for the month

## Important Notes

### Matching Rules (Always Followed)
1. **EAN First**: EAN is always the primary matching key
2. **Code Fallback**: If no EAN in a record, match by internal product code
3. **Propagation**: If matched by code, verified EAN is retrieved from Produit file and propagated
4. **Cross-mapping**: Monthly files with codes connect through Produit (EAN ↔ Code)
5. **No Invention**: System never invents EANs - unmatched codes without EAN mapping go to "Non appariés"
6. **String Normalization**: EANs preserved as strings to keep leading zeros

### Moyenne Mensuelle Calculation
- **Formula**: Average of available monthly quantities only
- **Missing months EXCLUDED**: If a month file is not provided, it's not counted in the average
- **Zero sales included**: If a month file IS provided but shows 0 sales, it IS counted as 0 in the average
- **Example**: If you have Aug(10), Sep(20), Oct missing → Average = (10+20)/2 = 15 (not divided by 3)
- **Example**: If you have Aug(10), Sep(0), Oct(30) → Average = (10+0+30)/3 = 13.33

### Best Practices
- **Keep Produit file updated** - It's the critical bridge file
- **Always review unmatched** - Don't blindly export without checking
- **Preserve source files** - Keep originals for audit purposes
- **Check conflicts** - Resolve before finalizing
- **Be consistent with month naming** - Use `Mois_08`, `Mois_09` etc. in filenames for auto-detection
- **Validate EANs** - Should be 8-14 digits

### Troubleshooting
| Issue | Solution |
|-------|----------|
| "No product file found" | Ensure Fichier Produit is uploaded with EAN/Code and stock columns |
| Products in "Non appariés" | Check if code exists in Produit file. May need to add to Produit master |
| Wrong month detected | Rename file to include month number (08, 09, 10) |
| EANs losing leading zeros | System preserves as strings - this is correct |
| Prices not linking | Ensure Arrivage uses codes that exist in Produit file for EAN lookup |

## File Naming Recommendations
- Produit: `Produit.xlsx` or `Fichier_Produit.xlsx`
- Arrivage: `Arrivage_Disty.xlsx` or similar
- Ma Config: `Ma_Config.xlsx`
- Monthly: `Mois_08_Aout.xlsx`, `Ventes_Septembre.xlsx`, etc. (month number anywhere in name works)

## Support
Check the audit log for detailed information about each matching decision and data source.
