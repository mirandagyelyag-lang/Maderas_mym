import { Globe2, LockKeyhole, LogOut, Moon, Settings2, ShieldCheck, Sparkles, Sun, UserRound } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import "../styles/profile.css";

function Profile({ onManagePersonas, onManageLorebooks, onOpenSettings }) {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const displayName =
    user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Velvet owner";

  async function handleSignOut() {
    try {
      setSigningOut(true);
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
      setSigningOut(false);
    }
  }

  return (
    <section className="profile-page">
      <header className="page-heading">
        <div>
          <p>YOUR VELVET SPACE</p>
          <h1>Profile</h1>
          <span>Appearance, worlds and private access.</span>
        </div>
      </header>

      <div className="profile-card profile-card--identity">
        <span className="profile-card__avatar"><UserRound size={30} /></span>
        <div>
          <h2>{displayName}</h2>
          <p>{user?.email}</p>
        </div>
        <span className="profile-card__private"><LockKeyhole size={14} /> Private owner</span>
      </div>

      <div className="profile-card">
        <div className="profile-setting">
          <span className="profile-setting__icon">
            {theme === "dark" ? <Moon size={20} /> : <Sun size={20} />}
          </span>
          <div>
            <strong>Appearance</strong>
            <small>Currently using {theme} mode</small>
          </div>
          <button onClick={toggleTheme}>Switch to {theme === "dark" ? "light" : "dark"}</button>
        </div>

        <div className="profile-setting">
          <span className="profile-setting__icon"><Sparkles size={20} /></span>
          <div><strong>Roleplay identities</strong><small>Create reusable versions of yourself for different stories.</small></div>
          <button onClick={onManagePersonas}>Manage personas</button>
        </div>

        <div className="profile-setting">
          <span className="profile-setting__icon"><Globe2 size={20} /></span>
          <div><strong>World & lorebooks</strong><small>Keep locations, side characters and timelines consistent.</small></div>
          <button onClick={onManageLorebooks}>Manage worlds</button>
        </div>

        <div className="profile-setting">
          <span className="profile-setting__icon"><Settings2 size={20} /></span>
          <div><strong>General settings</strong><small>Reading size, motion, exports and safety preferences.</small></div>
          <button onClick={onOpenSettings}>Open settings</button>
        </div>

        <div className="profile-setting">
          <span className="profile-setting__icon"><ShieldCheck size={20} /></span>
          <div>
            <strong>Private single-user mode</strong>
            <small>Your session is kept on this device so Velvet can reopen without asking for your password.</small>
          </div>
        </div>
      </div>

      <details className="profile-private-access">
        <summary>
          <LockKeyhole size={16} />
          Private access
        </summary>
        <div className="profile-private-access__body">
          <p>
            Only use this if you want Velvet to forget the saved session on this device.
            You will need your email and password the next time you open the app.
          </p>
          <button onClick={handleSignOut} disabled={signingOut}>
            <LogOut size={17} />
            {signingOut ? "Forgetting device..." : "Forget this device"}
          </button>
        </div>
      </details>
    </section>
  );
}

export default Profile;
