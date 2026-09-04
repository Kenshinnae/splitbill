/**
 * Runs in <head> before React. Sync-loads /firebase-config.json so Firebase
 * works on Hostinger where SSR/build env and fs paths are unreliable.
 */
export function firebaseConfigBootstrapScript(embeddedJson?: string): string {
  const embedded =
    embeddedJson && embeddedJson !== "{}" && embeddedJson.includes("apiKey")
      ? `window.__FIREBASE_CONFIG__=${embeddedJson};`
      : "";

  return `${embedded}(function(){if(window.__FIREBASE_CONFIG__&&window.__FIREBASE_CONFIG__.apiKey)return;try{var x=new XMLHttpRequest();x.open("GET","/firebase-config.json",false);x.send(null);if(x.status===200){var c=JSON.parse(x.responseText);if(c&&c.apiKey&&c.projectId)window.__FIREBASE_CONFIG__=c;}}catch(e){}})();`;
}
