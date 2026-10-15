// assets/js/live-sync.js
// CPRMS Real-Time Sync Poller
// Automatically syncs appointment changes and active queue states across open browser sessions
// without requiring manual browser reloads.

import api from './api.js?v=7';

class LiveSyncEngine {
    constructor() {
        this.intervalMs = 6000; // 6-second polling loop
        this.timer = null;
        this.lastRevision = null;
        this.isRunning = false;
        this.isFetching = false;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;

        // Perform initial check
        this.checkSync();

        // Start interval
        this.timer = setInterval(() => {
            if (document.visibilityState === 'visible') {
                this.checkSync();
            }
        }, this.intervalMs);

        // Resume immediately when tab gains focus
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.isRunning) {
                this.checkSync();
            }
        });
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.isRunning = false;
    }

    async checkSync() {
        if (this.isFetching) return;
        this.isFetching = true;

        try {
            const res = await api.get('api/appointment_controller.php', { action: 'sync_state' });
            if (res && res.success && res.data) {
                const currentRev = res.data.revision;
                if (this.lastRevision !== null && this.lastRevision !== currentRev) {
                    // State changed on server! Broadcast update event
                    document.dispatchEvent(new CustomEvent('cprms:sync', {
                        detail: {
                            previousRevision: this.lastRevision,
                            currentRevision: currentRev,
                            data: res.data
                        }
                    }));
                }
                this.lastRevision = currentRev;
            }
        } catch (err) {
            // Quietly suppress network drop errors during polling
            console.debug('Live sync poll check failed:', err.message);
        } finally {
            this.isFetching = false;
        }
    }

    triggerSync() {
        this.checkSync();
    }
}

export const LiveSync = new LiveSyncEngine();
export default LiveSync;

