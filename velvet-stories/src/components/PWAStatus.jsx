import { Download, RefreshCw, Share, WifiOff, X } from "lucide-react";
import { usePWA } from "../context/PWAContext";
import "../styles/pwa-status.css";

function PWAStatus() {
  const pwa = usePWA();
  const showInstall = pwa.canInstall && !pwa.installed && !pwa.installDismissed;

  return <>
    {!pwa.online && (
      <div className="network-pill" role="status"><WifiOff size={15}/>Offline mode</div>
    )}

    {pwa.needRefresh && (
      <aside className="pwa-toast" role="status">
        <span className="pwa-toast__icon"><RefreshCw size={19}/></span>
        <div><strong>Velvet has an update</strong><small>Install it without losing your place.</small></div>
        <button className="pwa-toast__primary" onClick={pwa.updateApp}>Update</button>
        <button className="pwa-toast__close" onClick={pwa.dismissRefresh} aria-label="Dismiss"><X size={17}/></button>
      </aside>
    )}

    {!pwa.needRefresh && pwa.offlineReady && !showInstall && (
      <aside className="pwa-toast" role="status">
        <span className="pwa-toast__icon">✦</span>
        <div><strong>Velvet is ready</strong><small>The interface can now open without a connection.</small></div>
        <button className="pwa-toast__primary" onClick={pwa.dismissOfflineReady}>Lovely</button>
        <button className="pwa-toast__close" onClick={pwa.dismissOfflineReady} aria-label="Dismiss"><X size={17}/></button>
      </aside>
    )}

    {!pwa.needRefresh && showInstall && (
      <aside className="pwa-toast pwa-toast--install">
        <span className="pwa-toast__icon"><Download size={19}/></span>
        <div><strong>Install Velvet Stories</strong><small>Open it from your home screen like an app.</small></div>
        <button className="pwa-toast__primary" onClick={pwa.installApp}>Install</button>
        <button className="pwa-toast__close" onClick={pwa.dismissInstall} aria-label="Not now"><X size={17}/></button>
      </aside>
    )}

    {pwa.showIOSInstructions && (
      <div className="pwa-guide" role="dialog" aria-modal="true" aria-labelledby="pwa-guide-title" onMouseDown={(event) => event.target === event.currentTarget && pwa.closeIOSInstructions()}>
        <section>
          <button className="pwa-guide__close" onClick={pwa.closeIOSInstructions} aria-label="Close"><X size={20}/></button>
          <span className="pwa-guide__symbol">✦</span>
          <p>{pwa.platform === "ios" ? "INSTALL ON IPHONE OR IPAD" : "INSTALL ON YOUR PHONE"}</p>
          <h2 id="pwa-guide-title">Keep Velvet close</h2>
          {pwa.platform === "ios" ? <ol>
            <li><span>1</span><div>Open this page in <strong>Safari</strong>.</div></li>
            <li><span>2</span><div>Tap the <Share size={17}/> <strong>Share</strong> button.</div></li>
            <li><span>3</span><div>Choose <strong>Add to Home Screen</strong>, then tap Add.</div></li>
          </ol> : <ol>
            <li><span>1</span><div>Open Velvet Stories in <strong>Chrome</strong>.</div></li>
            <li><span>2</span><div>Tap Chrome's <strong>three-dot menu</strong>.</div></li>
            <li><span>3</span><div>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</div></li>
          </ol>}
          <button className="pwa-guide__done" onClick={pwa.closeIOSInstructions}>Got it</button>
        </section>
      </div>
    )}
  </>;
}

export default PWAStatus;
