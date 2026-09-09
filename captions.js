(()=>{
  const STORAGE_KEY='fake-cable-captions-enabled';
  let enabled=localStorage.getItem(STORAGE_KEY)==='1';
  let player=null;
  let captionsReady=false;
  const tvConnections=new Set();

  const preferredLanguage=()=>((navigator.language||'en').split('-')[0]||'en');

  function syncButtons(){
    document.querySelectorAll('[data-phone-action="captions"]').forEach(button=>{
      button.textContent=enabled?'CC ON':'CC OFF';
      button.setAttribute('aria-pressed',enabled?'true':'false');
    });
  }

  function broadcastStatus(){
    for(const connection of tvConnections){
      if(connection?.open)connection.send({type:'captions-status',enabled});
    }
  }

  function turnCaptionsOff(){
    if(!player)return;
    try{player.setOption?.('captions','track',{});}catch{}
    try{player.unloadModule?.('captions');}catch{}
    captionsReady=false;
  }

  function turnCaptionsOn(){
    if(!player)return;
    try{player.loadModule?.('captions');}catch{}
    if(captionsReady){
      try{player.setOption?.('captions','track',{languageCode:preferredLanguage()});}catch{}
    }
  }

  function applyCaptions(){
    if(enabled)turnCaptionsOn();
    else turnCaptionsOff();
    syncButtons();
  }

  function setCaptions(on,{announce=true}={}){
    enabled=!!on;
    localStorage.setItem(STORAGE_KEY,enabled?'1':'0');
    applyCaptions();
    broadcastStatus();
    if(announce){
      const toast=document.querySelector('#toast');
      if(toast){
        toast.textContent=enabled?'CLOSED CAPTIONS ON':'CLOSED CAPTIONS OFF';
        toast.classList.add('show');
        setTimeout(()=>toast.classList.remove('show'),1500);
      }
    }
  }

  function toggleCaptions(){setCaptions(!enabled)}

  function wrapYouTubePlayer(){
    if(!window.YT?.Player||window.YT.Player.__fakeCableCaptionsWrapped)return;
    const OriginalPlayer=window.YT.Player;
    function WrappedPlayer(element,options={}){
      const originalEvents=options.events||{};
      const events={...originalEvents};
      events.onReady=event=>{
        player=event.target;
        captionsReady=false;
        const result=originalEvents.onReady?.(event);
        setTimeout(applyCaptions,100);
        return result;
      };
      events.onApiChange=event=>{
        player=event.target;
        let optionsAvailable=[];
        try{optionsAvailable=player.getOptions?.('captions')||[];}catch{}
        captionsReady=Array.isArray(optionsAvailable);
        if(enabled){
          try{player.setOption?.('captions','track',{languageCode:preferredLanguage()});}catch{}
        }else{
          turnCaptionsOff();
        }
        originalEvents.onApiChange?.(event);
      };
      events.onStateChange=event=>{
        player=event.target;
        const result=originalEvents.onStateChange?.(event);
        if(event.data===1||event.data===5){
          captionsReady=false;
          setTimeout(applyCaptions,100);
        }
        return result;
      };
      const instance=new OriginalPlayer(element,{...options,events});
      player=instance;
      return instance;
    }
    Object.setPrototypeOf(WrappedPlayer,OriginalPlayer);
    WrappedPlayer.prototype=OriginalPlayer.prototype;
    WrappedPlayer.__fakeCableCaptionsWrapped=true;
    window.YT.Player=WrappedPlayer;
  }

  let readyCallback;
  try{
    Object.defineProperty(window,'onYouTubeIframeAPIReady',{
      configurable:true,
      get(){return readyCallback},
      set(callback){
        readyCallback=()=>{
          wrapYouTubePlayer();
          return callback?.();
        };
      }
    });
  }catch{}

  if(window.Peer?.prototype){
    const originalOn=window.Peer.prototype.on;
    window.Peer.prototype.on=function(event,callback){
      if(event==='connection'&&typeof callback==='function'){
        return originalOn.call(this,event,connection=>{
          tvConnections.add(connection);
          connection.on?.('open',()=>connection.send?.({type:'captions-status',enabled}));
          connection.on?.('close',()=>tvConnections.delete(connection));
          connection.on?.('data',data=>{
            if(data?.type==='action'&&data.action==='captions')toggleCaptions();
          });
          callback(connection);
          if(connection.open)connection.send?.({type:'captions-status',enabled});
        });
      }
      return originalOn.call(this,event,callback);
    };

    const originalConnect=window.Peer.prototype.connect;
    window.Peer.prototype.connect=function(...args){
      const connection=originalConnect.apply(this,args);
      connection.on?.('data',data=>{
        if(data?.type==='captions-status'){
          enabled=!!data.enabled;
          syncButtons();
        }
      });
      return connection;
    };
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncButtons,{once:true});
  else syncButtons();
})();
