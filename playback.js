export function shouldShowTuningStatic(current,nextRow){
  return !current||current.row!==nextRow;
}
