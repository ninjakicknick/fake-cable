export function createTuningStatic({state}){
 function drawStaticFrame(){
  const canvas=document.querySelector('#tuning-static'),ctx=canvas?.getContext('2d');
  if(!ctx)return;
  const width=192,height=108;
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height}
  const age=Date.now()-state.staticStartedAt,lock=Math.min(1,age/650),image=ctx.createImageData(width,height),data=image.data,cyanGlows=[],magentaGlows=[],goldGlows=[];
  const tearStart=Math.random()<.28?Math.floor(Math.random()*height):-20,tearSize=2+Math.floor(Math.random()*7),tearShift=Math.floor((Math.random()-.5)*30);
  for(let y=0;y<height;y++){
   const brightBand=Math.random()<.035?35+Math.random()*75:0,scanline=(y+Math.floor(age/28))%4===0?.7:1;
   for(let x=0;x<width;x++){
    const shifted=x+(y>=tearStart&&y<tearStart+tearSize?tearShift:0),i=(y*width+x)*4,noise=Math.random(),value=(30+noise*210+brightBand)*scanline;
    const spectrum=x/(width-1);
    let r=7+value*(.28+spectrum*.3),g=8+value*(.43-spectrum*.17),b=26+value*.78;
    if(noise>.992-lock*.002){r=55+Math.random()*45;g=185+Math.random()*70;b=190+Math.random()*65;if(Math.random()<.025)cyanGlows.push([x,y])}
    else if(noise>.982-lock*.004){r=190+Math.random()*65;g=35+Math.random()*55;b=205+Math.random()*50;if(Math.random()<.025)magentaGlows.push([x,y])}
    else if(noise<.004-lock*.002){r=210+Math.random()*45;g=155+Math.random()*70;b=55+Math.random()*35;if(Math.random()<.025)goldGlows.push([x,y])}
    const edge=shifted<0||shifted>=width?.35:1;
    data[i]=r*edge;data[i+1]=g*edge;data[i+2]=b*edge;data[i+3]=255;
   }
  }
  ctx.putImageData(image,0,0);
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  ctx.fillStyle='rgba(155,255,255,.9)';ctx.shadowColor='rgba(82,217,219,.95)';ctx.shadowBlur=4;
  cyanGlows.forEach(([x,y])=>ctx.fillRect(x,y,1.5,1.5));
  ctx.fillStyle='rgba(255,139,244,.9)';ctx.shadowColor='rgba(226,45,255,.95)';ctx.shadowBlur=4;
  magentaGlows.forEach(([x,y])=>ctx.fillRect(x,y,1.5,1.5));
  ctx.fillStyle='rgba(255,232,165,.92)';ctx.shadowColor='rgba(242,189,86,.95)';ctx.shadowBlur=4;
  goldGlows.forEach(([x,y])=>ctx.fillRect(x,y,1.5,1.5));
  if(Math.random()<.18){
   const y=Math.floor(Math.random()*height),start=Math.floor(Math.random()*width*.18),length=width*(.55+Math.random()*.45);
   const tear=ctx.createLinearGradient(start,0,start+length,0);tear.addColorStop(0,'rgba(82,217,219,.38)');tear.addColorStop(.48,'rgba(242,189,86,.62)');tear.addColorStop(1,'rgba(226,45,255,.42)');
   ctx.shadowColor='rgba(242,189,86,.95)';ctx.shadowBlur=6;ctx.fillStyle=tear;ctx.fillRect(start,y,length,1.4);
   ctx.shadowBlur=1;ctx.fillStyle='rgba(255,246,207,.88)';ctx.fillRect(start,y+.35,length,Math.max(.35,.65-lock*.2));
  }
  ctx.restore();
  if(canvas.classList.contains('show'))state.staticFrame=requestAnimationFrame(drawStaticFrame);
 }

 function startStaticAudio(){
  if(state.staticAudio)return;
  try{
   const AudioContext=window.AudioContext||window.webkitAudioContext;
   if(!AudioContext)return;
   const context=state.staticAudioContext||(state.staticAudioContext=new AudioContext()),length=context.sampleRate*2;
   const buffer=context.createBuffer(1,length,context.sampleRate),samples=buffer.getChannelData(0);
   for(let i=0;i<length;i++)samples[i]=Math.random()*2-1;
   const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
   source.buffer=buffer;source.loop=true;filter.type='bandpass';filter.frequency.value=1500;filter.Q.value=.45;gain.gain.value=.045;
   source.connect(filter).connect(gain).connect(context.destination);source.start();context.resume?.();
   state.staticAudio={context,source,gain};
  }catch{}
 }

 function stopStaticAudio(){
  const audio=state.staticAudio;
  if(!audio)return;
  try{audio.gain.gain.setTargetAtTime(0,audio.context.currentTime,.025);setTimeout(()=>audio.source.stop(),100)}catch{}
  state.staticAudio=null;
 }

 function showTuningStatic(minimumMs=350){
  const canvas=document.querySelector('#tuning-static');
  if(!canvas)return;
  clearTimeout(state.staticHideTimer);
  state.staticStartedAt=Date.now();
  state.staticMinUntil=Math.max(state.staticMinUntil,Date.now()+minimumMs);
  canvas.classList.add('show');
  cancelAnimationFrame(state.staticFrame);
  drawStaticFrame();
  startStaticAudio();
 }

 function hideTuningStatic(){
  const canvas=document.querySelector('#tuning-static');
  if(!canvas)return;
  clearTimeout(state.staticHideTimer);
  const wait=Math.max(0,state.staticMinUntil-Date.now());
  state.staticHideTimer=setTimeout(()=>{
   canvas.classList.remove('show');
   cancelAnimationFrame(state.staticFrame);
   stopStaticAudio();
  },wait);
 }

 return {showTuningStatic,hideTuningStatic};
}
