/**
 * ChartsManager Component
 * Handles Chart.js lifecycle, creation, responsive resizing and clean destruction
 */

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export class ChartsManager {
  constructor() {
    this.charts = {
      timeline: null,
      platforms: null,
      topArtists: null,
      hourly: null,
      weekday: null,
      reasonStart: null,
      reasonEnd: null
    };
  }

  destroyChart(key) {
    if (this.charts[key]) {
      this.charts[key].destroy();
      this.charts[key] = null;
    }
  }

  destroyAll() {
    Object.keys(this.charts).forEach(key => this.destroyChart(key));
  }

  renderTimeline(canvasId, records) {
    this.destroyChart('timeline');
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    // Group by monthKey
    const monthMap = {};
    records.forEach(r => {
      monthMap[r.monthKey] = (monthMap[r.monthKey] || 0) + (r.msPlayed / 3600000);
    });

    const labels = Object.keys(monthMap).sort();
    const data = labels.map(k => Number(monthMap[k].toFixed(1)));

    this.charts.timeline = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Horas Escuchadas',
          data: data,
          borderColor: '#1DB954',
          backgroundColor: 'rgba(29, 185, 84, 0.15)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: labels.length > 36 ? 0 : 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#1DB954'
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
              label: (item) => `${item.parsed.y} horas`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#7e7e8d', maxTicksLimit: 12, font: { size: 10 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#7e7e8d', font: { size: 10 } },
            beginAtZero: true
          }
        }
      }
    });
  }

  renderPlatforms(canvasId, records) {
    this.destroyChart('platforms');
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const platMap = {};
    records.forEach(r => {
      platMap[r.platform] = (platMap[r.platform] || 0) + (r.msPlayed / 3600000);
    });

    const labels = Object.keys(platMap);
    const data = labels.map(k => Number(platMap[k].toFixed(1)));

    const colors = ['#1DB954', '#3b82f6', '#a855f7', '#ec4899', '#eab308', '#64748b'];

    this.charts.platforms = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors.slice(0, labels.length),
          borderColor: '#16161a',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 12 }
          },
          tooltip: {
            backgroundColor: '#16161a',
            borderColor: '#27272e',
            borderWidth: 1,
            callbacks: {
              label: (item) => ` ${item.label}: ${item.parsed} horas`
            }
          }
        },
        cutout: '68%'
      }
    });
  }

  renderTopArtists(canvasId, topArtists, metric = 'hours') {
    this.destroyChart('topArtists');
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const labels = topArtists.map(a => a.name);
    const data = topArtists.map(a => metric === 'hours' ? Number((a.ms / 3600000).toFixed(1)) : a.plays);

    this.charts.topArtists = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: '#1DB954',
          borderRadius: 6,
          hoverBackgroundColor: '#1ed760'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#16161a',
            borderColor: '#27272e',
            borderWidth: 1,
            callbacks: {
              label: (item) => metric === 'hours' ? `${item.parsed.x} horas` : `${item.parsed.x} reproducciones`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#7e7e8d', font: { size: 10 } }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#f3f4f6', font: { size: 11, weight: 'bold' } }
          }
        }
      }
    });
  }

  renderHourly(canvasId, records) {
    this.destroyChart('hourly');
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const hourMap = new Array(24).fill(0);
    records.forEach(r => {
      hourMap[r.hour] += (r.msPlayed / 3600000);
    });

    const labels = hourMap.map((_, h) => `${String(h).padStart(2, '0')}:00`);
    const data = hourMap.map(v => Number(v.toFixed(1)));

    this.charts.hourly = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: '#38bdf8',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#7e7e8d', maxTicksLimit: 12, font: { size: 9 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#7e7e8d', font: { size: 10 } }
          }
        }
      }
    });
  }

  renderWeekday(canvasId, records) {
    this.destroyChart('weekday');
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const dayMap = new Array(7).fill(0);
    records.forEach(r => {
      dayMap[r.weekday] += (r.msPlayed / 3600000);
    });

    const labels = DAY_NAMES;
    const data = dayMap.map(v => Number(v.toFixed(1)));

    this.charts.weekday = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: '#a855f7',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#7e7e8d', font: { size: 10 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#7e7e8d', font: { size: 9 } }
          }
        }
      }
    });
  }

  renderReasonStart(canvasId, records) {
    this.destroyChart('reasonStart');
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const reasons = {};
    records.forEach(r => {
      reasons[r.reasonStart] = (reasons[r.reasonStart] || 0) + 1;
    });

    const labels = Object.keys(reasons);
    const data = labels.map(k => reasons[k]);

    this.charts.reasonStart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: ['#10b981', '#06b6d4', '#6366f1', '#ec4899', '#64748b'],
          borderColor: '#16161a',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 9 } } }
        }
      }
    });
  }

  renderReasonEnd(canvasId, records) {
    this.destroyChart('reasonEnd');
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const reasons = {};
    records.forEach(r => {
      reasons[r.reasonEnd] = (reasons[r.reasonEnd] || 0) + 1;
    });

    const labels = Object.keys(reasons);
    const data = labels.map(k => reasons[k]);

    this.charts.reasonEnd = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: ['#f43f5e', '#f97316', '#eab308', '#8b5cf6', '#64748b'],
          borderColor: '#16161a',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 9 } } }
        }
      }
    });
  }
}
