/**
 * Analytics Engine Service
 * Mathematical calculations, rankings, aura personality, and record days
 */

export function computeGlobalKPIs(records) {
  const totalMs = records.reduce((acc, r) => acc + r.msPlayed, 0);
  const totalHours = Math.round(totalMs / 3600000);
  const totalStreams = records.length;
  const uniqueArtists = new Set(records.filter(r => !r.isPodcast && r.artistName).map(r => r.artistName)).size;
  const uniqueTracks = new Set(records.filter(r => !r.isPodcast && r.trackName).map(r => r.trackName)).size;

  const totalSkips = records.filter(r => r.skipped).length;
  const skipRate = totalStreams > 0 ? Math.round((totalSkips / totalStreams) * 100) : 0;

  // Peak Hour and Day
  const hourMap = new Array(24).fill(0);
  const dayMap = new Array(7).fill(0);
  records.forEach(r => {
    hourMap[r.hour] += r.msPlayed;
    dayMap[r.weekday] += r.msPlayed;
  });

  let peakHour = 0;
  let maxHourMs = 0;
  hourMap.forEach((ms, h) => {
    if (ms > maxHourMs) {
      maxHourMs = ms;
      peakHour = h;
    }
  });

  let peakDay = 0;
  let maxDayMs = 0;
  dayMap.forEach((ms, d) => {
    if (ms > maxDayMs) {
      maxDayMs = ms;
      peakDay = d;
    }
  });

  return {
    totalMs,
    totalHours,
    totalStreams,
    uniqueArtists,
    uniqueTracks,
    skipRate,
    peakHour,
    peakDay,
    daysEquivalent: (totalHours / 24).toFixed(1),
    avgDurationMinutes: totalStreams > 0 ? ((totalMs / totalStreams) / 60000).toFixed(1) : 0
  };
}

export function computeTopArtists(records, limit = 10) {
  const artistMap = {};
  records.filter(r => !r.isPodcast && r.artistName).forEach(r => {
    if (!artistMap[r.artistName]) {
      artistMap[r.artistName] = { name: r.artistName, ms: 0, plays: 0 };
    }
    artistMap[r.artistName].ms += r.msPlayed;
    artistMap[r.artistName].plays += 1;
  });

  return Object.values(artistMap).sort((a, b) => b.ms - a.ms).slice(0, limit);
}

export function computeTopTracks(records, limit = 10) {
  const trackMap = {};
  const trackDaysMap = {};

  records.filter(r => !r.isPodcast && r.trackName).forEach(r => {
    const key = `${r.trackName} - ${r.artistName}`;
    if (!trackMap[key]) {
      trackMap[key] = {
        trackName: r.trackName,
        artistName: r.artistName,
        ms: 0,
        plays: 0,
        skips: 0
      };
      trackDaysMap[key] = {};
    }
    trackMap[key].ms += r.msPlayed;
    trackMap[key].plays += 1;
    if (r.skipped) trackMap[key].skips += 1;

    const dayKey = r.ts.toISOString().split('T')[0];
    trackDaysMap[key][dayKey] = (trackDaysMap[key][dayKey] || 0) + 1;
  });

  const list = Object.values(trackMap).map(trk => {
    const key = `${trk.trackName} - ${trk.artistName}`;
    return {
      ...trk,
      skipRate: trk.plays > 0 ? Math.round((trk.skips / trk.plays) * 100) : 0,
      daysMap: trackDaysMap[key] || {}
    };
  });

  return list.sort((a, b) => b.ms - a.ms).slice(0, limit);
}

export function determinePersonality(records) {
  const hoursMap = new Array(24).fill(0);
  let skipCount = 0;
  let shuffleCount = 0;
  const totalEvents = records.length;

  records.forEach(r => {
    hoursMap[r.hour] += r.msPlayed;
    if (r.skipped) skipCount++;
    if (r.shuffle) shuffleCount++;
  });

  let nightMs = 0, morningMs = 0, afternoonMs = 0, eveningMs = 0;
  for (let h = 0; h < 24; h++) {
    const ms = hoursMap[h];
    if (h < 6) nightMs += ms;
    else if (h < 12) morningMs += ms;
    else if (h < 19) afternoonMs += ms;
    else eveningMs += ms;
  }

  const skipRate = totalEvents > 0 ? (skipCount / totalEvents) : 0;
  const shuffleRate = totalEvents > 0 ? (shuffleCount / totalEvents) : 0;

  let title = "El Melómano Equilibrado";
  let desc = "Tu relación con la música es constante y armoniosa a lo largo del día.";
  let icon = "fa-headphones";
  let auraGradient = "from-amber-500 via-pink-500 to-purple-600";
  let peakPeriodText = "Tardes";

  const maxPeriod = Math.max(nightMs, morningMs, afternoonMs, eveningMs);
  if (maxPeriod === nightMs) {
    title = "El Búho Noctámbulo";
    desc = "La noche es tu santuario musical. Es de madrugada cuando tu mente se conecta mejor con las mejores canciones.";
    icon = "fa-moon";
    auraGradient = "from-indigo-600 via-purple-600 to-pink-500";
    peakPeriodText = "Madrugada (00h - 06h)";
  } else if (maxPeriod === morningMs) {
    title = "El Madrugador Energético";
    desc = "Empiezas el día con el volumen a tope. La música es tu café de cada mañana.";
    icon = "fa-sun";
    auraGradient = "from-yellow-400 via-amber-500 to-orange-500";
    peakPeriodText = "Mañanas (06h - 12h)";
  } else if (maxPeriod === afternoonMs) {
    title = "El Explorador de Tarde";
    desc = "Tus tardes son una sesión continua de concentración, viajes o desconexión sonora.";
    icon = "fa-cloud-sun";
    auraGradient = "from-emerald-400 via-teal-500 to-cyan-500";
    peakPeriodText = "Tardes (12h - 19h)";
  } else {
    title = "El Alma de la Noche";
    desc = "Terminar la jornada con buena música es tu ritual innegociable.";
    icon = "fa-fire";
    auraGradient = "from-rose-500 via-purple-500 to-indigo-600";
    peakPeriodText = "Noches (19h - 00h)";
  }

  if (skipRate > 0.4) {
    title += " (Impulsivo)";
    desc += " Además, tienes el dedo inquieto: si una canción no te atrapa de inmediato, saltas a la siguiente.";
  } else if (skipRate < 0.15) {
    title += " (Devoto)";
    desc += " Escuchas cada pieza con paciencia de principio a fin, apreciando toda la obra.";
  }

  return {
    title,
    desc,
    icon,
    auraGradient,
    peakPeriodText,
    loyaltyText: shuffleRate > 0.5 ? 'Shuffle lover' : 'Fiel al álbum'
  };
}

export function computeRecordDay(records) {
  const days = {};
  const dayTracks = {};

  records.forEach(r => {
    const dStr = r.ts.toISOString().split('T')[0];
    days[dStr] = (days[dStr] || 0) + r.msPlayed;
    if (!dayTracks[dStr]) dayTracks[dStr] = new Set();
    dayTracks[dStr].add(r.trackName);
  });

  let bestDay = null;
  let maxMs = 0;

  for (const [day, ms] of Object.entries(days)) {
    if (ms > maxMs) {
      maxMs = ms;
      bestDay = day;
    }
  }

  if (!bestDay) return null;

  const dObj = new Date(bestDay);
  return {
    dateObj: dObj,
    formatted: dObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    minutes: Math.round(maxMs / 60000),
    hours: (maxMs / 3600000).toFixed(1),
    uniqueTracks: dayTracks[bestDay] ? dayTracks[bestDay].size : 0
  };
}
