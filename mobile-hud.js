// Mobile-only playback HUD adjustment. Loaded with the UI modules so it also applies to installed/PWA sessions.
if(typeof document!=='undefined'&&!document.querySelector('link[data-mobile-hud]')){
 const link=document.createElement('link');
 link.rel='stylesheet';
 link.href='/mobile-hud.css?v=1';
 link.dataset.mobileHud='';
 document.head.append(link);
}
