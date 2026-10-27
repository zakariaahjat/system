// Matching Engine for Logitech Inventory Reconciliation
// EAN primary key, code fallback, no invention of EANs

const Matcher = {
    /**
     * Build product master map (EAN <-> Code bridge)
     */
    buildProductMaster(produitData, headerRow, mapping) {
        const master = {
            byEAN: new Map(),
            byCode: new Map(),
            all: []
        };
        
        if (!produitData || produitData.length <= headerRow + 1) return master;
        
        const headers = produitData[headerRow];
        const eanIdx = mapping.ean ? headers.indexOf(mapping.ean) : -1;
        const codeIdx = mapping.codeProduit ? headers.indexOf(mapping.codeProduit) : -1;
        const nomIdx = mapping.nomProduit ? headers.indexOf(mapping.nomProduit) : -1;
        const stockIdx = mapping.stock ? headers.indexOf(mapping.stock) : -1;
        
        for (let i = headerRow + 1; i < produitData.length; i++) {
            const row = produitData[i];
            if (!row || row.every(c => c === null || c === undefined || c === '')) continue;
            
            let ean = eanIdx >= 0 ? row[eanIdx] : null;
            let code = codeIdx >= 0 ? row[codeIdx] : null;
            let nom = nomIdx >= 0 ? row[nomIdx] : null;
            let stock = stockIdx >= 0 ? row[stockIdx] : null;
            
            if (ean) ean = Utils.cleanKey(ean);
            if (code) code = Utils.cleanKey(code);
            if (nom) nom = String(nom).trim();
            if (stock !== null && stock !== undefined) stock = Utils.parseNumber(stock);
            
            if (!ean && !code) continue;
            
            const record = {
                ean: ean || '',
                code: code || '',
                nom: nom || '',
                stock: stock !== null ? stock : 0,
                source: 'produit'
            };
            
            if (ean && Utils.isValidEAN(ean)) {
                master.byEAN.set(ean, record);
            }
            if (code) {
                master.byCode.set(code, record);
                // Also link EAN if exists
                if (ean && Utils.isValidEAN(ean)) {
                    master.byCode.set(code, { ...record, ean: ean });
                }
            }
            master.all.push(record);
        }
        
        return master;
    },

    /**
     * Resolve EAN from code using product master
     */
    resolveEAN(code, productMaster) {
        if (!code) return '';
        const cleanCode = Utils.cleanKey(code);
        if (productMaster.byCode.has(cleanCode)) {
            const rec = productMaster.byCode.get(cleanCode);
            if (rec.ean && Utils.isValidEAN(rec.ean)) {
                return rec.ean;
            }
        }
        return '';
    },

    /**
     * Resolve code from EAN using product master
     */
    resolveCode(ean, productMaster) {
        if (!ean) return '';
        const cleanEAN = Utils.cleanKey(ean);
        if (productMaster.byEAN.has(cleanEAN)) {
            return productMaster.byEAN.get(cleanEAN).code || '';
        }
        return '';
    },

    /**
     * Get product info from master
     */
    getProductInfo(eanOrCode, productMaster) {
        const key = Utils.cleanKey(eanOrCode);
        if (productMaster.byEAN.has(key)) {
            return productMaster.byEAN.get(key);
        }
        if (productMaster.byCode.has(key)) {
            return productMaster.byCode.get(key);
        }
        return null;
    },

    /**
     * Parse monthly file
     */
    parseMonthlyFile(fileData, headerRow, mapping, filename) {
        const results = [];
        if (!fileData || fileData.length <= headerRow + 1) return results;
        
        const headers = fileData[headerRow];
        const eanIdx = mapping.ean ? headers.indexOf(mapping.ean) : -1;
        const codeIdx = mapping.codeProduit ? headers.indexOf(mapping.codeProduit) : -1;
        const nomIdx = mapping.nomProduit ? headers.indexOf(mapping.nomProduit) : -1;
        const qtyIdx = mapping.quantite ? headers.indexOf(mapping.quantite) : -1;
        
        // Extract month number from filename
        const monthMatch = filename.match(/(?:mois|month)[_\s-]*(\d{1,2})/i) || filename.match(/(?<!\d)(1[0-2]|[1-9])(?!\d)/);
        const monthNum = monthMatch ? parseInt(monthMatch[1]) : null;
        
        // Check if EAN column looks like EANs
        const useEANColumn = eanIdx >= 0 && HeaderDetector.looksLikeEANColumn(fileData, eanIdx);
        
        for (let i = headerRow + 1; i < fileData.length; i++) {
            const row = fileData[i];
            if (!row || qtyIdx < 0) continue;
            if (row.every(c => c === null || c === undefined || c === '')) continue;
            
            let ean = '';
            let code = '';
            let nom = '';
            let qty = Utils.parseNumber(row[qtyIdx]);
            
            if (qty === null || qty === undefined) qty = 0;
            // Don't count negative as zero necessarily, but flag - for now take as-is
            if (qty < 0) qty = 0; // Avoid negative quantities
            
            if (useEANColumn && eanIdx >= 0) {
                ean = Utils.cleanKey(row[eanIdx]);
            }
            
            if (codeIdx >= 0) {
                code = Utils.cleanKey(row[codeIdx]);
            }
            
            if (nomIdx >= 0) {
                nom = String(row[nomIdx] || '').trim();
                // Try to extract EAN from name if not found in column
                if (!ean || !Utils.isValidEAN(ean)) {
                    const extracted = Utils.extractEANFromText(nom);
                    if (extracted) {
                        ean = extracted;
                        nom = Utils.removeEANFromName(nom);
                    }
                }
            }
            
            if (!ean && !code) continue;
            
            results.push({
                ean: Utils.isValidEAN(ean) ? ean : '',
                code: code,
                nom: nom,
                qty: qty,
                month: monthNum,
                filename: filename,
                raw: { row: row }
            });
        }
        
        return results;
    },

    /**
     * Parse Arrivage Disty
     */
    parseArrivage(fileData, headerRow, mapping) {
        const results = [];
        if (!fileData || fileData.length <= headerRow + 1) return results;
        
        const headers = fileData[headerRow];
        const eanIdx = mapping.ean ? headers.indexOf(mapping.ean) : -1;
        const codeIdx = mapping.codeProduit ? headers.indexOf(mapping.codeProduit) : -1;
        const nomIdx = mapping.nomProduit ? headers.indexOf(mapping.nomProduit) : -1;
        const buyIdx = mapping.prixAchat ? headers.indexOf(mapping.prixAchat) : -1;
        const sellIdx = mapping.prixVente ? headers.indexOf(mapping.prixVente) : -1;
        
        for (let i = headerRow + 1; i < fileData.length; i++) {
            const row = fileData[i];
            if (!row) continue;
            if (row.every(c => c === null || c === undefined || c === '')) continue;
            
            let ean = eanIdx >= 0 ? Utils.cleanKey(row[eanIdx]) : '';
            let code = codeIdx >= 0 ? Utils.cleanKey(row[codeIdx]) : '';
            let nom = nomIdx >= 0 ? String(row[nomIdx] || '').trim() : '';
            let buy = buyIdx >= 0 ? Utils.parseNumber(row[buyIdx]) : null;
            let sell = sellIdx >= 0 ? Utils.parseNumber(row[sellIdx]) : null;
            
            if (!ean && !code) continue;
            
            results.push({
                ean: Utils.isValidEAN(ean) ? ean : '',
                code: code,
                nom: nom,
                prixAchat: buy,
                prixVente: sell,
                source: 'arrivage'
            });
        }
        
        return results;
    },

    /**
     * Parse Ma Config
     */
    parseMaConfig(fileData, headerRow, mapping) {
        const results = [];
        if (!fileData || fileData.length <= headerRow + 1) return results;
        
        const headers = fileData[headerRow];
        const eanIdx = mapping.ean ? headers.indexOf(mapping.ean) : -1;
        const codeIdx = mapping.codeProduit ? headers.indexOf(mapping.codeProduit) : -1;
        const stockIdx = mapping.stock ? headers.indexOf(mapping.stock) : -1;
        
        for (let i = headerRow + 1; i < fileData.length; i++) {
            const row = fileData[i];
            if (!row) continue;
            if (row.every(c => c === null || c === undefined || c === '')) continue;
            
            let ean = eanIdx >= 0 ? Utils.cleanKey(row[eanIdx]) : '';
            let code = codeIdx >= 0 ? Utils.cleanKey(row[codeIdx]) : '';
            let stock = stockIdx >= 0 ? Utils.parseNumber(row[stockIdx]) : null;
            
            if (!ean && !code) continue;
            
            results.push({
                ean: Utils.isValidEAN(ean) ? ean : '',
                code: code,
                stock: stock,
                source: 'maconfig'
            });
        }
        
        return results;
    }
};

window.Matcher = Matcher;
