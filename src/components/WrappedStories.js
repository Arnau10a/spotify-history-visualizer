/**
 * WrappedStories Component
 * Interactive full-screen Story machine, animations, gestures and PNG export
 */

import { computeTopArtists, computeTopTracks, determinePersonality, computeRecordDay } from '../services/analyticsEngine.js';
import { escapeHtml } from '../services/spotifyParser.js';
import { AcidwaveScene } from './AcidwaveScene.js';

export class WrappedStories {
  constructor({ modalId, onToast }) {
    this.modal = document.getElementById(modalId);
    this.onToast = onToast || console.log;
    this.currentSlide = 0;
    this.totalSlides = 6;
    this.slideDurationMs = 6500;
    this.slideElapsedMs = 0;
    this.progressInterval = null;
    this.isPaused = false;
    this.dataset = [];
    this.rawRecords = [];
    this.acidwaveScene = null;

    this.initDOMElements();
    this.bindEvents();
  }

  initDOMElements() {
    this.yearSelect = document.getElementById('wrapped-year-select');
    this.btnClose = document.getElementById('btn-close-wrapped');
    this.btnPause = document.getElementById('btn-wrapped-pause');
    this.pauseIcon = document.getElementById('wrapped-pause-icon');
    this.tapLeft = document.getElementById('tap-zone-left');
    this.tapMiddle = document.getElementById('tap-zone-middle');
    this.tapRight = document.getElementById('tap-zone-right');
    this.btnExportPng = document.getElementById('btn-export-wrapped-png');
    this.btnReplay = document.getElementById('btn-replay-wrapped');
    this.exportCard = document.getElementById('wrapped-export-card');
  }

  bindEvents() {
    this.btnClose.addEventListener('click', () => this.close());
    this.btnPause.addEventListener('click', () => this.togglePause());
    this.yearSelect.addEventListener('change', (e) => this.computeAndRender(e.target.value));

    this.tapLeft.addEventListener('click', () => this.prevSlide());
    this.tapRight.addEventListener('click', () => this.nextSlide());
    this.tapMiddle.addEventListener('click', () => this.togglePause());

    this.btnReplay.addEventListener('click', () => {
      this.goToSlide(0);
      this.startTimer();
    });

    this.btnExportPng.addEventListener('click', () => this.exportPng());

    window.addEventListener('keydown', (e) => {
      if (this.modal.classList.contains('hidden')) return;
      if (e.key === 'Escape') this.close();
      else if (e.key === 'ArrowRight' || e.key === ' ') this.nextSlide();
      else if (e.key === 'ArrowLeft') this.prevSlide();
    });
  }

  open(records, defaultYear = 'ALL') {
    if (!records || records.length === 0) {
      this.onToast('Carga primero tus datos o la demo para generar tu Wrapped', true);
      return;
    }
    this.rawRecords = records;

    // Populate year select
    const years = Array.from(new Set(records.map(r => r.year))).sort((a, b) => b - a);
    this.yearSelect.innerHTML = '<option value="ALL">Todo el Histórico</option>';
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = `Año ${y}`;
      this.yearSelect.appendChild(opt);
    });

    if (defaultYear !== 'ALL' && years.includes(Number(defaultYear))) {
      this.yearSelect.value = defaultYear;
    } else {
      this.yearSelect.value = years[0] || 'ALL';
    }

    this.computeAndRender(this.yearSelect.value);

    this.modal.classList.remove('hidden');
    setTimeout(() => {
      this.modal.classList.remove('opacity-0');
      // Initialize 3D Acidwave Scene
      if (!this.acidwaveScene) {
        this.acidwaveScene = new AcidwaveScene('acidwave-canvas-container');
      }
      this.acidwaveScene.setTheme(this.currentSlide);
      this.startTimer();
    }, 50);
  }

  close() {
    this.pauseTimer();
    this.modal.classList.add('opacity-0');
    setTimeout(() => {
      this.modal.classList.add('hidden');
      this.resetProgress();
      if (this.acidwaveScene) {
        this.acidwaveScene.destroy();
        this.acidwaveScene = null;
      }
    }, 300);
  }

  computeAndRender(yearVal) {
    this.dataset = this.rawRecords.filter(r => {
      if (yearVal !== 'ALL' && r.year.toString() !== yearVal.toString()) return false;
      return true;
    });

    if (this.dataset.length === 0) {
      this.onToast('No hay datos en el periodo seleccionado para generar el Wrapped.', true);
      return;
    }

    const isGlobal = yearVal === 'ALL';
    document.getElementById('w-card-year-badge').textContent = isGlobal ? 'WRAPPED HISTÓRICO' : `WRAPPED ${yearVal}`;

    // 1. Time
    const totalMs = this.dataset.reduce((sum, r) => sum + r.msPlayed, 0);
    const totalMinutes = Math.round(totalMs / 60000);
    const totalHours = Math.round(totalMs / 3600000);

    document.getElementById('w-total-minutes').textContent = totalMinutes.toLocaleString();
    document.getElementById('w-total-hours').textContent = `Equivale a ≈ ${totalHours.toLocaleString()} horas continuas de música y audio`;

    const hoursInYear = isGlobal ? (Math.max(1, new Set(this.dataset.map(r => r.year)).size) * 8760) : 8760;
    const pctLife = ((totalHours / hoursInYear) * 100).toFixed(1);
    document.getElementById('w-percent-life').textContent = isGlobal
      ? `A lo largo de los años registrados, has dedicado aproximadamente el ${pctLife}% de todo el tiempo a escuchar Spotify.`
      : `En ${yearVal}, pasaste el ${pctLife}% de todos los minutos de tu año con la música encendida.`;

    document.getElementById('w-card-minutes').textContent = totalMinutes.toLocaleString();
    document.getElementById('w-card-tracks-count').textContent = new Set(this.dataset.filter(r => !r.isPodcast).map(r => r.trackName)).size.toLocaleString();

    // 2. Top Artists
    const topArtists = computeTopArtists(this.dataset, 5);
    if (topArtists.length > 0) {
      const top1 = topArtists[0];
      document.getElementById('w-top1-artist-name').textContent = top1.name;
      document.getElementById('w-top1-artist-stats').textContent = `${(top1.ms / 3600000).toFixed(1)} horas • ${top1.plays.toLocaleString()} reproducciones`;

      const top1Pct = totalMs > 0 ? ((top1.ms / totalMs) * 100).toFixed(1) : 0;
      document.getElementById('w-top1-artist-pct').textContent = `Dedicaste el ${top1Pct}% de todo tu tiempo de escucha solo a ${top1.name}. ¡Un fan incondicional!`;

      const artistsListEl = document.getElementById('w-top-artists-list');
      artistsListEl.innerHTML = '';
      topArtists.slice(1).forEach((art, idx) => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0';
        item.innerHTML = `
          <div class="flex items-center gap-2 overflow-hidden">
            <span class="text-indigo-400 font-extrabold w-4 text-center">#${idx + 2}</span>
            <span class="text-white font-semibold truncate">${escapeHtml(art.name)}</span>
          </div>
          <span class="text-indigo-200 text-[11px] font-mono">${(art.ms / 3600000).toFixed(1)}h</span>
        `;
        artistsListEl.appendChild(item);
      });

      const cardArtistsEl = document.getElementById('w-card-artists-list');
      cardArtistsEl.innerHTML = '';
      topArtists.forEach((art, idx) => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between';
        row.innerHTML = `
          <span class="truncate"><strong class="text-spotify">#${idx + 1}</strong> ${escapeHtml(art.name)}</span>
          <span class="text-[10px] text-slate-400 font-mono">${(art.ms / 3600000).toFixed(1)}h</span>
        `;
        cardArtistsEl.appendChild(row);
      });
    }

    // 3. Top Tracks
    const topTracks = computeTopTracks(this.dataset, 5);
    if (topTracks.length > 0) {
      const top1Track = topTracks[0];
      document.getElementById('w-top1-track-name').textContent = top1Track.trackName;
      document.getElementById('w-top1-track-artist').textContent = top1Track.artistName;
      document.getElementById('w-top1-track-stats').textContent = `${top1Track.plays.toLocaleString()} reproducciones • ${(top1Track.ms / 60000).toFixed(0)} minutos`;

      let maxDay = null;
      let maxDayCount = 0;
      for (const [day, count] of Object.entries(top1Track.daysMap || {})) {
        if (count > maxDayCount) {
          maxDayCount = count;
          maxDay = day;
        }
      }

      if (maxDay && maxDayCount > 1) {
        const formattedDate = new Date(maxDay).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
        document.getElementById('w-top1-track-day').textContent = `Tu obsesión: la escuchaste ${maxDayCount} veces en bucle el ${formattedDate}.`;
      } else {
        document.getElementById('w-top1-track-day').textContent = `Tu himno indiscutible con ${top1Track.plays} reproducciones.`;
      }

      const tracksListEl = document.getElementById('w-top-tracks-list');
      tracksListEl.innerHTML = '';
      topTracks.slice(1).forEach((trk, idx) => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0';
        item.innerHTML = `
          <div class="flex items-center gap-2 overflow-hidden">
            <span class="text-pink-400 font-extrabold w-4 text-center">#${idx + 2}</span>
            <div class="truncate">
              <span class="text-white font-semibold block truncate">${escapeHtml(trk.trackName)}</span>
              <span class="text-pink-200/70 text-[10px] block truncate">${escapeHtml(trk.artistName)}</span>
            </div>
          </div>
          <span class="text-pink-200 text-[11px] font-mono flex-shrink-0">${trk.plays}x</span>
        `;
        tracksListEl.appendChild(item);
      });

      const cardTracksEl = document.getElementById('w-card-tracks-list');
      cardTracksEl.innerHTML = '';
      topTracks.forEach((trk, idx) => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between';
        row.innerHTML = `
          <span class="truncate"><strong class="text-pink-400">#${idx + 1}</strong> ${escapeHtml(trk.trackName)} <span class="text-slate-400 text-[10px]">(${escapeHtml(trk.artistName)})</span></span>
          <span class="text-[10px] text-slate-400 font-mono">${trk.plays}x</span>
        `;
        cardTracksEl.appendChild(row);
      });
    }

    // 4. Personality
    const persona = determinePersonality(this.dataset);
    document.getElementById('w-personality-title').textContent = persona.title;
    document.getElementById('w-personality-desc').textContent = persona.desc;
    document.getElementById('w-aura-icon').className = `fa-solid ${persona.icon} text-amber-300`;
    document.getElementById('w-persona-peak-time').textContent = persona.peakPeriodText;
    document.getElementById('w-persona-loyalty').textContent = persona.loyaltyText;
    document.getElementById('w-aura-orb').className = `absolute inset-0 rounded-full bg-gradient-to-tr ${persona.auraGradient} blur-xl opacity-80 animate-pulse-slow`;
    document.getElementById('w-card-aura-text').textContent = `Aura: ${persona.title}`;

    // 5. Record Day
    const recDay = computeRecordDay(this.dataset);
    if (recDay) {
      document.getElementById('w-record-date').textContent = recDay.formatted;
      document.getElementById('w-record-minutes').textContent = `${recDay.minutes.toLocaleString()} min`;
      document.getElementById('w-record-tracks').textContent = recDay.uniqueTracks.toLocaleString();
      document.getElementById('w-record-comment').textContent = `Ese día estuviste ${recDay.hours} horas en Spotify escuchando ${recDay.uniqueTracks} temas distintos. ¡Una auténtica maratón!`;
    }

    this.goToSlide(0);
  }

  goToSlide(idx) {
    if (idx < 0) idx = 0;
    if (idx >= this.totalSlides) idx = this.totalSlides - 1;

    this.currentSlide = idx;
    this.slideElapsedMs = 0;

    const slides = document.querySelectorAll('.wrapped-slide');
    slides.forEach((sl, i) => {
      if (i === this.currentSlide) sl.classList.add('wrapped-slide-active');
      else sl.classList.remove('wrapped-slide-active');
    });

    for (let i = 0; i < this.totalSlides; i++) {
      const bar = document.getElementById(`prog-${i}`);
      if (i < this.currentSlide) bar.style.width = '100%';
      else bar.style.width = '0%';
    }

    // Morph Acidwave 3D palette to match the slide theme
    if (this.acidwaveScene) {
      this.acidwaveScene.setTheme(this.currentSlide);
    }

    if (this.currentSlide === this.totalSlides - 1 && typeof confetti === 'function') {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    }
  }

  nextSlide() {
    if (this.currentSlide < this.totalSlides - 1) this.goToSlide(this.currentSlide + 1);
    else this.pauseTimer();
  }

  prevSlide() {
    if (this.currentSlide > 0) this.goToSlide(this.currentSlide - 1);
  }

  startTimer() {
    clearInterval(this.progressInterval);
    this.isPaused = false;
    this.pauseIcon.className = 'fa-solid fa-pause';

    this.progressInterval = setInterval(() => {
      if (this.isPaused) return;

      this.slideElapsedMs += 100;
      const progressPct = Math.min(100, (this.slideElapsedMs / this.slideDurationMs) * 100);
      const currentBar = document.getElementById(`prog-${this.currentSlide}`);
      if (currentBar) currentBar.style.width = `${progressPct}%`;

      if (this.slideElapsedMs >= this.slideDurationMs) {
        if (this.currentSlide < this.totalSlides - 1) this.nextSlide();
        else clearInterval(this.progressInterval);
      }
    }, 100);
  }

  pauseTimer() {
    this.isPaused = true;
    this.pauseIcon.className = 'fa-solid fa-play';
  }

  resumeTimer() {
    this.isPaused = false;
    this.pauseIcon.className = 'fa-solid fa-pause';
  }

  togglePause() {
    if (this.isPaused) this.resumeTimer();
    else this.pauseTimer();
  }

  resetProgress() {
    clearInterval(this.progressInterval);
    for (let i = 0; i < this.totalSlides; i++) {
      const bar = document.getElementById(`prog-${i}`);
      if (bar) bar.style.width = '0%';
    }
    this.currentSlide = 0;
    this.slideElapsedMs = 0;
  }

  async exportPng() {
    const originalText = this.btnExportPng.innerHTML;
    try {
      this.btnExportPng.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando PNG...';
      this.btnExportPng.disabled = true;

      const canvas = await html2canvas(this.exportCard, {
        backgroundColor: '#0c0c0e',
        scale: 2,
        useCORS: true,
        logging: false
      });

      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const yVal = this.yearSelect.value;
      link.download = `Spotify_Wrapped_${yVal}_DataLab.png`;
      link.href = image;
      link.click();

      this.onToast('¡Tarjeta Wrapped descargada con éxito!');
      if (typeof confetti === 'function') {
        confetti({ particleCount: 50, spread: 70 });
      }
    } catch (err) {
      console.error(err);
      this.onToast('Error al exportar la tarjeta PNG.', true);
    } finally {
      this.btnExportPng.innerHTML = originalText;
      this.btnExportPng.disabled = false;
    }
  }
}
