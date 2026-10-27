/**
 * ActivityHeatmap Component
 * Renders an exact GitHub-style 53-week acoustic intensity calendar matrix + streak detector
 * with accurate Monday-aligned columns, month labels, day-of-week labels, and rich tooltips.
 */

import { escapeHtml } from '../services/spotifyParser.js';

export class ActivityHeatmap {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.tooltipEl = null;
    this.initTooltip();
  }

  initTooltip() {
    let tip = document.getElementById('heatmap-floating-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'heatmap-floating-tooltip';
      tip.className = 'fixed z-50 pointer-events-none px-3 py-2 rounded-xl bg-black/95 text-white border border-surface-border shadow-2xl text-xs transition-opacity duration-150 opacity-0';
      tip.style.transform = 'translate(-50%, -115%)';
      document.body.appendChild(tip);
    }
    this.tooltipEl = tip;
  }

  render(records, targetYear) {
    if (!this.container) return;
    this.container.innerHTML = '';

    // Determine target year
    const availableYears = Array.from(new Set(records.map(r => r.year))).sort((a, b) => b - a);
    let year = targetYear === 'ALL' ? availableYears[0] : Number(targetYear);
    if (!year || isNaN(year)) {
      year = availableYears[0] || new Date().getFullYear();
    }

    // Map daily minutes, stream count & top tracks using consistent UTC date keys
    const dayData = {};
    records.filter(r => r.year === year).forEach(r => {
      const dStr = r.ts.toISOString().split('T')[0];
      if (!dayData[dStr]) {
        dayData[dStr] = { ms: 0, count: 0, topTrack: '', topArtist: '', tracks: {} };
      }
      dayData[dStr].ms += r.msPlayed;
      dayData[dStr].count += 1;

      const trackKey = `${r.trackName} — ${r.artistName}`;
      dayData[dStr].tracks[trackKey] = (dayData[dStr].tracks[trackKey] || 0) + 1;
    });

    // Calculate max minutes for quantile/log-friendly color scaling
    let maxMs = 1;
    let totalMinutesYear = 0;
    Object.values(dayData).forEach(d => {
      if (d.ms > maxMs) maxMs = d.ms;
      totalMinutesYear += Math.round(d.ms / 60000);

      let bestKey = '';
      let bestCnt = 0;
      for (const [k, c] of Object.entries(d.tracks)) {
        if (c > bestCnt) {
          bestCnt = c;
          bestKey = k;
        }
      }
      const parts = bestKey.split(' — ');
      d.topTrack = parts[0] || '';
      d.topArtist = parts[1] || '';
    });

    // Accurate streaks & stats calculation
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31));
    let currentStreak = 0;
    let maxStreak = 0;
    let totalActiveDays = 0;

    for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
      const k = d.toISOString().split('T')[0];
      if (dayData[k] && dayData[k].ms >= 30000) { // at least 30s
        currentStreak++;
        totalActiveDays++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }

    // 1. Header with Streaks info & Year selector
    const headerEl = document.createElement('div');
    headerEl.className = 'flex flex-wrap items-center justify-between gap-4 mb-5';
    headerEl.innerHTML = `
      <div>
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-spotify/20 border border-spotify/40 flex items-center justify-center text-spotify text-sm">
            <i class="fa-solid fa-calendar-days"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              Calendario de Actividad Acústica
              <span class="text-xs font-black px-2 py-0.5 rounded-full bg-spotify/20 text-spotify border border-spotify/30">${year}</span>
            </h3>
            <p class="text-xs text-surface-muted">Distribución de 365 días al estilo GitHub: constancia e intensidad sonora</p>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2.5 text-xs">
        <div class="px-3 py-1.5 bg-black/40 rounded-xl border border-surface-border text-slate-300 flex items-center gap-1.5">
          <i class="fa-solid fa-clock text-spotify"></i>
          <span>Total: <strong class="text-white font-extrabold">${(totalMinutesYear / 60).toFixed(0)}h</strong></span>
        </div>
        <div class="px-3 py-1.5 bg-black/40 rounded-xl border border-surface-border text-slate-300 flex items-center gap-1.5">
          <i class="fa-solid fa-headphones text-cyan-400"></i>
          <span><strong class="text-white font-extrabold">${totalActiveDays}</strong> / 365 días</span>
        </div>
        <div class="px-3 py-1.5 bg-black/40 rounded-xl border border-amber-500/30 text-amber-300 flex items-center gap-1.5">
          <i class="fa-solid fa-fire text-amber-400"></i>
          <span>Racha récord: <strong class="text-white font-extrabold">${maxStreak} días</strong></span>
        </div>
      </div>
    `;
    this.container.appendChild(headerEl);

    // 2. Calendar Grid Construction (Aligned Mon -> Sun)
    // In UTC: 0=Sun, 1=Mon, ..., 6=Sat
    // We want Monday as index 0: (d.getUTCDay() + 6) % 7
    const firstDayOfWeek = (startDate.getUTCDay() + 6) % 7;
    const gridStartDate = new Date(startDate);
    gridStartDate.setUTCDate(gridStartDate.getUTCDate() - firstDayOfWeek);

    const lastDayOfWeek = (endDate.getUTCDay() + 6) % 7;
    const gridEndDate = new Date(endDate);
    gridEndDate.setUTCDate(gridEndDate.getUTCDate() + (6 - lastDayOfWeek));

    // Outer scrollable container
    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'overflow-x-auto pb-2 scrollbar-thin';

    const calendarContainer = document.createElement('div');
    calendarContainer.className = 'inline-block min-w-full p-4 rounded-2xl bg-black/50 border border-surface-border';

    // Month labels row (aligned to weeks)
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthHeaderRow = document.createElement('div');
    monthHeaderRow.className = 'flex text-[11px] font-bold text-surface-muted mb-2 select-none';
    
    // Day label spacer (w-8 to match Mon/Wed/Fri labels)
    const spacer = document.createElement('div');
    spacer.className = 'w-8 flex-shrink-0';
    monthHeaderRow.appendChild(spacer);

    // Calculate month label offsets
    const monthsContainer = document.createElement('div');
    monthsContainer.className = 'relative flex-1 h-4';

    let curMonth = -1;
    let weekCounter = 0;
    for (let d = new Date(gridStartDate); d <= gridEndDate; d.setUTCDate(d.getUTCDate() + 7)) {
      const m = d.getUTCMonth();
      if (m !== curMonth && d.getUTCFullYear() === year) {
        curMonth = m;
        const label = document.createElement('span');
        label.className = 'absolute text-[11px] font-bold text-slate-400';
        label.style.left = `${weekCounter * 14}px`;
        label.textContent = monthNames[m];
        monthsContainer.appendChild(label);
      }
      weekCounter++;
    }
    monthHeaderRow.appendChild(monthsContainer);
    calendarContainer.appendChild(monthHeaderRow);

    // Calendar main body: Day labels on left + 7xN grid
    const bodyRow = document.createElement('div');
    bodyRow.className = 'flex gap-2';

    // Day labels (Mon, Wed, Fri)
    const dayLabelsCol = document.createElement('div');
    dayLabelsCol.className = 'w-8 flex flex-col justify-between py-0.5 text-[9px] font-bold text-surface-muted select-none flex-shrink-0';
    dayLabelsCol.style.height = '94px'; // 7 rows * 11px + 6 gaps * 3px = 95px
    dayLabelsCol.innerHTML = `
      <span>Lun</span>
      <span>Mié</span>
      <span>Vie</span>
    `;
    bodyRow.appendChild(dayLabelsCol);

    // 7 rows x 53 columns CSS grid
    const grid = document.createElement('div');
    grid.className = 'grid grid-rows-7 grid-flow-col gap-[3px]';

    for (let d = new Date(gridStartDate); d <= gridEndDate; d.setUTCDate(d.getUTCDate() + 1)) {
      const k = d.toISOString().split('T')[0];
      const isCurrentYear = d.getUTCFullYear() === year;
      const entry = dayData[k];
      const minutes = entry ? Math.round(entry.ms / 60000) : 0;
      const streamCount = entry ? entry.count : 0;

      const cell = document.createElement('div');
      cell.className = 'w-[11px] h-[11px] rounded-[2px] transition-all duration-100 cursor-pointer relative';

      if (!isCurrentYear) {
        // Outside target year: transparent or dim placeholder
        cell.className += ' bg-white/[0.02] border border-transparent pointer-events-none opacity-20';
      } else if (minutes === 0) {
        cell.className += ' bg-[#16161b] hover:border-slate-500 border border-transparent';
      } else {
        const ratio = entry.ms / maxMs;
        let colorClass = '';
        if (ratio < 0.15) {
          colorClass = 'bg-[#0e4429] border border-[#006d32]/40 hover:border-emerald-400';
        } else if (ratio < 0.40) {
          colorClass = 'bg-[#006d32] border border-[#26a641]/50 hover:border-emerald-300';
        } else if (ratio < 0.70) {
          colorClass = 'bg-[#26a641] border border-[#39d353]/60 hover:scale-125 shadow-sm shadow-emerald-500/20';
        } else {
          colorClass = 'bg-spotify border border-emerald-300 hover:scale-150 shadow-md shadow-spotify/50 z-10';
        }
        cell.className += ` ${colorClass}`;
      }

      if (isCurrentYear) {
        const formattedDate = d.toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC'
        });

        // Hover tooltip events
        cell.addEventListener('mouseenter', (e) => {
          if (!this.tooltipEl) return;
          this.tooltipEl.innerHTML = `
            <div class="space-y-1">
              <div class="text-[10px] text-surface-muted capitalize">${formattedDate}</div>
              <div class="text-xs font-extrabold text-white flex items-center gap-2">
                <span class="w-2 h-2 rounded-full ${minutes > 0 ? 'bg-spotify' : 'bg-slate-600'}"></span>
                <span>${minutes > 0 ? `${minutes} minutos (${streamCount} reproducciones)` : 'Sin actividad acústica'}</span>
              </div>
              ${entry?.topTrack ? `
                <div class="pt-1 border-t border-white/10 text-[11px] text-emerald-300 flex items-center gap-1.5">
                  <i class="fa-solid fa-star text-[9px] text-yellow-400"></i>
                  <span class="truncate max-w-[200px]">${escapeHtml(entry.topTrack)} &bull; ${escapeHtml(entry.topArtist)}</span>
                </div>
              ` : ''}
            </div>
          `;
          const rect = cell.getBoundingClientRect();
          this.tooltipEl.style.left = `${rect.left + rect.width / 2}px`;
          this.tooltipEl.style.top = `${rect.top}px`;
          this.tooltipEl.classList.remove('opacity-0');
        });

        cell.addEventListener('mouseleave', () => {
          if (this.tooltipEl) this.tooltipEl.classList.add('opacity-0');
        });
      }

      grid.appendChild(cell);
    }

    bodyRow.appendChild(grid);
    calendarContainer.appendChild(bodyRow);
    scrollWrapper.appendChild(calendarContainer);
    this.container.appendChild(scrollWrapper);

    // 3. Footer Legend
    const legend = document.createElement('div');
    legend.className = 'flex flex-wrap items-center justify-between gap-3 text-[11px] text-surface-muted mt-3 px-1';
    legend.innerHTML = `
      <div class="flex items-center gap-2">
        <i class="fa-solid fa-circle-info text-spotify text-xs"></i>
        <span>Pasa el cursor por cada casilla para ver el desglose diario y tema estrella</span>
      </div>
      <div class="flex items-center gap-1.5 font-medium">
        <span>Menos</span>
        <div class="w-2.5 h-2.5 rounded-[2px] bg-[#16161b] border border-surface-border"></div>
        <div class="w-2.5 h-2.5 rounded-[2px] bg-[#0e4429]"></div>
        <div class="w-2.5 h-2.5 rounded-[2px] bg-[#006d32]"></div>
        <div class="w-2.5 h-2.5 rounded-[2px] bg-[#26a641]"></div>
        <div class="w-2.5 h-2.5 rounded-[2px] bg-spotify"></div>
        <span>Más</span>
      </div>
    `;
    this.container.appendChild(legend);
  }
}
