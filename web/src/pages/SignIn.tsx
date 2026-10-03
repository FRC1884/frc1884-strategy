import { useState, type FormEvent } from "react";
import { Notice } from "../components/ui";
import { useSession } from "../lib/session";

const MESSAGES: Record<string, string> = {
  wrong_code: "That code is not right. Check it with your lead and try again.",
  name_required: "Enter your name, at least two characters.",
  too_many_attempts: "Too many wrong codes from this connection. Wait five minutes and try again.",
  codes_not_configured: "Sign-in codes have not been set on the server yet. Ask whoever runs the server to set them.",
};

export function SignIn() {
  const { signIn, signInReady } = useSession();
  const [name, setName] = useState(() => localStorage.getItem("hub-name") ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(name, code);
      localStorage.setItem("hub-name", name.trim());
    } catch (caught) {
      const codeName = (caught as { code?: string }).code ?? "";
      setError(MESSAGES[codeName] ?? "Could not reach the server. Check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="signin">
      <div className="signin-mark" aria-hidden="true">
        1884
      </div>
      <form className="signin-form" onSubmit={submit}>
        <h1>Griffins Hub</h1>
        <p className="signin-lead">Scouting and strategy for the team. Sign in with the code you were given.</p>
        {!signInReady ? <Notice tone="warn">{MESSAGES.codes_not_configured}</Notice> : null}
        <label className="field">
          <span>Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={40} required />
        </label>
        <label className="field">
          <span>Code</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} type="password" autoComplete="off" autoCapitalize="none" required />
        </label>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
