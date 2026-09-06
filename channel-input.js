export function isDirectYouTubeInput(value){
  return /(?:youtube\.com|youtu\.be|^@)/i.test(value.trim());
}
