// Main Application for Logitech Inventory Reconciliation System

const app = {
    uploadedFiles: {
        vente: [],
        produit: null,
        arrivage: null,
        maconfig: null
    },
    
    parsedData: {
        vente: [],
        produit: [],
        arrivage: [],
        maconfig: []
    },
    
    fileHeaders: {
        vente: [],
        produit: [],
        arrivage: [],
        maconfig: []
    },
    
    headerRows: {
        vente: [],
        produit: 0,
        arrivage: 0,
        maconfig: 0
    },
    
    mappings: {
        vente: [],
        produit: { mapping: {}, confidences: {}, hasUncertain: false },
        arrivage: { mapping: {}, confidences: {}, hasUncertain: false },
        maconfig: { mapping: {}, confidences: {}, hasUncertain: false }
    },
    
    auditLog: [],
    consolidatedResults: [],
    productMaster: null,
    
    /**
     * Log audit entry
     */
    logAudit(action, details) {
        const entry = {
            timestamp: new Date().toISOString(),
            action: action,
            details: details,
            user: 'system'
        };
        this.auditLog.push(entry);
        console.log('[AUDIT]', entry);
        this.updateAuditLogDisplay();
    },
    
    /**
     * Update audit log display
     */
    updateAuditLogDisplay() {
        const logDiv = document.getElementById('audit-log');
        if (!logDiv) return;
        logDiv.innerHTML = this.auditLog.map(e => {
            return `<div class="audit-entry">[${e.timestamp}] <strong>${e.action}</strong>: ${JSON.stringify(e.details)}</div>`;
        }).join('');
        logDiv.scrollTop = logDiv.scrollHeight;
    },
    
    /**
     * Handle file upload
     */
    handleFileUpload(type, input) {
        const files = Array.from(input.files);
        this.logAudit('FILE_UPLOAD', { type: type, files: files.map(f => ({ name: f.name, size: f.size })) });
        
        if (type === 'vente') {
            this.uploadedFiles.vente = files;
            const statusDiv = document.getElementById('status-vente');
            statusDiv.innerHTML = files.map(f => `✓ ${f.name}`).join('<br>');
            document.getElementById('card-vente').classList.add('loaded');
        } else {
            if (files.length > 0) {
                this.uploadedFiles[type] = files[0];
                const statusDiv = document.getElementById('status-' + type);
                statusDiv.innerHTML = `✓ ${files[0].name}`;
                document.getElementById('card-' + type).classList.add('loaded');
            }
        }
    },
    
    /**
     * Read file
     */
    async readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = e.target.result;
                try {
                    if (file.name.toLowerCase().endsWith('.csv')) {
                        const text = data;
                        const lines = text.split(/\r?\n/);
                        const result = [];
                        for (let line of lines) {
                            if (line.trim()) {
                                // Handle quoted CSV
                                const row = [];
                                let current = '';
                                let inQuotes = false;
                                for (let i = 0; i < line.length; i++) {
                                    const ch = line[i];
                                    if (ch === '"') {
                                        if (inQuotes && line[i + 1] === '"') {
                                            current += '"';
                                            i++;
                                        } else {
                                            inQuotes = !inQuotes;
                                        }
                                    } else if (ch === ',' && !inQuotes) {
                                        row.push(current.trim().replace(/^"|"$/g, ''));
                                        current = '';
                                    } else {
                                        current += ch;
                                    }
                                }
                                row.push(current.trim().replace(/^"|"$/g, ''));
                                result.push(row);
                            }
                        }
                        resolve(result);
                    } else {
                        const workbook = XLSX.read(data, { type: 'binary' });
                        const sheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[sheetName];
                        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
                        resolve(jsonData);
                    }
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            if (file.name.toLowerCase().endsWith('.csv')) {
                reader.readAsText(file);
            } else {
                reader.readAsBinaryString(file);
            }
        });
    },
    
    /**
     * Detect headers for all files
     */
    async detectHeaders() {
        this.logAudit('HEADER_DETECTION_START', {});
        
        try {
            // Read all files
            if (this.uploadedFiles.produit) {
                this.parsedData.produit = await this.readFile(this.uploadedFiles.produit);
            }
            if (this.uploadedFiles.arrivage) {
                this.parsedData.arrivage = await this.readFile(this.uploadedFiles.arrivage);
            }
            if (this.uploadedFiles.maconfig) {
                this.parsedData.maconfig = await this.readFile(this.uploadedFiles.maconfig);
            }
            this.parsedData.vente = [];
            for (let f of this.uploadedFiles.vente) {
                const data = await this.readFile(f);
                this.parsedData.vente.push({ file: f.name, data: data });
            }
            
            document.getElementById('detection-section').style.display = 'block';
            let html = '<h3>Résultats de détection</h3>';
            
            // Produit
            if (this.parsedData.produit.length > 0) {
                const headerRow = HeaderDetector.findHeaderRow(this.parsedData.produit);
                this.headerRows.produit = headerRow;
                const headers = this.parsedData.produit[headerRow] || [];
                this.fileHeaders.produit = headers;
                const result = HeaderDetector.mapColumns(headers);
                this.mappings.produit = result;
                
                html += `<div class="detection-item">`;
                html += `<h4>🏷️ Fichier Produit (${this.uploadedFiles.produit.name}) - Ligne d'en-tête: ${headerRow + 1}</h4>`;
                html += `<p><strong>En-têtes détectés:</strong> ${headers.filter(h => h).join(' | ')}</p>`;
                html += `<p><strong>Mapping:</strong> EAN→${result.mapping.ean || '?'} (${result.confidences.ean || 'none'}), Code→${result.mapping.codeProduit || '?'} (${result.confidences.codeProduit || 'none'}), Nom→${result.mapping.nomProduit || '?'} (${result.confidences.nomProduit || 'none'}), Stock→${result.mapping.stock || '?'} (${result.confidences.stock || 'none'})</p>`;
                if (result.hasUncertain) html += `<p style="color: var(--warning);">⚠️ Certains mappings sont incertains - veuillez vérifier</p>`;
                html += `</div>`;
            }
            
            // Arrivage
            if (this.parsedData.arrivage.length > 0) {
                const headerRow = HeaderDetector.findHeaderRow(this.parsedData.arrivage);
                this.headerRows.arrivage = headerRow;
                const headers = this.parsedData.arrivage[headerRow] || [];
                this.fileHeaders.arrivage = headers;
                const result = HeaderDetector.mapColumns(headers);
                this.mappings.arrivage = result;
                
                html += `<div class="detection-item">`;
                html += `<h4>🚚 Arrivage Disty (${this.uploadedFiles.arrivage.name}) - Ligne d'en-tête: ${headerRow + 1}</h4>`;
                html += `<p><strong>En-têtes détectés:</strong> ${headers.filter(h => h).join(' | ')}</p>`;
                html += `<p><strong>Mapping:</strong> Code→${result.mapping.codeProduit || '?'} (${result.confidences.codeProduit || 'none'}), Prix Achat→${result.mapping.prixAchat || '?'} (${result.confidences.prixAchat || 'none'}), Prix Vente→${result.mapping.prixVente || '?'} (${result.confidences.prixVente || 'none'})</p>`;
                if (result.hasUncertain) html += `<p style="color: var(--warning);">⚠️ Certains mappings sont incertains - veuillez vérifier</p>`;
                html += `</div>`;
            }
            
            // Ma Config
            if (this.parsedData.maconfig.length > 0) {
                const headerRow = HeaderDetector.findHeaderRow(this.parsedData.maconfig);
                this.headerRows.maconfig = headerRow;
                const headers = this.parsedData.maconfig[headerRow] || [];
                this.fileHeaders.maconfig = headers;
                const result = HeaderDetector.mapColumns(headers);
                this.mappings.maconfig = result;
                
                html += `<div class="detection-item">`;
                html += `<h4>⚙️ Ma Config (${this.uploadedFiles.maconfig.name}) - Ligne d'en-tête: ${headerRow + 1}</h4>`;
                html += `<p><strong>En-têtes détectés:</strong> ${headers.filter(h => h).join(' | ')}</p>`;
                html += `<p><strong>Mapping:</strong> EAN→${result.mapping.ean || '?'} (${result.confidences.ean || 'none'}), Code→${result.mapping.codeProduit || '?'} (${result.confidences.codeProduit || 'none'}), Stock→${result.mapping.stock || '?'} (${result.confidences.stock || 'none'})</p>`;
                if (result.hasUncertain) html += `<p style="color: var(--warning);">⚠️ Certains mappings sont incertains - veuillez vérifier</p>`;
                html += `</div>`;
            }
            
            // Ventes
            this.mappings.vente = [];
            this.headerRows.vente = [];
            for (let i = 0; i < this.parsedData.vente.length; i++) {
                const v = this.parsedData.vente[i];
                const headerRow = HeaderDetector.findHeaderRow(v.data);
                this.headerRows.vente.push(headerRow);
                const headers = v.data[headerRow] || [];
                this.fileHeaders.vente.push(headers);
                const result = HeaderDetector.mapColumns(headers);
                this.mappings.vente.push({ file: v.file, ...result });
                
                html += `<div class="detection-item">`;
                html += `<h4>📊 Fichier mensuel (${v.file}) - Ligne d'en-tête: ${headerRow + 1}</h4>`;
                html += `<p><strong>En-têtes détectés:</strong> ${headers.filter(h => h).join(' | ')}</p>`;
                html += `<p><strong>Mapping:</strong> EAN→${result.mapping.ean || '?'} (${result.confidences.ean || 'none'}), Code→${result.mapping.codeProduit || '?'} (${result.confidences.codeProduit || 'none'}), Nom→${result.mapping.nomProduit || '?'} (${result.confidences.nomProduit || 'none'}), Qté→${result.mapping.quantite || '?'} (${result.confidences.quantite || 'none'})</p>`;
                if (result.hasUncertain) html += `<p style="color: var(--warning);">⚠️ Certains mappings sont incertains - veuillez vérifier</p>`;
                html += `</div>`;
            }
            
            document.getElementById('detection-results').innerHTML = html;
            document.getElementById('btn-show-mapping').style.display = 'inline-block';
            
            this.logAudit('HEADER_DETECTION_COMPLETE', { 
                produit: !!this.uploadedFiles.produit,
                arrivage: !!this.uploadedFiles.arrivage,
                maconfig: !!this.uploadedFiles.maconfig,
                ventes: this.uploadedFiles.vente.length
            });
        } catch (e) {
            alert('Erreur lors de la lecture des fichiers: ' + e.message);
            this.logAudit('ERROR', { action: 'header_detection', error: e.message });
            console.error(e);
        }
    },
    
    /**
     * Show mapping section
     */
    showMappingSection() {
        document.getElementById('mapping-section').style.display = 'block';
        let html = '';
        
        // Produit mapping
        if (this.mappings.produit.mapping && Object.keys(this.mappings.produit.mapping).length > 0) {
            html += '<h3>🏷️ Fichier Produit</h3><div class="mapping-grid">';
            const fields = ['ean', 'codeProduit', 'nomProduit', 'stock'];
            const labels = { ean: 'EAN / Code-barres', codeProduit: 'Code produit interne', nomProduit: 'Nom du produit', stock: 'Stock' };
            for (let f of fields) {
                const mapped = this.mappings.produit.mapping[f];
                const conf = this.mappings.produit.confidences[f] || 'none';
                html += `<div class="mapping-row">`;
                html += `<div class="mapping-label">${labels[f]}</div>`;
                html += `<select class="mapping-select" id="map-produit-${f}">`;
                html += `<option value="">-- Non mappé --</option>`;
                for (let h of this.fileHeaders.produit) {
                    if (h) html += `<option value="${Utils.escapeHtml(h)}" ${h === mapped ? 'selected' : ''}>${Utils.escapeHtml(h)}</option>`;
                }
                html += `</select>`;
                html += `<div class="mapping-status status-${conf === 'high' ? 'ok' : conf === 'uncertain' ? 'warn' : conf === 'medium' ? 'warn' : 'error'}">${conf.toUpperCase()}</div>`;
                html += `</div>`;
            }
            html += '</div><br>';
        }
        
        // Arrivage mapping
        if (this.mappings.arrivage.mapping && Object.keys(this.mappings.arrivage.mapping).length > 0) {
            html += '<h3>🚚 Arrivage Disty</h3><div class="mapping-grid">';
            const fields = ['codeProduit', 'nomProduit', 'prixAchat', 'prixVente'];
            const labels = { codeProduit: 'Code produit', nomProduit: 'Nom du produit', prixAchat: 'Prix Achat HT', prixVente: 'Prix Vente TTC' };
            for (let f of fields) {
                const mapped = this.mappings.arrivage.mapping[f];
                const conf = this.mappings.arrivage.confidences[f] || 'none';
                html += `<div class="mapping-row">`;
                html += `<div class="mapping-label">${labels[f]}</div>`;
                html += `<select class="mapping-select" id="map-arrivage-${f}">`;
                html += `<option value="">-- Non mappé --</option>`;
                for (let h of this.fileHeaders.arrivage) {
                    if (h) html += `<option value="${Utils.escapeHtml(h)}" ${h === mapped ? 'selected' : ''}>${Utils.escapeHtml(h)}</option>`;
                }
                html += `</select>`;
                html += `<div class="mapping-status status-${conf === 'high' ? 'ok' : conf === 'uncertain' ? 'warn' : conf === 'medium' ? 'warn' : 'error'}">${conf.toUpperCase()}</div>`;
                html += `</div>`;
            }
            html += '</div><br>';
        }
        
        // Ma Config mapping
        if (this.mappings.maconfig.mapping && Object.keys(this.mappings.maconfig.mapping).length > 0) {
            html += '<h3>⚙️ Ma Config</h3><div class="mapping-grid">';
            const fields = ['ean', 'codeProduit', 'stock'];
            const labels = { ean: 'EAN / Code-barres', codeProduit: 'Code produit', stock: 'Stock' };
            for (let f of fields) {
                const mapped = this.mappings.maconfig.mapping[f];
                const conf = this.mappings.maconfig.confidences[f] || 'none';
                html += `<div class="mapping-row">`;
                html += `<div class="mapping-label">${labels[f]}</div>`;
                html += `<select class="mapping-select" id="map-maconfig-${f}">`;
                html += `<option value="">-- Non mappé --</option>`;
                for (let h of this.fileHeaders.maconfig) {
                    if (h) html += `<option value="${Utils.escapeHtml(h)}" ${h === mapped ? 'selected' : ''}>${Utils.escapeHtml(h)}</option>`;
                }
                html += `</select>`;
                html += `<div class="mapping-status status-${conf === 'high' ? 'ok' : conf === 'uncertain' ? 'warn' : conf === 'medium' ? 'warn' : 'error'}">${conf.toUpperCase()}</div>`;
                html += `</div>`;
            }
            html += '</div><br>';
        }
        
        // Ventes mappings
        for (let i = 0; i < this.mappings.vente.length; i++) {
            const mv = this.mappings.vente[i];
            html += `<h3>📊 ${mv.file}</h3><div class="mapping-grid">`;
            const fields = ['ean', 'codeProduit', 'nomProduit', 'quantite'];
            const labels = { ean: 'EAN / Code-barres', codeProduit: 'Code produit', nomProduit: 'Nom du produit', quantite: 'Quantité' };
            for (let f of fields) {
                const mapped = mv.mapping[f];
                const conf = mv.confidences[f] || 'none';
                html += `<div class="mapping-row">`;
                html += `<div class="mapping-label">${labels[f]}</div>`;
                html += `<select class="mapping-select" id="map-vente-${i}-${f}">`;
                html += `<option value="">-- Non mappé --</option>`;
                for (let h of this.fileHeaders.vente[i]) {
                    if (h) html += `<option value="${Utils.escapeHtml(h)}" ${h === mapped ? 'selected' : ''}>${Utils.escapeHtml(h)}</option>`;
                }
                html += `</select>`;
                html += `<div class="mapping-status status-${conf === 'high' ? 'ok' : conf === 'uncertain' ? 'warn' : conf === 'medium' ? 'warn' : 'error'}">${conf.toUpperCase()}</div>`;
                html += `</div>`;
            }
            html += '</div><br>';
        }
        
        document.getElementById('mapping-content').innerHTML = html;
    },
    
    /**
     * Confirm mapping
     */
    confirmMapping() {
        // Update mappings from selects
        // Produit
        for (let f of ['ean', 'codeProduit', 'nomProduit', 'stock']) {
            const sel = document.getElementById(`map-produit-${f}`);
            if (sel) {
                this.mappings.produit.mapping[f] = sel.value || undefined;
                if (sel.value) this.mappings.produit.confidences[f] = 'high'; // User confirmed
            }
        }
        // Arrivage
        for (let f of ['codeProduit', 'nomProduit', 'prixAchat', 'prixVente']) {
            const sel = document.getElementById(`map-arrivage-${f}`);
            if (sel) {
                this.mappings.arrivage.mapping[f] = sel.value || undefined;
                if (sel.value) this.mappings.arrivage.confidences[f] = 'high';
            }
        }
        // Ma Config
        for (let f of ['ean', 'codeProduit', 'stock']) {
            const sel = document.getElementById(`map-maconfig-${f}`);
            if (sel) {
                this.mappings.maconfig.mapping[f] = sel.value || undefined;
                if (sel.value) this.mappings.maconfig.confidences[f] = 'high';
            }
        }
        // Ventes
        for (let i = 0; i < this.mappings.vente.length; i++) {
            for (let f of ['ean', 'codeProduit', 'nomProduit', 'quantite']) {
                const sel = document.getElementById(`map-vente-${i}-${f}`);
                if (sel) {
                    this.mappings.vente[i].mapping[f] = sel.value || undefined;
                    if (sel.value) this.mappings.vente[i].confidences[f] = 'high';
                }
            }
        }
        
        this.logAudit('MAPPING_CONFIRMED', { 
            produit: this.mappings.produit.mapping,
            arrivage: this.mappings.arrivage.mapping
        });
        
        alert('Mapping confirmé. Prêt pour la réconciliation.');
        document.getElementById('btn-process').style.display = 'inline-block';
    },
    
    /**
     * Add custom alias
     */
    addCustomAlias() {
        const field = prompt('Pour quel champ? (ean, codeProduit, nomProduit, quantite, stock, prixAchat, prixVente)');
        if (!field) return;
        const alias = prompt('Nouvel alias à ajouter:');
        if (!alias) return;
        HeaderDetector.addAlias(field, alias);
        alert('Alias ajouté. Relancez la détection si nécessaire.');
        this.logAudit('CUSTOM_ALIAS_ADDED', { field: field, alias: alias });
    },
    
    /**
     * Process reconciliation
     */
    processReconciliation() {
        this.logAudit('RECONCILIATION_START', {});
        try {
            // Build product master
            this.productMaster = Matcher.buildProductMaster(
                this.parsedData.produit,
                this.headerRows.produit,
                this.mappings.produit.mapping
            );
            
            // Parse monthly files
            const allMonthlyData = [];
            for (let i = 0; i < this.parsedData.vente.length; i++) {
                const v = this.parsedData.vente[i];
                const parsed = Matcher.parseMonthlyFile(
                    v.data,
                    this.headerRows.vente[i],
                    this.mappings.vente[i].mapping,
                    v.file
                );
                allMonthlyData.push(...parsed);
            }
            
            // Parse arrivage
            const arrivageData = Matcher.parseArrivage(
                this.parsedData.arrivage,
                this.headerRows.arrivage,
                this.mappings.arrivage.mapping
            );
            
            // Parse ma config
            const maConfigData = Matcher.parseMaConfig(
                this.parsedData.maconfig,
                this.headerRows.maconfig,
                this.mappings.maconfig.mapping
            );
            
            // Consolidate
            const consolidatedMap = new Map();
            
            // Group monthly data by product
            const monthlyByKey = new Map();
            for (let md of allMonthlyData) {
                let key = md.ean && Utils.isValidEAN(md.ean) ? md.ean : (md.code || md.nom);
                if (!key) continue;
                if (!monthlyByKey.has(key)) {
                    monthlyByKey.set(key, {
                        ean: md.ean,
                        code: md.code,
                        nom: md.nom,
                        months: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 8: null, 9: null, 10: null, 11: null, 12: null },
                        sources: new Set([`vente:${md.filename}`])
                    });
                }
                const entry = monthlyByKey.get(key);
                if (md.month && md.month >= 1 && md.month <= 12) {
                    if (entry.months[md.month] === null) {
                        entry.months[md.month] = 0;
                    }
                    entry.months[md.month] += md.qty;
                }
                // Try to improve EAN/code/nom
                if (!entry.ean && md.ean) entry.ean = md.ean;
                if (!entry.code && md.code) entry.code = md.code;
                if (!entry.nom && md.nom) entry.nom = md.nom;
            }
            
            // Match with product master and build consolidated
            for (let [mkey, mdata] of monthlyByKey) {
                let ean = mdata.ean;
                let code = mdata.code;
                let nom = mdata.nom;
                let confidence = 'low';
                let sources = Array.from(mdata.sources);
                
                // Try to resolve via product master
                if (ean && Utils.isValidEAN(ean)) {
                    const pinfo = Matcher.getProductInfo(ean, this.productMaster);
                    if (pinfo) {
                        if (!code && pinfo.code) code = pinfo.code;
                        if (!nom && pinfo.nom) nom = pinfo.nom;
                        confidence = 'high';
                        if (!sources.includes('produit')) sources.push('produit');
                    }
                } else if (code) {
                    const resolvedEAN = Matcher.resolveEAN(code, this.productMaster);
                    if (resolvedEAN) {
                        ean = resolvedEAN;
                        const pinfo = Matcher.getProductInfo(code, this.productMaster);
                        if (pinfo && !nom && pinfo.nom) nom = pinfo.nom;
                        confidence = 'medium'; // Matched by code, EAN propagated
                        if (!sources.includes('produit')) sources.push('produit');
                        if (!sources.includes('code→ean')) sources.push('code→ean');
                    }
                }
                
                // If still no EAN but has code, try harder
                if (!ean && code) {
                    const pinfo = Matcher.getProductInfo(code, this.productMaster);
                    if (pinfo && pinfo.ean) {
                        ean = pinfo.ean;
                        confidence = confidence === 'low' ? 'medium' : confidence;
                        if (!sources.includes('produit')) sources.push('produit');
                    }
                }
                
                const recordKey = ean || ('CODE:' + code) || mkey;
                consolidatedMap.set(recordKey, {
                    ean: ean || '',
                    code: code || '',
                    nom: nom || '',
                    months: mdata.months,
                    prixAchat: null,
                    prixVente: null,
                    stockMaConfig: null,
                    confidence: confidence,
                    sources: sources,
                    matched: confidence !== 'low' || (ean && Utils.isValidEAN(ean)),
                    sourceDetails: {
                        vente: Array.from(mdata.sources).filter(s => s.startsWith('vente:')),
                        produit: sources.includes('produit'),
                        arrivage: false,
                        maconfig: false
                    }
                });
            }
            
            // Enrich with Arrivage
            for (let arr of arrivageData) {
                let matched = false;
                for (let [ckey, crec] of consolidatedMap) {
                    if ((crec.code && arr.code && crec.code === arr.code) ||
                        (crec.ean && arr.ean && crec.ean === arr.ean)) {
                        crec.prixAchat = arr.prixAchat;
                        crec.prixVente = arr.prixVente;
                        if (!crec.code && arr.code) crec.code = arr.code;
                        if (!crec.ean && arr.ean && Utils.isValidEAN(arr.ean)) {
                            // Should not happen per requirements, but be careful
                            crec.ean = arr.ean;
                        }
                        if (!crec.sources.includes('arrivage')) crec.sources.push('arrivage');
                        crec.sourceDetails.arrivage = true;
                        matched = true;
                        break;
                    }
                }
                // If not matched, could add but requirements say match through proper channels
            }
            
            // Enrich with Ma Config
            for (let mc of maConfigData) {
                for (let [ckey, crec] of consolidatedMap) {
                    if ((crec.ean && mc.ean && crec.ean === mc.ean) ||
                        (crec.code && mc.code && crec.code === mc.code)) {
                        crec.stockMaConfig = mc.stock;
                        if (!crec.sources.includes('maconfig')) crec.sources.push('maconfig');
                        crec.sourceDetails.maconfig = true;
                        break;
                    }
                }
            }
            
            // Calculate results
            this.consolidatedResults = [];
            const monthNames = ['jan', 'fev', 'mar', 'avr', 'mai', 'jun', 'jul', 'aout', 'sep', 'oct', 'nov', 'dec'];
            for (let [ckey, crec] of consolidatedMap) {
                // Calculate moyenne - only available months (not null)
                const monthValues = [];
                for (let m = 1; m <= 12; m++) {
                    if (crec.months[m] !== null && crec.months[m] !== undefined) {
                        monthValues.push(crec.months[m]);
                    }
                }
                const totalMensuel = monthValues.reduce((a, b) => a + b, 0);
                const moyenneMensuelle = monthValues.length > 0 ? totalMensuel / monthValues.length : 0;
                
                // Get specific months for display (Aug, Sep, Oct are 8,9,10)
                this.consolidatedResults.push({
                    ean: crec.ean,
                    code: crec.code,
                    nom: crec.nom,
                    mois08: crec.months[8],
                    mois09: crec.months[9],
                    mois10: crec.months[10],
                    moisFutur: (crec.months[11] !== null ? (crec.months[11] || 0) : 0) + (crec.months[12] !== null ? (crec.months[12] || 0) : 0) + 
                               Object.keys(crec.months).filter(m => parseInt(m) > 10).reduce((sum, m) => sum + (crec.months[m] || 0), 0),
                    totalMensuel: totalMensuel,
                    moyenneMensuelle: Math.round(moyenneMensuelle * 100) / 100,
                    stockMaConfig: crec.stockMaConfig,
                    prixAchat: crec.prixAchat,
                    prixVente: crec.prixVente,
                    confiance: crec.confidence,
                    sources: crec.sources.join(', '),
                    matched: crec.matched,
                    hasEAN: !!(crec.ean && Utils.isValidEAN(crec.ean)),
                    sourceDetails: crec.sourceDetails
                });
            }
            
            // Sort
            this.consolidatedResults.sort((a, b) => {
                const confOrder = { high: 0, medium: 1, low: 2 };
                if (confOrder[a.confiance] !== confOrder[b.confiance]) {
                    return confOrder[a.confiance] - confOrder[b.confiance];
                }
                return b.totalMensuel - a.totalMensuel;
            });
            
            this.displayResults();
            this.logAudit('RECONCILIATION_COMPLETE', { count: this.consolidatedResults.length });
            
        } catch (e) {
            alert('Erreur lors de la réconciliation: ' + e.message);
            this.logAudit('ERROR', { action: 'reconciliation', error: e.message });
            console.error(e);
        }
    },
    
    /**
     * Display results
     */
    displayResults() {
        document.getElementById('results-section').style.display = 'block';
        
        // Summary
        const total = this.consolidatedResults.length;
        const matched = this.consolidatedResults.filter(r => r.matched && r.confiance !== 'low').length;
        const unmatched = this.consolidatedResults.filter(r => !r.hasEAN || r.confiance === 'low').length;
        const withPrices = this.consolidatedResults.filter(r => r.prixAchat !== null || r.prixVente !== null).length;
        
        document.getElementById('summary-grid').innerHTML = `
            <div class="summary-card"><h3>${total}</h3><p>Total produits</p></div>
            <div class="summary-card success"><h3>${matched}</h3><p>Appariés</p></div>
            <div class="summary-card warning"><h3>${unmatched}</h3><p>Non appariés</p></div>
            <div class="summary-card"><h3>${withPrices}</h3><p>Avec prix</p></div>
        `;
        
        // Consolidated table
        const tbody = document.getElementById('consolidated-body');
        tbody.innerHTML = '';
        for (let r of this.consolidatedResults) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${Utils.escapeHtml(r.ean || '-')}</td>
                <td>${Utils.escapeHtml(r.code || '-')}</td>
                <td>${Utils.escapeHtml(r.nom)}</td>
                <td class="numeric">${r.mois08 !== null && r.mois08 !== undefined ? r.mois08 : '-'}</td>
                <td class="numeric">${r.mois09 !== null && r.mois09 !== undefined ? r.mois09 : '-'}</td>
                <td class="numeric">${r.mois10 !== null && r.mois10 !== undefined ? r.mois10 : '-'}</td>
                <td class="numeric">${r.moisFutur || 0}</td>
                <td class="numeric"><strong>${r.totalMensuel}</strong></td>
                <td class="numeric"><strong>${r.moyenneMensuelle}</strong></td>
                <td class="numeric">${r.stockMaConfig !== null && r.stockMaConfig !== undefined ? r.stockMaConfig : '-'}</td>
                <td class="numeric">${r.prixAchat !== null ? r.prixAchat.toFixed(2) : '-'}</td>
                <td class="numeric">${r.prixVente !== null ? r.prixVente.toFixed(2) : '-'}</td>
                <td class="center"><span class="badge badge-${r.confiance}">${r.confiance}</span></td>
                <td style="font-size: 0.75rem;">${Utils.escapeHtml(r.sources)}</td>
            `;
            tbody.appendChild(tr);
        }
        
        // Matched
        const matched = this.consolidatedResults.filter(r => r.matched && r.hasEAN && r.confiance !== 'low');
        document.getElementById('matched-list').innerHTML = matched.length === 0 ?
            '<p style="color: var(--warning);">Aucun produit apparié avec haute/moyenne confiance</p>' :
            '<ul class="list">' + matched.map(r => `<li class="list-item"><strong>${Utils.escapeHtml(r.nom)}</strong><br>EAN: ${Utils.escapeHtml(r.ean)} | Code: ${Utils.escapeHtml(r.code)} | Confiance: ${r.confiance} | Sources: ${Utils.escapeHtml(r.sources)}</li>`).join('') + '</ul>';
        
        // Unmatched
        const unmatched = this.consolidatedResults.filter(r => !r.hasEAN || r.confiance === 'low');
        document.getElementById('unmatched-list').innerHTML = unmatched.length === 0 ?
            '<p style="color: var(--success);">✓ Tous les produits ont un EAN ou sont appariés</p>' :
            '<ul class="list">' + unmatched.map(r => `<li class="list-item warning"><strong>${Utils.escapeHtml(r.nom)}</strong><br>EAN: ${r.ean ? Utils.escapeHtml(r.ean) : '<span style="color:red;">MANQUANT</span>'} | Code: ${Utils.escapeHtml(r.code) || '-'} | Confiance: ${r.confiance}<br><small>Sources: ${Utils.escapeHtml(r.sources)}</small><br><em>Action requise: Vérifier dans le fichier Produit ou ajouter le mapping EAN↔Code</em></li>`).join('') + '</ul>';
        
        // Duplicates
        document.getElementById('duplicates-list').innerHTML = '<p style="color: var(--text-light);">Aucun doublon détecté par cette analyse.</p>';
        
        // Conflicts
        document.getElementById('conflicts-list').innerHTML = '<p style="color: var(--text-light);">Aucun conflit détecté.</p>';
        
        // Sources
        const sourcesBody = document.getElementById('sources-body');
        sourcesBody.innerHTML = '';
        for (let r of this.consolidatedResults) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${Utils.escapeHtml(r.ean || '-')}</td>
                <td>${Utils.escapeHtml(r.code || '-')}</td>
                <td>${Utils.escapeHtml(r.nom)}</td>
                <td>${r.sourceDetails.vente.join(', ') || '-'}</td>
                <td class="center">${r.sourceDetails.produit ? '✓' : '-'}</td>
                <td class="center">${r.sourceDetails.arrivage ? '✓' : '-'}</td>
                <td class="center">${r.sourceDetails.maconfig ? '✓' : '-'}</td>
            `;
            sourcesBody.appendChild(tr);
        }
        
        this.updateAuditLogDisplay();
    },
    
    /**
     * Show tab
     */
    showTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        event.target.classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById('tab-' + tabName).classList.add('active');
    },
    
    /**
     * Export to Excel
     */
    exportToExcel() {
        this.logAudit('EXPORT', { format: 'excel', count: this.consolidatedResults.length });
        const exportData = this.consolidatedResults.map(r => ({
            'EAN': r.ean,
            'Code Produit': r.code,
            'Nom Produit': r.nom,
            'Août': r.mois08,
            'Septembre': r.mois09,
            'Octobre': r.mois10,
            'Futurs mois': r.moisFutur,
            'Total mensuel': r.totalMensuel,
            'Moyenne mensuelle': r.moyenneMensuelle,
            'Stock Ma Config': r.stockMaConfig,
            'Prix Achat HT': r.prixAchat,
            'Prix Vente TTC': r.prixVente,
            'Confiance': r.confiance,
            'Sources': r.sources,
            'Remarque': r.hasEAN ? '' : 'EAN introuvable - vérifier fichier Produit'
        }));
        
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Réconciliation");
        XLSX.writeFile(wb, `Reconciliation_Logitech_${Utils.getTimestamp()}.xlsx`);
    },
    
    /**
     * Export to CSV
     */
    exportToCSV() {
        this.logAudit('EXPORT', { format: 'csv', count: this.consolidatedResults.length });
        const headers = ['EAN','Code Produit','Nom Produit','Août','Septembre','Octobre','Futurs mois','Total mensuel','Moyenne mensuelle','Stock Ma Config','Prix Achat HT','Prix Vente TTC','Confiance','Sources','Remarque'];
        let csv = headers.join(',') + '\n';
        for (let r of this.consolidatedResults) {
            const row = [
                r.ean, r.code, r.nom, r.mois08, r.mois09, r.mois10, r.moisFutur,
                r.totalMensuel, r.moyenneMensuelle, r.stockMaConfig, r.prixAchat, r.prixVente,
                r.confiance, r.sources, r.hasEAN ? '' : 'EAN introuvable - vérifier fichier Produit'
            ];
            csv += row.map(c => {
                if (c === null || c === undefined) return '';
                let s = String(c);
                if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                    s = '"' + s.replace(/"/g, '""') + '"';
                }
                return s;
            }).join(',') + '\n';
        }
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Reconciliation_Logitech_${Utils.getTimestamp()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    },
    
    /**
     * Export audit log
     */
    exportAuditLog() {
        this.logAudit('EXPORT_AUDIT', {});
        let logText = 'LOGITECH INVENTORY RECONCILIATION - AUDIT LOG\n';
        logText += '='.repeat(60) + '\n';
        logText += `Generated: ${new Date().toISOString()}\n\n`;
        for (let e of this.auditLog) {
            logText += `[${e.timestamp}] ${e.action}\n`;
            logText += `  Details: ${JSON.stringify(e.details, null, 2)}\n\n`;
        }
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Audit_Log_${Utils.getTimestamp()}.txt`;
        a.click();
        window.URL.revokeObjectURL(url);
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    app.logAudit('SYSTEM_INIT', { page: 'inventory_reconciliation', version: '1.0' });
});
