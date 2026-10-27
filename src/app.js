/**
 * Main Application Orchestrator
 * Connects UI events, Web Workers, IndexedDB Memory Persistence, Analytics and State Management
 */

import { sanitizeRecords, escapeHtml } from './services/spotifyParser.js';
import { computeGlobalKPIs, computeTopArtists, computeTopTracks } from './services/analyticsEngine.js';
import { ChartsManager } from './components/ChartsManager.js';
import { WrappedStories } from './components/WrappedStories.js';
import { ActivityHeatmap } from './components/ActivityHeatmap.js';
import { YearComparator } from './components/YearComparator.js';
import { ItemInspector } from './components/ItemInspector.js';
import { ExportService } from './services/exportService.js';
import { SessionStorageService } from './services/sessionStorageService.js';

class SpotifyApp {
  constructor() {
    this.rawRecords = [];
    this.filteredRecords = [];
    this.artistMetric = 'hours';
    this.currentSessionId = null;

    this.chartsManager = new ChartsManager();
    this.activityHeatmap = new ActivityHeatmap('heatmap-container');
    this.yearComparator = new YearComparator('comparator-modal');
    this.itemInspector = new ItemInspector('inspector-modal');

    this.wrappedStories = new WrappedStories({
      modalId: 'wrapped-modal',
      onToast: (msg, isErr) => this.showToast(msg, isErr)
    });

    this.initDOM();
    this.bindEvents();
    this.restoreSavedSession();
  }

  initDOM() {
    this.dropzone = document.getElementById('dropzone');
    this.fileInput = document.getElementById('file-input');
    this.btnLoadDemo = document.getElementById('btn-load-demo');
    this.btnReset = document.getElementById('btn-reset');
    this.btnOpenWrapped = document.getElementById('btn-open-wrapped');
    this.btnBannerWrapped = document.getElementById('btn-banner-wrapped');
    this.btnOpenComparator = document.getElementById('btn-open-comparator');
    this.btnExportPdf = document.getElementById('btn-export-pdf');
    this.btnExportTracksCsv = document.getElementById('btn-export-tracks-csv');
    this.btnExportArtistsCsv = document.getElementById('btn-export-artists-csv');

    this.btnOpenSessions = document.getElementById('btn-open-sessions');
    this.badgeSessionsCount = document.getElementById('badge-sessions-count');
    this.sessionsModal = document.getElementById('sessions-modal');
    this.btnCloseSessions = document.getElementById('btn-close-sessions');
    this.sessionsListEl = document.getElementById('sessions-list');
    this.sessionsEmptyEl = document.getElementById('sessions-empty');
    this.btnClearAllSessions = document.getElementById('btn-clear-all-sessions');

    this.parsingProgress = document.getElementById('parsing-progress');
    this.progressBarFill = document.getElementById('progress-bar-fill');
    this.progressText = document.getElementById('progress-text');
    this.progressPercentage = document.getElementById('progress-percentage');

    this.dashboardContent = document.getElementById('dashboard-content');
    this.uploaderSection = document.getElementById('uploader-section');

    this.filterYear = document.getElementById('filter-year');
    this.filterType = document.getElementById('filter-type');
    this.filterSkips = document.getElementById('filter-skips');

    this.btnArtistMetricHours = document.getElementById('btn-artist-metric-hours');
    this.btnArtistMetricPlays = document.getElementById('btn-artist-metric-plays');

    this.searchTracksInput = document.getElementById('search-tracks');
    this.searchArtistsInput = document.getElementById('search-artists');
  }

  bindEvents() {
    // Dropzone drag & drop
    ['dragenter', 'dragover'].forEach(name => {
      this.dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        this.dropzone.classList.add('border-spotify', 'spotify-glow');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      this.dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        this.dropzone.classList.remove('border-spotify', 'spotify-glow');
      });
    });

    this.dropzone.addEventListener('drop', (e) => {
      const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.json'));
      if (files.length === 0) {
        this.showToast('Por favor suelta archivos válidos con extensión .json', true);
        return;
      }
      this.processFilesWithWorker(files);
    });

    this.fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) this.processFilesWithWorker(files);
    });

    // Filters
    this.filterYear.addEventListener('change', () => this.applyFiltersAndRender());
    this.filterType.addEventListener('change', () => this.applyFiltersAndRender());
    this.filterSkips.addEventListener('change', () => this.applyFiltersAndRender());

    // Artist Metric toggle
    this.btnArtistMetricHours.addEventListener('click', () => {
      this.artistMetric = 'hours';
      this.btnArtistMetricHours.className = 'px-2.5 py-1 rounded font-bold bg-spotify text-black transition-all';
      this.btnArtistMetricPlays.className = 'px-2.5 py-1 rounded font-medium text-slate-400 hover:text-white transition-all';
      this.renderTopArtistsSection();
    });

    this.btnArtistMetricPlays.addEventListener('click', () => {
      this.artistMetric = 'plays';
      this.btnArtistMetricPlays.className = 'px-2.5 py-1 rounded font-bold bg-spotify text-black transition-all';
      this.btnArtistMetricHours.className = 'px-2.5 py-1 rounded font-medium text-slate-400 hover:text-white transition-all';
      this.renderTopArtistsSection();
    });

    // Comparator modal trigger
    this.btnOpenComparator?.addEventListener('click', () => {
      this.yearComparator.open(this.rawRecords);
    });

    // PDF / Print Report
    this.btnExportPdf?.addEventListener('click', () => {
      ExportService.printReport();
    });

    // CSV Exports
    this.btnExportTracksCsv?.addEventListener('click', () => {
      const topTracks = computeTopTracks(this.filteredRecords, 100);
      const rows = topTracks.map(t => [t.trackName, t.artistName, t.plays, (t.ms / 3600000).toFixed(2), t.skipRate]);
      ExportService.exportTableToCSV('spotify_top_tracks.csv', rows, ['Canción', 'Artista', 'Reproducciones', 'Horas', 'SkipRate%']);
      this.showToast('Descargando archivo CSV de canciones...');
    });

    this.btnExportArtistsCsv?.addEventListener('click', () => {
      const topArtists = computeTopArtists(this.filteredRecords, 100);
      const rows = topArtists.map(a => [a.name, a.plays, (a.ms / 3600000).toFixed(2)]);
      ExportService.exportTableToCSV('spotify_top_artists.csv', rows, ['Artista', 'Reproducciones', 'Horas']);
      this.showToast('Descargando archivo CSV de artistas...');
    });

    // Sessions Modal
    this.btnOpenSessions?.addEventListener('click', () => this.openSessionsModal());
    this.btnCloseSessions?.addEventListener('click', () => this.closeSessionsModal());
    this.btnClearAllSessions?.addEventListener('click', async () => {
      if (confirm('¿Estás seguro de que deseas eliminar todas las sesiones guardadas en este navegador?')) {
        await SessionStorageService.clearAllSessions();
        this.resetSession();
        this.closeSessionsModal();
        this.updateSessionsBadge();
        this.showToast('Todas las sesiones han sido borradas.');
      }
    });

    // Search inputs
    this.searchTracksInput.addEventListener('input', () => this.renderTracksTable());
    this.searchArtistsInput.addEventListener('input', () => this.renderArtistsTable());

    // Reset
    this.btnReset.addEventListener('click', () => this.resetSession());

    // Demo
    this.btnLoadDemo.addEventListener('click', () => this.loadDemoData());

    // Wrapped modal triggers
    this.btnOpenWrapped.addEventListener('click', () => this.openWrapped());
    this.btnBannerWrapped.addEventListener('click', () => this.openWrapped());
  }

  showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');
    const toastIcon = document.getElementById('toast-icon');

    toastMsg.textContent = message;
    if (isError) {
      toastIcon.className = 'fa-solid fa-triangle-exclamation text-red-500';
      toast.querySelector('div').classList.add('border-red-500');
      toast.querySelector('div').classList.remove('border-spotify');
    } else {
      toastIcon.className = 'fa-solid fa-circle-check text-spotify';
      toast.querySelector('div').classList.add('border-spotify');
      toast.querySelector('div').classList.remove('border-red-500');
    }

    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
      toast.classList.add('translate-y-20', 'opacity-0');
      toast.classList.remove('translate-y-0', 'opacity-100');
    }, 3500);
  }

  async restoreSavedSession() {
    this.updateSessionsBadge();
    const activeId = SessionStorageService.getActiveSessionId();
    if (!activeId) return;

    try {
      const session = await SessionStorageService.loadSession(activeId);
      if (session && session.records && session.records.length > 0) {
        this.rawRecords = session.records;
        this.currentSessionId = session.id;

        this.populateYearSelector();
        this.applyFiltersAndRender();
        this.showDashboardUI();
        this.showToast(`Sesión restaurada de memoria: "${session.name}"`);
      }
    } catch (err) {
      console.warn('Error restaurando sesión anterior de IndexedDB:', err);
    }
  }

  async updateSessionsBadge() {
    try {
      const list = await SessionStorageService.listSessions();
      if (list.length > 0) {
        this.badgeSessionsCount.textContent = list.length;
        this.badgeSessionsCount.classList.remove('hidden');
      } else {
        this.badgeSessionsCount.classList.add('hidden');
      }
    } catch (e) {
      // ignore
    }
  }

  async openSessionsModal() {
    const list = await SessionStorageService.listSessions();
    this.sessionsListEl.innerHTML = '';

    if (list.length === 0) {
      this.sessionsEmptyEl.classList.remove('hidden');
      this.sessionsListEl.classList.add('hidden');
    } else {
      this.sessionsEmptyEl.classList.add('hidden');
      this.sessionsListEl.classList.remove('hidden');

      const currentActive = SessionStorageService.getActiveSessionId();

      list.forEach(sess => {
        const item = document.createElement('div');
        const isActive = sess.id === currentActive;
        const dStr = new Date(sess.updatedAt).toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        item.className = `p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${isActive ? 'bg-spotify/10 border-spotify/50' : 'bg-surface-card border-surface-border hover:border-slate-500'}`;
        item.innerHTML = `
          <div class="flex items-center gap-3 cursor-pointer flex-1 min-w-0" data-action="load">
            <div class="w-10 h-10 rounded-xl ${isActive ? 'bg-spotify text-black' : 'bg-black/50 text-purple-400 border border-surface-border'} flex items-center justify-center font-bold text-base flex-shrink-0">
              <i class="fa-solid fa-database"></i>
            </div>
            <div class="truncate">
              <div class="flex items-center gap-2">
                <span class="font-bold text-white text-xs truncate">${escapeHtml(sess.name)}</span>
                ${isActive ? '<span class="text-[9px] bg-spotify text-black px-1.5 py-0.2 rounded font-black uppercase">Activa</span>' : ''}
              </div>
              <div class="text-[11px] text-surface-muted mt-0.5">
                ${sess.count.toLocaleString()} eventos &bull; ${dStr}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button class="px-2.5 py-1 text-xs rounded-lg ${isActive ? 'bg-spotify text-black font-extrabold' : 'bg-surface-cardHover hover:bg-spotify hover:text-black text-slate-200'} transition-all" data-action="load">
              ${isActive ? 'Cargada' : 'Cargar'}
            </button>
            <button class="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center justify-center text-xs transition-colors" data-action="delete" title="Eliminar sesión">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        `;

        // Load handler
        item.querySelectorAll('[data-action="load"]').forEach(el => {
          el.addEventListener('click', async () => {
            const fullSess = await SessionStorageService.loadSession(sess.id);
            if (fullSess) {
              SessionStorageService.setActiveSessionId(sess.id);
              this.rawRecords = fullSess.records;
              this.currentSessionId = sess.id;
              this.populateYearSelector();
              this.applyFiltersAndRender();
              this.showDashboardUI();
              this.closeSessionsModal();
              this.showToast(`Sesión "${sess.name}" cargada.`);
            }
          });
        });

        // Delete handler
        item.querySelector('[data-action="delete"]').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`¿Eliminar la sesión "${sess.name}"?`)) {
            await SessionStorageService.deleteSession(sess.id);
            if (this.currentSessionId === sess.id) {
              this.resetSession();
            }
            this.openSessionsModal();
            this.updateSessionsBadge();
            this.showToast('Sesión eliminada.');
          }
        });

        this.sessionsListEl.appendChild(item);
      });
    }

    this.sessionsModal.classList.remove('hidden');
    setTimeout(() => this.sessionsModal.classList.remove('opacity-0'), 20);
  }

  closeSessionsModal() {
    this.sessionsModal.classList.add('opacity-0');
    setTimeout(() => this.sessionsModal.classList.add('hidden'), 250);
  }

  showDashboardUI() {
    this.uploaderSection.classList.add('hidden');
    this.dashboardContent.classList.remove('hidden');
    this.btnReset.classList.remove('hidden');
    this.btnReset.classList.add('flex');
    this.btnOpenWrapped.classList.remove('hidden');
    this.btnOpenWrapped.classList.add('flex');
    this.btnOpenComparator.classList.remove('hidden');
    this.btnOpenComparator.classList.add('flex');
    this.btnExportPdf.classList.remove('hidden');
    this.btnExportPdf.classList.add('flex');
  }

  async processFilesWithWorker(files) {
    this.parsingProgress.classList.remove('hidden');
    this.progressBarFill.style.width = '0%';
    this.progressPercentage.textContent = '0%';
    this.progressText.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin text-spotify"></i> Leyendo ${files.length} archivo(s)...`;

    // Read files text
    const filePayloads = [];
    for (let i = 0; i < files.length; i++) {
      const text = await files[i].text();
      filePayloads.push({ name: files[i].name, text });
      const readPercent = Math.round(((i + 1) / files.length) * 50);
      this.progressBarFill.style.width = `${readPercent}%`;
      this.progressPercentage.textContent = `${readPercent}%`;
    }

    this.progressText.innerHTML = `<i class="fa-solid fa-gears fa-spin text-spotify"></i> Deserializando y normalizando en Web Worker...`;

    // Initialize Web Worker
    const worker = new Worker(new URL('./workers/parser.worker.js', import.meta.url), { type: 'module' });

    worker.onmessage = async (e) => {
      const msg = e.data;
      if (msg.type === 'PROGRESS') {
        const totalPct = 50 + Math.round(msg.percentage * 0.5);
        this.progressBarFill.style.width = `${totalPct}%`;
        this.progressPercentage.textContent = `${totalPct}%`;
      } else if (msg.type === 'COMPLETE') {
        worker.terminate();
        this.rawRecords = sanitizeRecords(msg.records);
        this.parsingProgress.classList.add('hidden');

        if (this.rawRecords.length === 0) {
          this.showToast('No se encontraron reproducciones válidas en los archivos seleccionados.', true);
          return;
        }

        // Generate persistent session in IndexedDB
        const sessionName = `Importación (${files.map(f => f.name).slice(0, 2).join(', ')}${files.length > 2 ? ` +${files.length - 2}` : ''})`;
        const sessId = `session_${Date.now()}`;
        this.currentSessionId = sessId;

        await SessionStorageService.saveSession(sessId, sessionName, this.rawRecords);
        this.updateSessionsBadge();

        this.showToast(`¡Cargados y guardados en memoria ${this.rawRecords.length.toLocaleString()} eventos!`);
        this.populateYearSelector();
        this.applyFiltersAndRender();
        this.showDashboardUI();
      }
    };

    worker.postMessage({ files: filePayloads });
  }

  populateYearSelector() {
    const years = Array.from(new Set(this.rawRecords.map(r => r.year))).sort((a, b) => b - a);
    this.filterYear.innerHTML = '<option value="ALL">Histórico Completo</option>';
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = `Año ${y}`;
      this.filterYear.appendChild(opt);
    });
  }

  applyFiltersAndRender() {
    const yearVal = this.filterYear.value;
    const typeVal = this.filterType.value;
    const skipsVal = this.filterSkips.value;

    this.filteredRecords = this.rawRecords.filter(r => {
      if (yearVal !== 'ALL' && r.year.toString() !== yearVal) return false;
      if (typeVal === 'TRACKS' && r.isPodcast) return false;
      if (typeVal === 'PODCASTS' && !r.isPodcast) return false;
      if (skipsVal === 'VALID_ONLY' && r.msPlayed < 30000) return false;
      return true;
    });

    document.getElementById('badge-records-count').textContent = this.filteredRecords.length.toLocaleString();

    // 1. KPIs
    this.renderKPIs();

    // 2. Charts
    this.renderCharts();

    // 3. Tables
    this.renderTracksTable();
    this.renderArtistsTable();

    // 4. Listening Habits
    this.renderHabits();

    // 5. Activity Heatmap Matrix
    this.activityHeatmap.render(this.rawRecords, yearVal);
  }

  renderKPIs() {
    const kpis = computeGlobalKPIs(this.filteredRecords);
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    document.getElementById('kpi-hours').textContent = kpis.totalHours.toLocaleString();
    document.getElementById('kpi-days-equiv').textContent = `≈ ${kpis.daysEquivalent} días continuos`;

    document.getElementById('kpi-streams').textContent = kpis.totalStreams.toLocaleString();
    document.getElementById('kpi-avg-duration').textContent = `Media: ${kpis.avgDurationMinutes} min/stream`;

    document.getElementById('kpi-artists').textContent = kpis.uniqueArtists.toLocaleString();
    document.getElementById('kpi-tracks').textContent = kpis.uniqueTracks.toLocaleString();
    document.getElementById('kpi-skips').textContent = `${kpis.skipRate}%`;

    document.getElementById('kpi-peak-hour').textContent = `${String(kpis.peakHour).padStart(2, '0')}:00`;
    document.getElementById('kpi-peak-day').textContent = `Día: ${dayNames[kpis.peakDay]}`;
  }

  renderCharts() {
    this.chartsManager.renderTimeline('chart-timeline', this.filteredRecords);
    this.chartsManager.renderPlatforms('chart-platforms', this.filteredRecords);
    this.renderTopArtistsSection();
    this.chartsManager.renderHourly('chart-hourly', this.filteredRecords);
    this.chartsManager.renderWeekday('chart-weekday', this.filteredRecords);
    this.chartsManager.renderReasonStart('chart-reason-start', this.filteredRecords);
    this.chartsManager.renderReasonEnd('chart-reason-end', this.filteredRecords);
  }

  renderTopArtistsSection() {
    const top = computeTopArtists(this.filteredRecords, 10);
    this.chartsManager.renderTopArtists('chart-top-artists', top, this.artistMetric);
  }

  renderTracksTable() {
    const query = this.searchTracksInput.value.toLowerCase().trim();
    let topTracks = computeTopTracks(this.filteredRecords, 50);

    if (query) {
      topTracks = topTracks.filter(t =>
        t.trackName.toLowerCase().includes(query) ||
        t.artistName.toLowerCase().includes(query)
      );
    }

    const tbody = document.getElementById('table-tracks-body');
    tbody.innerHTML = '';

    topTracks.slice(0, 15).forEach((t, i) => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-white/5 transition-colors';
      row.innerHTML = `
        <td class="py-2.5 px-3 text-slate-500 font-bold">${i + 1}</td>
        <td class="py-2.5 px-3">
          <div class="font-bold text-white truncate max-w-xs">${escapeHtml(t.trackName)}</div>
          <div class="text-[11px] text-surface-muted truncate max-w-xs">${escapeHtml(t.artistName)}</div>
        </td>
        <td class="py-2.5 px-3 text-right font-mono">${t.plays.toLocaleString()}</td>
        <td class="py-2.5 px-3 text-right font-mono text-spotify font-bold">${(t.ms / 3600000).toFixed(1)}h</td>
        <td class="py-2.5 px-3 text-right font-mono text-slate-400">${t.skipRate}%</td>
      `;
      tbody.appendChild(row);
    });
  }

  renderArtistsTable() {
    const query = this.searchArtistsInput.value.toLowerCase().trim();
    let topArtists = computeTopArtists(this.filteredRecords, 50);

    if (query) {
      topArtists = topArtists.filter(a => a.name.toLowerCase().includes(query));
    }

    const tbody = document.getElementById('table-artists-body');
    tbody.innerHTML = '';

    topArtists.slice(0, 15).forEach((a, i) => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-spotify/10 transition-colors cursor-pointer group';
      row.title = 'Haz clic para ver el expediente completo de este artista';
      row.innerHTML = `
        <td class="py-2.5 px-3 text-slate-500 font-bold group-hover:text-spotify">${i + 1}</td>
        <td class="py-2.5 px-3 font-bold text-white truncate max-w-xs group-hover:text-spotify flex items-center justify-between">
          <span>${escapeHtml(a.name)}</span>
          <i class="fa-solid fa-chevron-right text-[10px] text-surface-muted group-hover:text-spotify transition-transform group-hover:translate-x-1"></i>
        </td>
        <td class="py-2.5 px-3 text-right font-mono">${a.plays.toLocaleString()}</td>
        <td class="py-2.5 px-3 text-right font-mono text-spotify font-bold">${(a.ms / 3600000).toFixed(1)}h</td>
      `;
      row.addEventListener('click', () => {
        this.itemInspector.openArtist(a.name, this.rawRecords);
      });
      tbody.appendChild(row);
    });
  }

  renderHabits() {
    // Countries
    const cMap = {};
    let offlineCount = 0;
    let shuffleCount = 0;
    const total = this.filteredRecords.length;

    this.filteredRecords.forEach(r => {
      if (r.country && r.country !== 'Desconocido') {
        cMap[r.country] = (cMap[r.country] || 0) + 1;
      }
      if (r.offline) offlineCount++;
      if (r.shuffle) shuffleCount++;
    });

    const cContainer = document.getElementById('countries-list');
    cContainer.innerHTML = '';
    const sortedCountries = Object.entries(cMap).sort((a, b) => b[1] - a[1]);

    sortedCountries.slice(0, 8).forEach(([c, cnt]) => {
      const badge = document.createElement('span');
      badge.className = 'px-2.5 py-1 bg-surface-card rounded-lg text-xs font-mono font-bold text-slate-300 border border-surface-border flex items-center gap-1.5';
      badge.innerHTML = `<span class="text-spotify">●</span> ${c} <span class="text-[10px] text-surface-muted">(${cnt})</span>`;
      cContainer.appendChild(badge);
    });

    // Offline pct
    const offPct = total > 0 ? Math.round((offlineCount / total) * 100) : 0;
    document.getElementById('stat-offline-pct').textContent = `${offPct}%`;
    document.getElementById('bar-offline-fill').style.width = `${offPct}%`;

    // Shuffle pct
    const shufPct = total > 0 ? Math.round((shuffleCount / total) * 100) : 0;
    document.getElementById('stat-shuffle-pct').textContent = `${shufPct}%`;
    document.getElementById('bar-shuffle-fill').style.width = `${shufPct}%`;
  }

  openWrapped() {
    this.wrappedStories.open(this.rawRecords, this.filterYear.value);
  }

  resetSession() {
    this.rawRecords = [];
    this.filteredRecords = [];
    this.currentSessionId = null;
    SessionStorageService.setActiveSessionId('');
    this.chartsManager.destroyAll();

    this.dashboardContent.classList.add('hidden');
    this.uploaderSection.classList.remove('hidden');
    this.btnReset.classList.add('hidden');
    this.btnOpenWrapped.classList.add('hidden');
    this.btnOpenWrapped.classList.remove('flex');
    this.btnOpenComparator.classList.add('hidden');
    this.btnOpenComparator.classList.remove('flex');
    this.btnExportPdf.classList.add('hidden');
    this.btnExportPdf.classList.remove('flex');
    this.fileInput.value = '';

    this.showToast('Sesión limpiada.');
  }

  async loadDemoData() {
    const demoArtists = [
      { name: 'Bad Bunny', tracks: ['Tití Me Preguntó', 'Moscow Mule', 'Ojitos Lindos', 'Neverita'] },
      { name: 'Rosalía', tracks: ['DESPECHÁ', 'SAKURA', 'BIZCOCHITO', 'CANDY'] },
      { name: 'Daft Punk', tracks: ['Get Lucky', 'One More Time', 'Instant Crush', 'Around the World'] },
      { name: 'The Weeknd', tracks: ['Blinding Lights', 'Save Your Tears', 'Starboy', 'Die For You'] },
      { name: 'C. Tangana', tracks: ['Tú Me Dejaste De Querer', 'Demasiadas Mujeres', 'Ateo', 'Ingobernable'] },
      { name: 'Taylor Swift', tracks: ['Anti-Hero', 'Cruel Summer', 'Blank Space', 'Cardigan'] },
      { name: 'Bizarrap', tracks: ['Quevedo: BZRP Music Sessions #52', 'Shakira: BZRP Music Sessions #53'] },
      { name: 'Arctic Monkeys', tracks: ['Do I Wanna Know?', '505', 'R U Mine?', 'Fluorescent Adolescent'] }
    ];

    const platforms = ['iOS', 'Android', 'Desktop', 'Web Player', 'Smart Speakers / TV'];
    const countries = ['ES', 'MX', 'US', 'FR', 'UK'];
    const reasonsStart = ['trackdone', 'clickrow', 'shuffle', 'appload'];
    const reasonsEnd = ['trackdone', 'fwdbtn', 'endplay', 'backbtn'];

    const mock = [];
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 2, currentYear - 1, currentYear];

    for (let i = 0; i < 3500; i++) {
      const year = years[Math.floor(Math.random() * years.length)];
      const month = Math.floor(Math.random() * 12);
      const day = Math.floor(Math.random() * 28) + 1;
      const hour = Math.floor(Math.random() * 24);
      const date = new Date(Date.UTC(year, month, day, hour, Math.floor(Math.random() * 60)));

      const artistObj = demoArtists[Math.floor(Math.random() * demoArtists.length)];
      const track = artistObj.tracks[Math.floor(Math.random() * artistObj.tracks.length)];
      const msPlayed = Math.random() < 0.15 ? Math.floor(Math.random() * 25000) : (120000 + Math.floor(Math.random() * 180000));
      const skipped = msPlayed < 30000;

      mock.push({
        ts: date.toISOString(),
        username: "spotify_user_demo",
        platform: platforms[Math.floor(Math.random() * platforms.length)],
        ms_played: msPlayed,
        conn_country: countries[Math.floor(Math.random() * countries.length)],
        master_metadata_track_name: track,
        master_metadata_album_artist_name: artistObj.name,
        master_metadata_album_album_name: `Álbum de ${artistObj.name}`,
        spotify_track_uri: `spotify:track:demo_${i}`,
        reason_start: reasonsStart[Math.floor(Math.random() * reasonsStart.length)],
        reason_end: skipped ? 'fwdbtn' : reasonsEnd[Math.floor(Math.random() * reasonsEnd.length)],
        shuffle: Math.random() > 0.4,
        skipped: skipped,
        offline: Math.random() < 0.12,
        incognito_mode: false
      });
    }

    this.rawRecords = sanitizeRecords(mock);
    const sessId = 'demo_session';
    this.currentSessionId = sessId;

    await SessionStorageService.saveSession(sessId, 'Demostración Interactiva', this.rawRecords);
    this.updateSessionsBadge();

    this.populateYearSelector();
    this.applyFiltersAndRender();
    this.showDashboardUI();

    this.showToast('¡Datos demo cargados y guardados en memoria IndexedDB!');
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.spotifyApp = new SpotifyApp();
});
