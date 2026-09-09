export function shouldShowTuningStatic(current,nextRow){
  return !current||current.row!==nextRow;
}


export function reflowScheduleAround(schedule,index,start,duration){
  const current=schedule[index];
  if(!current||!Number.isFinite(start)||!Number.isFinite(duration)||duration<=0)return false;
  current.duration=duration;
  current.start=start;
  current.end=start+duration;
  let cursor=current.start;
  for(let i=index-1;i>=0;i--){
    const program=schedule[i];
    program.end=cursor;
    program.start=cursor-program.duration;
    cursor=program.start;
  }
  cursor=current.end;
  for(let i=index+1;i<schedule.length;i++){
    const program=schedule[i];
    program.start=cursor;
    program.end=cursor+program.duration;
    cursor=program.end;
  }
  return true;
}
