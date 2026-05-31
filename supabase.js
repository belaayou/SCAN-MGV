// ================================================================
//  SUPABASE.JS — Stellantis MGV
//  Liaison complète + Synchronisation offline-first
//  ▶ Placez ce fichier dans le même dossier que index.html
// ================================================================

// ┌──────────────────────────────────────────────────────────────┐
// │  1. CONFIGURATION — Remplacez par vos vraies valeurs         │
// └──────────────────────────────────────────────────────────────┘

const SUPABASE_URL = 'postgresql://postgres.rdhmsbqhjlmtlgrjuyxa:[VEKCBojZyIkIRyyU]@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkaG1zYnFoamxtdGxncmp1eXhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMzUxMzgsImV4cCI6MjA5NTgxMTEzOH0.0jpyr9n1TfctS28515NESvYndy03osk2nEYugksAwIo';
//                    ↑ Project Settings → API → anon public

// ┌──────────────────────────────────────────────────────────────┐
// │  2. INITIALISATION DU CLIENT                                 │
// └──────────────────────────────────────────────────────────────┘

let supabaseClient = null;

function _initSupabaseClient() {

    if (typeof supabase === 'undefined') {
        console.error('▲ [Supabase] Librairie non chargée — vérifiez le CDN');
        return false;
    }

    if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_KEY === 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkaG1zYnFoamxtdGxncmp1eXhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMzUxMzgsImV4cCI6MjA5NTgxMTEzOH0.0jpyr9n1TfctS28515NESvYndy03osk2nEYugksAwIo') {
        console.warn('▲ [Supabase] Clé non configurée — sync désactivée');
        return false;
    }

    try {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('▲ [Supabase] Client initialisé ✓');
        return true;
    } catch (e) {
        console.error('▲ [Supabase] Erreur init:', e.message);
        return false;
    }
}

// ┌──────────────────────────────────────────────────────────────┐
// │  3. FILE D'ATTENTE LOCALE (localStorage)                     │
// │     Stocke les scans quand offline → envoie quand online     │
// └──────────────────────────────────────────────────────────────┘

const SB_QUEUE_KEY = 'pendingSupabaseSync';

function _getQueue() {
    try {
        return JSON.parse(localStorage.getItem(SB_QUEUE_KEY) || '[]');
    } catch {
        return [];
    }
}

function _saveQueue(data) {
    localStorage.setItem(SB_QUEUE_KEY, JSON.stringify(data));
}

function _getQueueSize() {
    return _getQueue().length;
}

// ┌──────────────────────────────────────────────────────────────┐
// │  4. AJOUT À LA FILE D'ATTENTE                                │
// │     Appelé par addLogEntry() et updateEntry()                │
// └──────────────────────────────────────────────────────────────┘

async function queueForSupabase(logEntry) {

    // Normalise l'entrée pour Supabase
    const record = {
        scan_id : logEntry.scan_id || ('scan-' + Date.now()),
        op      : (logEntry.op   || '').toString().trim(),
        code    : (logEntry.code || '').toString().trim(),
        zone    : (logEntry.zone || '').toString().trim(),
        date    : (logEntry.date || '').toString().trim(),
        time    : (logEntry.time || '').toString().trim()
    };

    // Met à jour si déjà dans la file, sinon ajoute
    let queue = _getQueue();
    const idx = queue.findIndex(item => item.scan_id === record.scan_id);
    if (idx !== -1) queue[idx] = record;
    else queue.push(record);
    _saveQueue(queue);

    console.log('▲ [Supabase] Enfilé:', record.scan_id, '| File:', queue.length);

    // Tente une sync immédiate si en ligne
    if (navigator.onLine) {
        await syncPendingScansToSupabase();
    }
}

// ┌──────────────────────────────────────────────────────────────┐
// │  5. SYNCHRONISATION PRINCIPALE                               │
// │     Envoie tous les scans en attente vers Supabase           │
// └──────────────────────────────────────────────────────────────┘

async function syncPendingScansToSupabase() {

    // Pré-conditions
    if (!navigator.onLine) {
        console.log('▲ [Supabase] Hors-ligne — sync reportée');
        return { synced: 0, remaining: _getQueueSize() };
    }

    if (!supabaseClient && !_initSupabaseClient()) {
        console.warn('▲ [Supabase] Client non disponible — sync annulée');
        return { synced: 0, remaining: _getQueueSize() };
    }

    const queue = _getQueue();
    if (queue.length === 0) {
        console.log('▲ [Supabase] File vide — rien à envoyer');
        return { synced: 0, remaining: 0 };
    }

    console.log(`▲ [Supabase] Début sync — ${queue.length} scan(s) en attente`);

    const syncedIds = [];

    for (const scan of queue) {

        try {
            const { error } = await supabaseClient
                .from('scans')
                .upsert(
                    {
                        scan_id : scan.scan_id,
                        op      : scan.op   || '',
                        code    : scan.code || '',
                        zone    : scan.zone || '',
                        date    : scan.date || '',
                        time    : scan.time || ''
                    },
                    { onConflict: 'scan_id' }
                );

            if (error) {
                console.error('▲ [Supabase] Erreur upsert:', error.message, '| Code:', error.code);
                // Continue avec le scan suivant
                continue;
            }

            syncedIds.push(scan.scan_id);
            console.log('▲ [Supabase] ✓ Synchronisé:', scan.code);

        } catch (networkErr) {
            // Erreur réseau → arrêt propre, on réessaiera plus tard
            console.error('▲ [Supabase] Erreur réseau:', networkErr.message);
            break;
        }
    }

    // Sauvegarde uniquement les scans non synchronisés
    const remaining = queue.filter(item => !syncedIds.includes(item.scan_id));
    _saveQueue(remaining);

    console.log(`▲ [Supabase] Sync terminée — ✓ ${syncedIds.length} envoyé(s), ⏳ ${remaining.length} restant(s)`);

    return { synced: syncedIds.length, remaining: remaining.length };
}

// ┌──────────────────────────────────────────────────────────────┐
// │  6. SUPPRESSION DANS SUPABASE                                │
// │     Appelé quand l'utilisateur clique × dans le tableau      │
// └──────────────────────────────────────────────────────────────┘

async function deleteFromSupabase(scanId) {

    if (!scanId) return false;

    // Retire aussi de la file d'attente locale
    const queue = _getQueue().filter(item => item.scan_id !== scanId);
    _saveQueue(queue);

    if (!navigator.onLine || (!supabaseClient && !_initSupabaseClient())) {
        console.warn('▲ [Supabase] Suppression locale uniquement (hors-ligne)');
        return false;
    }

    try {
        const { error } = await supabaseClient
            .from('scans')
            .delete()
            .eq('scan_id', scanId);

        if (error) {
            console.error('▲ [Supabase] Erreur suppression:', error.message);
            return false;
        }

        console.log('▲ [Supabase] ✓ Supprimé:', scanId);
        return true;

    } catch (e) {
        console.error('▲ [Supabase] Erreur réseau suppression:', e.message);
        return false;
    }
}

// ┌──────────────────────────────────────────────────────────────┐
// │  7. MISE À JOUR D'UN CHAMP (ZONE ou CODE)                    │
// │     Appelé par updateEntry() quand l'utilisateur édite       │
// └──────────────────────────────────────────────────────────────┘

async function updateFieldInSupabase(scanId, field, value) {

    if (!scanId || !field) return false;

    if (!navigator.onLine || (!supabaseClient && !_initSupabaseClient())) {
        console.warn('▲ [Supabase] Mise à jour locale uniquement (hors-ligne)');
        return false;
    }

    try {
        const { error } = await supabaseClient
            .from('scans')
            .update({ [field]: value })
            .eq('scan_id', scanId);

        if (error) {
            console.error('▲ [Supabase] Erreur update:', error.message);
            return false;
        }

        console.log(`▲ [Supabase] ✓ Champ "${field}" mis à jour pour ${scanId}`);
        return true;

    } catch (e) {
        console.error('▲ [Supabase] Erreur réseau update:', e.message);
        return false;
    }
}

// ┌──────────────────────────────────────────────────────────────┐
// │  8. API PUBLIQUE — Noms utilisés dans index.html             │
// └──────────────────────────────────────────────────────────────┘

// Appelé par addLogEntry() → enfile le scan
async function sendToSupabase(entry) {
    return queueForSupabase(entry);
}

// Appelé par initApp() et syncAllLogs() → vide la file
async function syncPendingScans() {
    return syncPendingScansToSupabase();
}

// ┌──────────────────────────────────────────────────────────────┐
// │  9. INDICATEUR VISUEL — Badge file d'attente dans le header  │
// └──────────────────────────────────────────────────────────────┘

function _updateQueueBadge() {
    const n = _getQueueSize();
    // Cherche un badge existant ou le crée
    let badge = document.getElementById('sb-queue-badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.id = 'sb-queue-badge';
        badge.style.cssText = `
            display:none; align-items:center; gap:5px;
            font-size:11px; font-family:monospace;
            padding:3px 10px; border-radius:20px;
            background:rgba(255,179,0,0.12);
            border:1px solid rgba(255,179,0,0.3);
            color:#ffb300; margin-left:8px;
        `;
        const header = document.querySelector('header .header-center');
        if (header) header.appendChild(badge);
    }
    if (n > 0) {
        badge.style.display = 'inline-flex';
        badge.textContent = `⏳ ${n} en attente`;
    } else {
        badge.style.display = 'none';
    }
}

// ┌──────────────────────────────────────────────────────────────┐
// │  10. ÉVÉNEMENTS RÉSEAU — Sync automatique retour en ligne    │
// └──────────────────────────────────────────────────────────────┘

window.addEventListener('online', async () => {
    console.log('▲ [Supabase] Réseau rétabli — sync automatique');
    const result = await syncPendingScansToSupabase();
    _updateQueueBadge();
    if (result && result.synced > 0) {
        // Optionnel : rafraîchir le tableau visuel
        if (typeof renderTable === 'function') renderTable();
    }
});

window.addEventListener('offline', () => {
    console.warn('▲ [Supabase] Réseau perdu — mode hors-ligne activé');
});

// ┌──────────────────────────────────────────────────────────────┐
// │  11. INITIALISATION AU CHARGEMENT                            │
// └──────────────────────────────────────────────────────────────┘

(function initOnLoad() {
    // Attend que le DOM soit prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _boot);
    } else {
        _boot();
    }
})();

async function _boot() {
    const ok = _initSupabaseClient();
    _updateQueueBadge();

    if (ok && navigator.onLine) {
        const pending = _getQueueSize();
        if (pending > 0) {
            console.log(`▲ [Supabase] ${pending} scan(s) en attente au démarrage — sync lancée`);
            await syncPendingScansToSupabase();
            _updateQueueBadge();
        }
    }
}
