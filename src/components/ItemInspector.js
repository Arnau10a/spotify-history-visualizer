/**
 * ItemInspector Component
 * Deep-dive modal for inspecting an Artist or Track's lifelong journey
 */

import { escapeHtml } from '../services/spotifyParser.js';

export class ItemInspector {
  constructor(modalId) {
    this.modal = document.getElementById(modalId);
    this.btnClose = document.getElementById('btn-close-inspector');
    this.contentContainer = document.getElementById('inspector-content');
    this.artistChartInstance = null;

    this.bindEvents();
  }

  bindEvents() {
    this.btnClose?.addEventListener('click', () => this.close());
    window.addEventListener('keydown', (e) => {
      if (this.modal && !this.modal.classList.contains('hidden') && e.key === 'Escape') {
        this.close();
      }
    });
  }

  openArtist(artistName, rawRecords) {
    const artistRecords = rawRecords.filter(r => r.artistName === artistName);
    if (artistRecords.length === 0) return;

    // Calculations
    const totalMs = artistRecords.reduce((sum, r) => sum + r.msPlayed, 0);
    const totalPlays = artistRecords.length;
    const sortedByDate = [...artistRecords].sort((a, b) => a.ts - b.ts);
    const firstListened = sortedByDate[0].ts.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    const lastListened = sortedByDate[sortedByDate.length - 1].ts.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

    // Evolution by Year across the entire user history span
    const allYears = Array.from(new Set(rawRecords.map(r => r.year))).sort((a, b) => a - b);
    const minYear = allYears[0] || sortedByDate[0].year;
    const maxYear = allYears[allYears.length - 1] || sortedByDate[sortedByDate.length - 1].year;

    const yearData = {};
    for (let y = minYear; y <= maxYear; y++) {
      yearData[y] = { hours: 0, plays: 0 };
    }

    artistRecords.forEach(r => {
      if (!yearData[r.year]) {
        yearData[r.year] = { hours: 0, plays: 0 };
      }
      yearData[r.year].hours += (r.msPlayed / 3600000);
      yearData[r.year].plays += 1;
    });

    // Top Tracks of this artist
    const trackMap = {};
    artistRecords.forEach(r => {
      trackMap[r.trackName] = (trackMap[r.trackName] || 0) + 1;
    });
    const topTracks = Object.entries(trackMap).sort((a, b) => b[1] - a[1]).slice(0, 6);

    // Top Albums
    const albumMap = {};
    artistRecords.forEach(r => {
      if (r.albumName && r.albumName !== 'Álbum Desconocido') {
        albumMap[r.albumName] = (albumMap[r.albumName] || 0) + 1;
      }
    });
    const topAlbums = Object.entries(albumMap).sort((a, b) => b[1] - a[1]).slice(0, 4);

    this.contentContainer.innerHTML = `
      <div class="space-y-6">
        <!-- Header -->
        <div class="flex items-center gap-4 border-b border-surface-border pb-4">
          <div class="w-16 h-16 rounded-2xl bg-spotify/20 border border-spotify/50 flex items-center justify-center text-3xl text-spotify shadow-xl flex-shrink-0">
            <i class="fa-solid fa-microphone"></i>
          </div>
          <div class="min-w-0 flex-1">
            <span class="text-[10px] font-extrabold uppercase text-spotify tracking-widest">Expediente de Artista</span>
            <h3 class="text-2xl font-black text-white truncate">${escapeHtml(artistName)}</h3>
            <p class="text-xs text-surface-muted mt-0.5">
              Descubierto el <strong class="text-slate-200">${firstListened}</strong> &bull; Última vez el <strong class="text-slate-200">${lastListened}</strong>
            </p>
          </div>
        </div>

        <!-- KPIs -->
        <div class="grid grid-cols-3 gap-3">
          <div class="p-3.5 rounded-xl bg-black/40 border border-surface-border text-center">
            <span class="text-[10px] text-surface-muted uppercase font-bold block">Horas Totales</span>
            <div class="text-2xl font-black text-spotify">${(totalMs / 3600000).toFixed(1)}h</div>
          </div>
          <div class="p-3.5 rounded-xl bg-black/40 border border-surface-border text-center">
            <span class="text-[10px] text-surface-muted uppercase font-bold block">Reproducciones</span>
            <div class="text-2xl font-black text-white">${totalPlays.toLocaleString()}</div>
          </div>
          <div class="p-3.5 rounded-xl bg-black/40 border border-surface-border text-center">
            <span class="text-[10px] text-surface-muted uppercase font-bold block">Canciones Distintas</span>
            <div class="text-2xl font-black text-cyan-400">${Object.keys(trackMap).length}</div>
          </div>
        </div>

        <!-- Yearly Trend Breakdown (Chart.js Interactive Bar Chart) -->
        <div class="p-4 rounded-xl bg-surface-card border border-surface-border">
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <i class="fa-solid fa-chart-column text-spotify"></i> Horas de escucha año por año
            </h4>
            <span class="text-[10px] text-surface-muted">Historial completo</span>
          </div>
          <div class="h-44 w-full relative">
            <canvas id="inspector-yearly-chart"></canvas>
          </div>
        </div>

        <!-- Top Tracks & Albums -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="p-4 rounded-xl bg-black/40 border border-surface-border">
            <h4 class="text-xs font-bold text-pink-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <i class="fa-solid fa-music"></i> Tus temas favoritos
            </h4>
            <div class="space-y-1.5 text-xs">
              ${topTracks.map(([t, count], i) => `
                <div class="flex items-center justify-between p-2 rounded-lg bg-surface-card border border-surface-border/50">
                  <span class="truncate pr-2"><strong>#${i + 1}</strong> ${escapeHtml(t)}</span>
                  <span class="text-slate-400 font-mono font-bold flex-shrink-0">${count}x</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="p-4 rounded-xl bg-black/40 border border-surface-border">
            <h4 class="text-xs font-bold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <i class="fa-solid fa-compact-disc"></i> Álbumes más escuchados
            </h4>
            <div class="space-y-1.5 text-xs">
              ${topAlbums.map(([alb, count], i) => `
                <div class="flex items-center justify-between p-2 rounded-lg bg-surface-card border border-surface-border/50">
                  <span class="truncate pr-2"><strong>#${i + 1}</strong> ${escapeHtml(alb)}</span>
                  <span class="text-slate-400 font-mono font-bold flex-shrink-0">${count}x</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    this.modal.classList.remove('hidden');
    setTimeout(() => {
      this.modal.classList.remove('opacity-0');
      this.renderYearlyChart(yearData);
    }, 30);
  }

  renderYearlyChart(yearData) {
    if (this.artistChartInstance) {
      this.artistChartInstance.destroy();
      this.artistChartInstance = null;
    }

    const canvas = document.getElementById('inspector-yearly-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    const years = Object.keys(yearData).sort((a, b) => a - b);
    const hours = years.map(y => Number(yearData[y].hours.toFixed(1)));
    const plays = years.map(y => yearData[y].plays);

    const ctx = canvas.getContext('2d');
    this.artistChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: years,
        datasets: [{
          label: 'Horas escuchadas',
          data: hours,
          backgroundColor: hours.map(h => h > 0 ? '#1DB954' : 'rgba(255, 255, 255, 0.05)'),
          hoverBackgroundColor: '#1ed760',
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 45
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#16161a',
            borderColor: '#27272e',
            borderWidth: 1,
            titleColor: '#fff',
            bodyColor: '#1DB954',
            padding: 10,
            callbacks: {
              label: (item) => {
                const yr = item.label;
                const p = yearData[yr]?.plays || 0;
                return `${item.parsed.y} horas (${p} reproducciones)`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 11, weight: 'bold' } }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.06)' },
            ticks: {
              color: '#7e7e8d',
              font: { size: 10 },
              callback: (val) => `${val}h`
            }
          }
        }
      }
    });
  }

  close() {
    if (this.artistChartInstance) {
      this.artistChartInstance.destroy();
      this.artistChartInstance = null;
    }
    this.modal.classList.add('opacity-0');
    setTimeout(() => this.modal.classList.add('hidden'), 250);
  }
}
