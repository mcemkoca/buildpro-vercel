// BuildPro PWA Module
// Handles service worker registration, offline detection, install prompts,
// localStorage data caching, and sync indicators.

(function() {
  'use strict';

  const PWA = {
    swRegistration: null,
    deferredPrompt: null,
    isOnline: navigator.onLine,
    cachePrefix: 'bp_cache_',
    lastSyncKey: 'bp_last_sync',
    installDismissedKey: 'bp_install_dismissed',

    init() {
      this.registerServiceWorker();
      this.setupNetworkListeners();
      this.renderOfflineIndicator();
      this.renderInstallBanner();
      this.renderSyncIndicator();
      this.setupStorageCacheHelpers();
    },

    // ── Service Worker ───────────────────────────────────────────────
    registerServiceWorker() {
      if (!('serviceWorker' in navigator)) {
        console.log('[PWA] Service Worker not supported');
        return;
      }
      const scope = '/buildpro-vercel/';
      navigator.serviceWorker.register('sw.js', { scope })
        .then((reg) => {
          this.swRegistration = reg;
          console.log('[PWA] SW registered:', reg.scope);
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  this.showUpdateNotification();
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn('[PWA] SW registration failed:', err);
        });

      // Listen for messages from SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SYNC_COMPLETE') {
          this.updateSyncStatus('synced');
        }
      });
    },

    showUpdateNotification() {
      const div = document.createElement('div');
      div.id = 'bp-update-toast';
      div.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:9999;background:var(--success-500);color:white;padding:12px 24px;border-radius:var(--radius-md);font-weight:600;box-shadow:var(--shadow-lg);cursor:pointer;animation:toastIn 0.3s ease;';
      div.textContent = '🔄 Yeni versiyon mevcut. Sayfayı yenilemek için tıklayın.';
      div.addEventListener('click', () => {
        if (this.swRegistration && this.swRegistration.waiting) {
          this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        window.location.reload();
      });
      document.body.appendChild(div);
    },

    // ── Network Status ─────────────────────────────────────────────
    setupNetworkListeners() {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.updateOfflineBadge();
        this.updateSyncStatus('syncing');
        this.triggerSync();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.updateOfflineBadge();
        this.updateSyncStatus('offline');
      });
    },

    renderOfflineIndicator() {
      const indicator = document.createElement('div');
      indicator.id = 'bp-offline-badge';
      indicator.style.cssText = 'position:fixed;top:4px;right:4px;z-index:10000;background:#ef4444;color:white;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;display:none;pointer-events:none;';
      indicator.textContent = this._getLangText('offline', 'Çevrimdışı');
      document.body.appendChild(indicator);
      this.updateOfflineBadge();
    },

    updateOfflineBadge() {
      const badge = document.getElementById('bp-offline-badge');
      if (!badge) return;
      badge.style.display = this.isOnline ? 'none' : 'block';
    },

    // ── Sync Indicator ─────────────────────────────────────────────
    renderSyncIndicator() {
      const indicator = document.createElement('div');
      indicator.id = 'bp-sync-indicator';
      indicator.style.cssText = 'position:fixed;top:4px;right:80px;z-index:10000;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;pointer-events:none;display:flex;align-items:center;gap:4px;transition:all 0.3s;';
      indicator.innerHTML = `<span id="bp-sync-dot" style="width:7px;height:7px;border-radius:50%;background:var(--success-500);display:inline-block;"></span><span id="bp-sync-text"></span>`;
      document.body.appendChild(indicator);
      this.updateSyncStatus(this.isOnline ? 'synced' : 'offline');
    },

    updateSyncStatus(status) {
      const indicator = document.getElementById('bp-sync-indicator');
      const dot = document.getElementById('bp-sync-dot');
      const text = document.getElementById('bp-sync-text');
      if (!indicator || !dot || !text) return;

      const styles = {
        synced:   { color: '#0d9488', bg: 'rgba(13,148,136,0.12)', label: this._getLangText('synced', 'Senkronize') },
        syncing:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: this._getLangText('syncing', 'Senkronize ediliyor...') },
        offline:  { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: this._getLangText('offline', 'Çevrimdışı') },
        unsaved:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: this._getLangText('unsaved', 'Kaydedilmemiş değişiklikler') }
      };
      const s = styles[status] || styles.synced;
      dot.style.background = s.color;
      indicator.style.color = s.color;
      indicator.style.background = s.bg;
      text.textContent = s.label;
    },

    triggerSync() {
      if ('sync' in navigator && this.swRegistration) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.sync.register('buildpro-sync').catch(() => {});
        });
      }
      this.updateSyncStatus('syncing');
      setTimeout(() => {
        if (this.isOnline) this.updateSyncStatus('synced');
      }, 1500);
    },

    // ── Install Banner ───────────────────────────────────────────────
    renderInstallBanner() {
      if (localStorage.getItem(this.installDismissedKey) === '1') return;
      if (!this.isInstallable()) return;

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt = e;
        this.showInstallBanner();
      });

      if (this.isIOS()) {
        this.showIOSInstallHint();
      }
    },

    isInstallable() {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                           window.navigator.standalone ||
                           document.referrer.includes('android-app://');
      return !isStandalone;
    },

    isIOS() {
      return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    },

    showInstallBanner() {
      if (document.getElementById('bp-install-banner')) return;
      const banner = document.createElement('div');
      banner.id = 'bp-install-banner';
      banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:10001;background:var(--bg-card);border-top:1px solid var(--border);padding:12px 20px;display:flex;align-items:center;justify-content:center;gap:16px;box-shadow:0 -4px 20px rgba(0,0,0,0.15);animation:slideUp 0.4s ease;';
      banner.innerHTML = `
        <span style="font-size:20px;">📲</span>
        <span style="font-size:var(--text-sm);font-weight:500;color:var(--text-primary);">${this._getLangText('install_prompt', 'BuildPro\'yu ana ekranınıza ekleyin — hızlı erişim için.')}</span>
        <button id="bp-install-btn" style="background:var(--primary-500);color:white;border:none;padding:8px 18px;border-radius:var(--radius-md);font-weight:600;font-size:var(--text-sm);cursor:pointer;white-space:nowrap;">${this._getLangText('install', 'Yükle')}</button>
        <button id="bp-install-dismiss" style="background:none;border:none;color:var(--text-muted);font-size:18px;cursor:pointer;padding:4px;">✕</button>
      `;
      document.body.appendChild(banner);

      document.getElementById('bp-install-btn').addEventListener('click', () => {
        if (this.deferredPrompt) {
          this.deferredPrompt.prompt();
          this.deferredPrompt.userChoice.then((choice) => {
            if (choice.outcome === 'accepted') {
              banner.remove();
            }
            this.deferredPrompt = null;
          });
        }
      });
      document.getElementById('bp-install-dismiss').addEventListener('click', () => {
        localStorage.setItem(this.installDismissedKey, '1');
        banner.remove();
      });
    },

    showIOSInstallHint() {
      if (localStorage.getItem(this.installDismissedKey) === '1') return;
      const banner = document.createElement('div');
      banner.id = 'bp-install-banner';
      banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:10001;background:var(--bg-card);border-top:1px solid var(--border);padding:12px 20px;display:flex;align-items:center;justify-content:center;gap:16px;box-shadow:0 -4px 20px rgba(0,0,0,0.15);animation:slideUp 0.4s ease;';
      banner.innerHTML = `
        <span style="font-size:20px;">📲</span>
        <span style="font-size:var(--text-sm);font-weight:500;color:var(--text-primary);">${this._getLangText('ios_install', 'Safari menüsünden "Ana Ekrana Ekle" seçeneğini kullanabilirsiniz.')}</span>
        <button id="bp-install-dismiss" style="background:none;border:none;color:var(--text-muted);font-size:18px;cursor:pointer;padding:4px;">✕</button>
      `;
      document.body.appendChild(banner);
      document.getElementById('bp-install-dismiss').addEventListener('click', () => {
        localStorage.setItem(this.installDismissedKey, '1');
        banner.remove();
      });
    },

    // ── localStorage Caching ─────────────────────────────────────────
    setupStorageCacheHelpers() {
      window.BPCache = {
        get: (key) => {
          try {
            const raw = localStorage.getItem(PWA.cachePrefix + key);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed.expires && Date.now() > parsed.expires) {
              localStorage.removeItem(PWA.cachePrefix + key);
              return null;
            }
            return parsed.data;
          } catch { return null; }
        },
        set: (key, data, ttlMinutes = 60) => {
          try {
            const payload = { data, expires: ttlMinutes ? Date.now() + ttlMinutes * 60000 : null };
            localStorage.setItem(PWA.cachePrefix + key, JSON.stringify(payload));
          } catch (e) {
            console.warn('[BPCache] Storage quota exceeded:', e);
          }
        },
        remove: (key) => localStorage.removeItem(PWA.cachePrefix + key),
        clear: () => {
          Object.keys(localStorage).forEach((k) => {
            if (k.startsWith(PWA.cachePrefix)) localStorage.removeItem(k);
          });
        },
        getTableData: (tableName) => BPCache.get('table_' + tableName),
        setTableData: (tableName, rows, ttl = 30) => BPCache.set('table_' + tableName, rows, ttl),
        isOffline: () => !PWA.isOnline,
        markUnsaved: () => PWA.updateSyncStatus('unsaved')
      };
    },

    // ── i18n Helper ──────────────────────────────────────────────────
    _getLangText(key, fallback) {
      const lang = document.documentElement.lang || 'tr';
      const dict = {
        tr: {
          offline: 'Çevrimdışı',
          synced: 'Senkronize',
          syncing: 'Senkronize ediliyor...',
          unsaved: 'Kaydedilmemiş değişiklikler',
          install_prompt: 'BuildPro\'yu ana ekranınıza ekleyin — hızlı erişim için.',
          install: 'Yükle',
          ios_install: 'Safari menüsünden "Ana Ekrana Ekle" seçeneğini kullanabilirsiniz.'
        },
        en: {
          offline: 'Offline',
          synced: 'Synced',
          syncing: 'Syncing...',
          unsaved: 'Unsaved changes',
          install_prompt: 'Add BuildPro to your home screen for quick access.',
          install: 'Install',
          ios_install: 'Use Safari menu "Add to Home Screen" to install.'
        },
        nl: {
          offline: 'Offline',
          synced: 'Gesynchroniseerd',
          syncing: 'Bezig met synchroniseren...',
          unsaved: 'Niet-opgeslagen wijzigingen',
          install_prompt: 'Voeg BuildPro toe aan uw startscherm voor snelle toegang.',
          install: 'Installeren',
          ios_install: 'Gebruik Safari-menu "Toevoegen aan startscherm".'
        }
      };
      return (dict[lang] && dict[lang][key]) || fallback;
    }
  };

  // Add CSS animation for banners
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes slideDown { from { transform: translateY(0); opacity: 1; } to { transform: translateY(100%); opacity: 0; } }
    @keyframes toastIn { from { transform: translate(-50%,-20px); opacity: 0; } to { transform: translate(-50%,0); opacity: 1; } }
  `;
  document.head.appendChild(style);

  // Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PWA.init());
  } else {
    PWA.init();
  }
})();
