/**
 * Spotify Parser & Sanitizer Service
 * Normalizes Spotify RGPD extended streaming history & standard endsong files
 */

export function sanitizeRecord(r) {
  const dateStr = r.ts || r.endTime;
  const dateObj = dateStr ? new Date(dateStr) : new Date();

  // Platform normalizer
  let platform = (r.platform || 'Desconocido').toLowerCase();
  if (platform.includes('ios') || platform.includes('iphone') || platform.includes('ipad')) platform = 'iOS';
  else if (platform.includes('android')) platform = 'Android';
  else if (platform.includes('osx') || platform.includes('mac') || platform.includes('windows') || platform.includes('desktop')) platform = 'Desktop';
  else if (platform.includes('web') || platform.includes('browser')) platform = 'Web Player';
  else if (platform.includes('cast') || platform.includes('speaker') || platform.includes('tv')) platform = 'Smart Speakers / TV';
  else platform = 'Otros';

  // Metadata naming
  const trackName = r.master_metadata_track_name || r.trackName || (r.episode_name ? `[Pod] ${r.episode_name}` : 'Pista Desconocida');
  const artistName = r.master_metadata_album_artist_name || r.artistName || (r.episode_show_name ? r.episode_show_name : 'Artista Desconocido');
  const albumName = r.master_metadata_album_album_name || 'Álbum Desconocido';
  const msPlayed = Number(r.ms_played || r.msPlayed || 0);

  // Skips detection
  const isSkipped = r.skipped === true || r.reason_end === 'fwdbtn' || msPlayed < 30000;
  const isPodcast = !!(r.episode_name || r.episode_show_name || r.spotify_episode_uri);

  return {
    ts: dateObj,
    year: dateObj.getFullYear(),
    monthKey: `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`,
    hour: dateObj.getHours(),
    weekday: dateObj.getDay(),
    msPlayed: msPlayed,
    trackName: trackName,
    artistName: artistName,
    albumName: albumName,
    platform: platform,
    reasonStart: r.reason_start || 'desconocido',
    reasonEnd: r.reason_end || 'desconocido',
    shuffle: r.shuffle === true,
    skipped: isSkipped,
    offline: r.offline === true,
    isPodcast: isPodcast,
    country: r.conn_country || 'Desconocido'
  };
}

export function sanitizeRecords(records) {
  return records
    .map(sanitizeRecord)
    .filter(r => !isNaN(r.ts.getTime()) && r.msPlayed > 0);
}

export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
