/* 本站离线适配；保留上游数据与署名。 */
G.LoginUI.open = function(){ G.UI.chrome(false);G.UI.show('scr-login');document.getElementById('btn-guest').textContent='Play / continue locally';document.getElementById('login-mode').textContent='Solo play. Progress saves in this browser when storage is available. No cloud account.';document.getElementById('btn-guest').focus(); };
addEventListener('pagehide',()=>{if(G.DB.guest)G.DB.commit();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&G.DB.guest)G.DB.commit();});
setInterval(()=>{if(G.DB.guest&&!G.DB.storageOk)G.UI.toast('Browser storage is unavailable. Progress cannot be saved.',5000);},30000);
