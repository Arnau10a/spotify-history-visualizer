/**
 * YearComparator Component
 * Head-to-Head statistical showdown between two years
 */

import { computeGlobalKPIs, computeTopArtists } from '../services/analyticsEngine.js';
import { escapeHtml } from '../services/spotifyParser.js';

export class YearComparator {
  constructor(modalId) {
    this.modal = document.getElementById(modalId);
    this.rawRecords = [];
    this.yearASelect = document.getElementById('compare-year-a');
    this.yearBSelect = document.getElementById('compare-year-b');
    this.btnClose = document.getElementById('btn-close-comparator');
    this.resultsContainer = document.getElementById('comparator-results');

    this.bindEvents();
  }

  bindEvents() {
    this.btnClose?.addEventListener('click', () => this.close());
    this.yearASelect?.addEventListener('change', () => this.compare());
    this.yearBSelect?.addEventListener('change', () => this.compare());

    window.addEventListener('keydown', (e) => {
      if (this.modal && !this.modal.classList.contains('hidden') && e.key === 'Escape') {
        this.close();
      }
    });
  }

  open(records) {
    this.rawRecords = records;
    const years = Array.from(new Set(records.map(r => r.year))).sort((a, b) => b - a);

    if (years.length < 2) {
      alert('Necesitas al menos 2 años diferentes en tu historial para comparar.');
      return;
    }

    this.yearASelect.innerHTML = '';
    this.yearBSelect.innerHTML = '';

    years.forEach((y, i) => {
      const optA = document.createElement('option');
      optA.value = y;
      optA.textContent = `Año ${y}`;
      this.yearASelect.appendChild(optA);

      const optB = document.createElement('option');
      optB.value = y;
      optB.textContent = `Año ${y}`;
      this.yearBSelect.appendChild(optB);
    });

    this.yearASelect.value = years[1] || years[0];
    this.yearBSelect.value = years[0];

    this.compare();
    this.modal.classList.remove('hidden');
    setTimeout(() => this.modal.classList.remove('opacity-0'), 20);
  }

  close() {
    this.modal.classList.add('opacity-0');
    setTimeout(() => this.modal.classList.add('hidden'), 250);
  }

  compare() {
    const yA = Number(this.yearASelect.value);
    const yB = Number(this.yearBSelect.value);

    const recsA = this.rawRecords.filter(r => r.year === yA);
    const recsB = this.rawRecords.filter(r => r.year === yB);

    const kpiA = computeGlobalKPIs(recsA);
    const kpiB = computeGlobalKPIs(recsB);

    const artistsA = computeTopArtists(recsA, 10);
    const artistsB = computeTopArtists(recsB, 10);

    const setA = new Set(recsA.map(r => r.artistName));
    const setB = new Set(recsB.map(r => r.artistName));

    // Lost in B (Listened in A, gone in B)
    const lostArtists = artistsA.filter(a => !setB.has(a.name)).slice(0, 5);
    // New discoveries in B (Not in A)
    const newArtists = artistsB.filter(b => !setA.has(b.name)).slice(0, 5);

    const diffHours = kpiB.totalHours - kpiA.totalHours;
    const diffHoursPct = kpiA.totalHours > 0 ? ((diffHours / kpiA.totalHours) * 100).toFixed(1) : 0;

    this.resultsContainer.innerHTML = `
      <!-- Head-to-Head KPI cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="p-4 rounded-2xl bg-surface-card border border-surface-border text-center">
          <span class="text-[11px] uppercase font-bold text-slate-400 block mb-1">Horas Totales</span>
          <div class="flex items-center justify-around mt-2">
            <div>
              <div class="text-xl font-black text-white">${kpiA.totalHours.toLocaleString()}h</div>
              <span class="text-[10px] text-surface-muted">${yA}</span>
            </div>
            <div class="text-xs font-bold ${diffHours >= 0 ? 'text-spotify' : 'text-red-400'}">
              ${diffHours >= 0 ? '+' : ''}${diffHoursPct}%
            </div>
            <div>
              <div class="text-xl font-black text-white">${kpiB.totalHours.toLocaleString()}h</div>
              <span class="text-[10px] text-surface-muted">${yB}</span>
            </div>
          </div>
        </div>

        <div class="p-4 rounded-2xl bg-surface-card border border-surface-border text-center">
          <span class="text-[11px] uppercase font-bold text-slate-400 block mb-1">Variedad de Artistas</span>
          <div class="flex items-center justify-around mt-2">
            <div>
              <div class="text-xl font-black text-white">${kpiA.uniqueArtists.toLocaleString()}</div>
              <span class="text-[10px] text-surface-muted">${yA}</span>
            </div>
            <div class="text-xs text-slate-400 font-bold">&bull; vs &bull;</div>
            <div>
              <div class="text-xl font-black text-white">${kpiB.uniqueArtists.toLocaleString()}</div>
              <span class="text-[10px] text-surface-muted">${yB}</span>
            </div>
          </div>
        </div>

        <div class="p-4 rounded-2xl bg-surface-card border border-surface-border text-center">
          <span class="text-[11px] uppercase font-bold text-slate-400 block mb-1">Ratio de Saltos</span>
          <div class="flex items-center justify-around mt-2">
            <div>
              <div class="text-xl font-black text-white">${kpiA.skipRate}%</div>
              <span class="text-[10px] text-surface-muted">${yA}</span>
            </div>
            <div class="text-xs text-slate-400 font-bold">&bull; vs &bull;</div>
            <div>
              <div class="text-xl font-black text-white">${kpiB.skipRate}%</div>
              <span class="text-[10px] text-surface-muted">${yB}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Top 5 Artists Confrontation -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div class="p-4 rounded-2xl bg-black/40 border border-surface-border">
          <h4 class="text-xs font-bold uppercase tracking-wider text-spotify mb-3 flex items-center gap-2">
            <i class="fa-solid fa-crown"></i> Top Artistas en ${yA}
          </h4>
          <div class="space-y-1.5 text-xs">
            ${artistsA.slice(0, 5).map((a, i) => `
              <div class="flex items-center justify-between p-2 rounded-lg bg-surface-card border border-surface-border/50">
                <span><strong>#${i + 1}</strong> ${escapeHtml(a.name)}</span>
                <span class="text-spotify font-mono font-bold">${(a.ms / 3600000).toFixed(1)}h</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="p-4 rounded-2xl bg-black/40 border border-surface-border">
          <h4 class="text-xs font-bold uppercase tracking-wider text-spotify mb-3 flex items-center gap-2">
            <i class="fa-solid fa-crown"></i> Top Artistas en ${yB}
          </h4>
          <div class="space-y-1.5 text-xs">
            ${artistsB.slice(0, 5).map((b, i) => `
              <div class="flex items-center justify-between p-2 rounded-lg bg-surface-card border border-surface-border/50">
                <span><strong>#${i + 1}</strong> ${escapeHtml(b.name)}</span>
                <span class="text-spotify font-mono font-bold">${(b.ms / 3600000).toFixed(1)}h</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Musical Evolution: Lost vs Discovered -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="p-4 rounded-2xl bg-surface-card border border-amber-500/20">
          <h4 class="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-2">
            <i class="fa-solid fa-ghost"></i> Ídolos que dejaste atrás en ${yB}
          </h4>
          <p class="text-[11px] text-surface-muted mb-3">Top artistas de ${yA} que prácticamente no escuchaste en ${yB}:</p>
          <div class="flex flex-wrap gap-1.5">
            ${lostArtists.length > 0 ? lostArtists.map(a => `
              <span class="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg text-xs font-semibold">
                ${escapeHtml(a.name)}
              </span>
            `).join('') : '<span class="text-xs text-slate-500">Mantuviste fidelidad a tus gustos.</span>'}
          </div>
        </div>

        <div class="p-4 rounded-2xl bg-surface-card border border-emerald-500/20">
          <h4 class="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-2">
            <i class="fa-solid fa-compass"></i> Nuevas obsesiones descubiertas en ${yB}
          </h4>
          <p class="text-[11px] text-surface-muted mb-3">Artistas que irrumpieron con fuerza en ${yB} sin precedentes en ${yA}:</p>
          <div class="flex flex-wrap gap-1.5">
            ${newArtists.length > 0 ? newArtists.map(b => `
              <span class="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-semibold">
                ${escapeHtml(b.name)}
              </span>
            `).join('') : '<span class="text-xs text-slate-500">Sin nuevos artistas destacados.</span>'}
          </div>
        </div>
      </div>
    `;
  }
}
