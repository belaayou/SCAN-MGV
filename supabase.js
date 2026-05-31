/**
 * Architecture d'intégration Supabase pour SCAN MGV
 * Gère la synchronisation parallèle, le mode hors ligne et le traitement par lot.
 */

// ⚠️ À REMPLACER PAR VOS IDENTIFIANTS SUPABASE CONFIDENTIELS
const SUPABASE_URL = "https://rlkhtuflfyafdpshyrcs.supabase.co";
const SUPABASE_KEY = "sb_publishable_qcQJZ0SL35UEKGxKriPkCg_dvmupP8U";

let supabaseClient = null;

// Initialisation sécurisée du client Supabase
if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("▲ Supabase connecté avec succès au module d'arrière-plan.");
} else {
    console.error("▲ Erreur : La librairie Supabase CDN n'est pas chargée.");
}

/**
 * Enregistre ou met à jour un scan dans la file d'attente locale Supabase et tente l'envoi
 */
async function queueForSupabase(logEntry) {
    let pendingSyncs = JSON.parse(localStorage.getItem('pendingSupabaseSync')) || [];
    
    // Vérification anti-doublon locale dans la file d'attente
    const exists = pendingSyncs.some(item => item.scan_id === logEntry.scan_id);
    if (!exists) {
        pendingSyncs.push(logEntry);
        localStorage.setItem('pendingSupabaseSync', JSON.stringify(pendingSyncs));
    } else {
        // Mise à jour de la zone ou du code si modifié localement
        pendingSyncs = pendingSyncs.map(item => item.scan_id === logEntry.scan_id ? logEntry : item);
        localStorage.setItem('pendingSupabaseSync', JSON.stringify(pendingSyncs));
    }

    if (navigator.onLine) {
        await syncPendingScansToSupabase();
    }
}

/**
 * Traite la file d'attente des scans non synchronisés vers Supabase (Batch Sync)
 */
async function syncPendingScansToSupabase() {
    if (!navigator.onLine || !supabaseClient) return;

    let pendingSyncs = JSON.parse(localStorage.getItem('pendingSupabaseSync')) || [];
    if (pendingSyncs.length === 0) return;

    console.log(`▲ Début de la synchronisation Supabase (${pendingSyncs.length} éléments en attente)`);

    const successfullySyncedIds = [];

    for (const scan of pendingSyncs) {
        try {
            // Utilisation d'un upsert basé sur la contrainte d'unicité de 'scan_id' pour éliminer les doublons
            const { error } = await supabaseClient
                .from('scans')
                .upsert({
                    scan_id: scan.scan_id,
                    op: scan.op,
                    code: scan.code,
                    zone: scan.zone,
                    date: scan.date,
                    time: scan.time
                }, { onConflict: 'scan_id' });

            if (!error) {
                console.log(`▲ Scan envoyé avec succès à Supabase : ${scan.code}`);
                successfullySyncedIds.push(scan.scan_id);
            } else {
                console.error("▲ Erreur d'insertion Supabase :", error.message);
            }
        } catch (e) {
            console.error("▲ Erreur réseau lors de la tentative de synchronisation Supabase :", e);
            break; // Arrêt de la boucle si le serveur ne répond plus
        }
    }

    // Filtrer et vider les éléments validés du localStorage
    if (successfullySyncedIds.length > 0) {
        const remainingSyncs = pendingSyncs.filter(item => !successfullySyncedIds.includes(item.scan_id));
        localStorage.setItem('pendingSupabaseSync', JSON.stringify(remainingSyncs));
        console.log(`▲ Sync Supabase terminé. Reste en attente : ${remainingSyncs.length}`);
    }
}

// ==========================================================================
// 🔗 PONTS DE COMPATIBILITÉ AVEC LE CODE DE L'INDEX.HTML
// ==========================================================================

/**
 * Alias pour correspondre à l'appel initApp() de l'index.html
 */
function syncPendingScans() {
    return syncPendingScansToSupabase();
}

/**
 * Alias pour correspondre à l'appel updateEntry() lors de la saisie d'une ZONE
 */
function sendToSupabase(logEntry) {
    return queueForSupabase(logEntry);
}

// Écouteur global de retour en ligne pour vider la file d'attente automatiquement
window.addEventListener('online', () => {
    console.log("▲ Terminal en ligne : Amorçage de la synchronisation forcée vers Supabase...");
    syncPendingScansToSupabase();
});
