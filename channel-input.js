export function isDirectYouTubeInput(value){
  return /(?:youtube\.com|youtu\.be|^@)/i.test(value.trim());
}

export function stationLabelAfterFetch(station,fetchedName){
  const value=String(station?.value||'').trim();
  const label=String(station?.label||'').trim();
  const resolved=String(fetchedName||'').trim();
  return resolved&&(!label||label===value)?resolved:(label||resolved||value);
}
