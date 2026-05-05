import { useMemo, useState } from "react";
import { clearSession, loadStoredUser, setSession } from "./lib/api";
import type { User } from "./types";
import { Splash } from "./components/Splash";
import { Workspace } from "./workspace/Workspace";

export default function App() {
  const initial = useMemo(() => {
    const tok = localStorage.getItem("riff_token");
    const u = loadStoredUser();
    if (tok && u) return { token: tok, user: u };
    return null;
  }, []);

  const [session, setSessionState] = useState<{ token: string; user: User } | null>(initial);

  return session ? (
    <Workspace
      token={session.token}
      user={session.user}
      onLogout={() => {
        clearSession();
        setSessionState(null);
      }}
    />
  ) : (
    <Splash
      onSignedIn={(token, user) => {
        setSession(token, user);
        setSessionState({ token, user });
      }}
    />
  );
}
