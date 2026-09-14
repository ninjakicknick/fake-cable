import './mobile-hud.js';

// Captions use the same authenticated action/status path as every other remote
// control. Do not wrap third-party constructors or listen to rejected peers.
export function createCaptionController({state,storage,broadcast=()=>{},toast=()=>{},language=()=>navigator.language}){
 const key='fake-cable-captions-enabled';
 state.captionsEnabled=storage.getItem(key)==='1';
 function apply(){
  if(!state.ready||!state.player)return;
  try{
   if(state.captionsEnabled){
    state.player.loadModule?.('captions');
    state.player.setOption?.('captions','track',{languageCode:(language()||'en').split('-')[0]});
   }else{
    state.player.setOption?.('captions','track',{});
    state.player.unloadModule?.('captions');
   }
  }catch{}
 }
 function toggle(){
  state.captionsEnabled=!state.captionsEnabled;
  storage.setItem(key,state.captionsEnabled?'1':'0');
  apply();broadcast();toast(state.captionsEnabled?'CLOSED CAPTIONS ON':'CLOSED CAPTIONS OFF');
 }
 return {apply,toggle};
}
