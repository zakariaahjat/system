# Sample Data for Testing

This folder contains sample Excel files to test the Logitech Inventory Reconciliation System.

## Files to create for testing:
1. **Produit.xlsx** - Product master with EAN and internal code
2. **Mois_08.xlsx** - August sales
3. **Mois_09.xlsx** - September sales  
4. **Mois_10.xlsx** - October sales
5. **Arrivage_Disty.xlsx** - Supplier prices
6. **Ma_Config.xlsx** - Current stock

Use the test script or create them manually to verify the system works correctly.

The system should:
- Auto-detect headers even with different column names
- Match by EAN primarily
- Fall back to code and look up EAN from Produit file
- Calculate Moyenne as average of available months only
- Show unmatched products without inventing EANs
- Track all sources in audit log
