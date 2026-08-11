import { useEffect, useState } from "react";
import velvetLogo from "../assets/velvet-logo.png";
import "../styles/welcome-splash.css";

export default function WelcomeSplash() {
  const [visible, setVisible] = useState(() => sessionStorage.getItem("velvet-splash-seen") !== "1");

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => {
      sessionStorage.setItem("velvet-splash-seen", "1");
      setVisible(false);
    }, 1250);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;
  return (
    <div className="velvet-splash" onClick={() => { sessionStorage.setItem("velvet-splash-seen", "1"); setVisible(false); }}>
      <img src={velvetLogo} alt="" />
      <h1>Velvet Stories</h1>
      <p>Every story begins with you.</p>
    </div>
  );
}
