import { ArrowLeft, Check, Download, Eye, FileDown, MonitorSmartphone, Moon, RotateCcw, ShieldCheck, Sparkles, Sun, Type, WifiOff } from "lucide-react";
import { useSettings } from "../context/SettingsContext";
import { useFeedback } from "../context/FeedbackContext";
import { usePWA } from "../context/PWAContext";
import { useTheme } from "../context/ThemeContext";
import "../styles/settings.css";

function Settings({ onBack }) {
  const { settings, updateSetting, resetSettings } = useSettings();
  const { confirmAction } = useFeedback();
  const pwa = usePWA();
  const { theme, setTheme } = useTheme();
  async function confirmReset() { if (await confirmAction({ title: "Reset all preferences?", message: "Reading size, motion, export and safety preferences will return to their defaults.", confirmLabel: "Reset settings" })) resetSettings(); }
  return <section className="settings-page">
    <header className="page-heading settings-page__heading"><div><button onClick={onBack}><ArrowLeft size={17}/>Profile</button><p>MAKE VELVET YOURS</p><h1>Settings</h1><span>Reading, behavior and export preferences.</span></div></header>
    <div className="settings-group"><header><Eye size={19}/><div><h2>Appearance</h2><p>Choose the light that feels best for reading.</p></div></header>
      <div className="setting-row"><strong>Theme</strong><div className="setting-segments">
        <button className={theme==='light'?'active':''} onClick={()=>setTheme('light')}><Sun size={14}/> Light</button>
        <button className={theme==='dark'?'active':''} onClick={()=>setTheme('dark')}><Moon size={14}/> Dark</button>
        <button className={theme==='comfort'?'active':''} onClick={()=>setTheme('comfort')}><Eye size={14}/> Comfort</button>
      </div></div>
    </div>
    <div className="settings-group"><header><Type size={19}/><div><h2>Reading experience</h2><p>Adjust stories without changing their content.</p></div></header>
      <SettingChoice label="Text size" value={settings.textSize} options={[['compact','Compact'],['comfortable','Comfortable'],['large','Large']]} onChange={(value)=>updateSetting('textSize',value)}/>
      <SettingChoice label="Interface density" value={settings.density} options={[['comfortable','Comfortable'],['compact','Compact']]} onChange={(value)=>updateSetting('density',value)}/>
      <Toggle label="Reduce motion" description="Minimize transitions and animated effects." checked={settings.reduceMotion} onChange={(value)=>updateSetting('reduceMotion',value)}/>
      <Toggle label="Message timestamps" description="Show the exact time below every message." checked={settings.showMessageTimestamps} onChange={(value)=>updateSetting('showMessageTimestamps',value)}/>
      <Toggle label="Haptic feedback" description="Use a tiny vibration when sending or stopping on supported phones." checked={settings.haptics} onChange={(value)=>updateSetting('haptics',value)}/>
    </div>
    <div className="settings-group"><header><FileDown size={19}/><div><h2>Stories & exports</h2><p>Choose how your private stories leave Velvet.</p></div></header>
      <SettingChoice label="Default export format" value={settings.exportFormat} options={[['markdown','Markdown'],['text','Plain text'],['json','JSON backup']]} onChange={(value)=>updateSetting('exportFormat',value)}/>
    </div>
    <div className="settings-group"><header><ShieldCheck size={19}/><div><h2>Safety</h2><p>Protection against accidental destructive actions.</p></div></header>
      <Toggle label="Confirm before deleting" description="Ask before deleting characters, conversations and lore." checked={settings.confirmBeforeDelete} onChange={(value)=>updateSetting('confirmBeforeDelete',value)}/>
    </div>
    <div className="settings-group settings-install"><header><MonitorSmartphone size={19}/><div><h2>Velvet on your phone</h2><p>Install it with its own icon and full-screen experience.</p></div></header>
      <div className="settings-install__body">
        <span className="settings-install__icon">✦</span>
        <div>
          <strong>{pwa.installed ? "Velvet Stories is installed" : "Add Velvet Stories to your home screen"}</strong>
          <small>{pwa.installed ? "You are already using the app experience." : "It opens without browser controls and stays close to your stories."}</small>
          <em><WifiOff size={13}/>The interface works offline. AI replies still require Wi-Fi or mobile data.</em>
        </div>
        {!pwa.installed && <button onClick={pwa.installApp}><Download size={17}/>Install app</button>}
        {pwa.installed && <span className="settings-install__installed"><Check size={16}/>Installed</span>}
      </div>
    </div>
    <button className="settings-page__reset" onClick={confirmReset}><RotateCcw size={16}/>Reset preferences</button>
    <div className="settings-page__saved"><Check size={15}/>Preferences save automatically on this device.</div>
  </section>;
}

function SettingChoice({ label, value, options, onChange }) { return <div className="setting-row"><strong>{label}</strong><div className="setting-segments">{options.map(([id,name])=><button key={id} className={value===id?'active':''} onClick={()=>onChange(id)}>{value===id&&<Sparkles size={13}/>} {name}</button>)}</div></div>; }
function Toggle({ label, description, checked, onChange }) { return <label className="setting-toggle"><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={(event)=>onChange(event.target.checked)}/><i/></label>; }
export default Settings;
