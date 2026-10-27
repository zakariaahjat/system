// Header Detection and Normalization Engine
// Configurable aliases, header normalization, fuzzy matching

const HeaderDetector = {
    // Column type aliases - easily configurable
    ALIASES: {
        ean: [
            'ean', 'ean13', 'barcode', 'code barre', 'codebarre', 'gtin', 'upc',
            'reference interne', 'ref interne', 'additional barcodes', 'ean code',
            'code barre ean'
        ],
        codeProduit: [
            'code', 'code produit', 'product code', 'part number', 'partnumber',
            'part no', 'pn', 'sku', 'référence', 'reference', 'ref',
            'reference fournisseur', 'ref fournisseur', 'code article',
            'code interne', 'référence interne', 'reference interne', 'ref interne',
            'article code', 'item code'
        ],
        nomProduit: [
            'nom', 'name', 'product name', 'produit', 'designation', 'libelle',
            'title', 'titre', 'description', 'nom produit', 'product description',
            'libellé', 'article', 'désignation'
        ],
        quantite: [
            'qt', 'qte', 'qty', 'quantite', 'quantity', 'vendu', 'sold',
            'mouvement', 'vente', 'ventes', 'sortie', 'quantité vendue',
            'sales', 'units sold'
        ],
        stock: [
            'quantite disponible', 'stock', 'stock dispo', 'en stock',
            'qty available', 'on hand', 'stock disponible', 'disponible',
            'current stock', 'stock actuel', 'available stock', 'solde',
            'quantité disponible'
        ],
        prixAchat: [
            'prix grossiste ht', 'prix achat', 'prix d achat', 'pa', 'cost',
            'prix fournisseur', 'purchase price', 'prix ht', 'prix unitaire ht',
            'pu ht', 'cout', 'coût', 'prix d\'achat ht', 'buy price'
        ],
        prixVente: [
            'pvp ttc', 'prix vente', 'prix de vente', 'pv', 'pvp',
            'prix public', 'price', 'prix ttc', 'selling price', 'prix vente ttc',
            'prix de détail', 'retail price', 'vente ttc'
        ]
    },

    // Confidence levels for mapping
    CONFIDENCE: {
        HIGH: 'high',
        MEDIUM: 'medium',
        LOW: 'low',
        UNCERTAIN: 'uncertain'
    },

    /**
     * Find header row by scanning first N rows
     */
    findHeaderRow(data, maxScan = 15) {
        if (!data || data.length === 0) return 0;
        const maxRows = Math.min(maxScan, data.length);
        let bestRow = 0;
        let bestScore = -1;
        
        // Build set of all known normalized aliases
        const allAliases = new Set();
        for (const field in this.ALIASES) {
            for (const alias of this.ALIASES[field]) {
                allAliases.add(Utils.normalizeHeader(alias));
            }
        }
        
        for (let i = 0; i < maxRows; i++) {
            const row = data[i];
            if (!row || !Array.isArray(row)) continue;
            let score = 0;
            for (let j = 0; j < row.length; j++) {
                const cell = row[j];
                if (cell === null || cell === undefined) continue;
                const norm = Utils.normalizeHeader(cell);
                if (allAliases.has(norm)) {
                    score += 2; // Exact match to known alias
                } else if (norm.length > 0) {
                    // Partial match
                    for (const alias of allAliases) {
                        if (norm.includes(alias) || alias.includes(norm)) {
                            score += 1;
                            break;
                        }
                    }
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestRow = i;
                if (bestScore > 10) break; // Very confident
            }
        }
        return bestRow;
    },

    /**
     * Map columns with confidence scoring
     */
    mapColumns(headers) {
        const mapping = {};
        const confidences = {};
        const normalizedHeaders = headers.map((h, idx) => ({
            original: h,
            normalized: Utils.normalizeHeader(h),
            index: idx
        }));
        
        const used = new Set();
        
        for (const field in this.ALIASES) {
            let bestMatch = null;
            let bestScore = 0;
            let bestConfidence = this.CONFIDENCE.LOW;
            
            for (const alias of this.ALIASES[field]) {
                const normAlias = Utils.normalizeHeader(alias);
                
                for (const h of normalizedHeaders) {
                    if (used.has(h.index)) continue;
                    
                    let score = 0;
                    let confidence = this.CONFIDENCE.LOW;
                    
                    if (h.normalized === normAlias) {
                        score = 100;
                        confidence = this.CONFIDENCE.HIGH;
                    } else if (h.normalized.startsWith(normAlias) || normAlias.startsWith(h.normalized)) {
                        score = 80;
                        confidence = this.CONFIDENCE.HIGH;
                    } else if (h.normalized.includes(normAlias)) {
                        score = 60;
                        confidence = this.CONFIDENCE.MEDIUM;
                    } else if (normAlias.includes(h.normalized) && h.normalized.length > 3) {
                        score = 40;
                        confidence = this.CONFIDENCE.LOW;
                    }
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = h;
                        bestConfidence = confidence;
                    }
                }
            }
            
            if (bestMatch && bestScore >= 40) {
                mapping[field] = bestMatch.original;
                confidences[field] = bestConfidence;
                used.add(bestMatch.index);
            } else if (bestMatch && bestScore >= 20) {
                // Uncertain match - flag for user confirmation
                mapping[field] = bestMatch.original;
                confidences[field] = this.CONFIDENCE.UNCERTAIN;
                used.add(bestMatch.index);
            }
        }
        
        return { mapping, confidences, hasUncertain: Object.values(confidences).includes(this.CONFIDENCE.UNCERTAIN) };
    },

    /**
     * Detect if column contains EANs
     */
    looksLikeEANColumn(data, columnIndex) {
        if (!data || data.length <= 1) return false;
        let eanCount = 0;
        let totalCount = 0;
        for (let i = 1; i < Math.min(data.length, 50); i++) {
            const row = data[i];
            if (!row || columnIndex >= row.length) continue;
            const val = row[columnIndex];
            if (val === null || val === undefined || val === '') continue;
            totalCount++;
            const cleaned = Utils.cleanKey(val);
            if (/^\d{8,14}$/.test(cleaned)) {
                eanCount++;
            }
        }
        return totalCount > 0 && (eanCount / totalCount) > 0.7;
    },

    /**
     * Auto-detect file role
     */
    detectFileRole(data, mapping) {
        const hasEAN = !!mapping.ean || this.looksLikeEANColumn(data, 
            mapping.ean ? data[0].indexOf(mapping.ean) : -1);
        const hasCode = !!mapping.codeProduit;
        const hasStock = !!mapping.stock;
        const hasBuy = !!mapping.prixAchat;
        const hasSell = !!mapping.prixVente;
        const hasQty = !!mapping.quantite;
        
        // Product master: has stock/info and (EAN or code)
        if (hasStock && (hasEAN || hasCode)) {
            return 'produit';
        }
        // Arrivage: has prices and (code or EAN)
        if ((hasBuy || hasSell) && (hasCode || hasEAN)) {
            return 'arrivage';
        }
        // Ma Config: has stock
        if (hasStock && !hasBuy && !hasSell && !hasQty) {
            return 'maconfig';
        }
        // Monthly sales: has quantities
        if (hasQty) {
            return 'vente';
        }
        
        return 'unknown';
    },

    /**
     * Add custom alias
     */
    addAlias(field, alias) {
        if (!this.ALIASES[field]) {
            this.ALIASES[field] = [];
        }
        const norm = Utils.normalizeHeader(alias);
        // Check if already exists
        for (const a of this.ALIASES[field]) {
            if (Utils.normalizeHeader(a) === norm) return;
        }
        this.ALIASES[field].push(alias);
    },

    /**
     * Get all aliases for a field
     */
    getAliases(field) {
        return this.ALIASES[field] || [];
    }
};

window.HeaderDetector = HeaderDetector;
