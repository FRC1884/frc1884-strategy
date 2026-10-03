import type { ReactNode } from "react";
import { href, navigate } from "../lib/router";

export function Link({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href(to)}
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

export function Page({ title, lead, actions, back, children, wide }: { title: string; lead?: ReactNode; actions?: ReactNode; back?: string; children: ReactNode; wide?: boolean }) {
  return (
    <main className={wide ? "page page-wide" : "page"}>
      <header className="page-head">
        <div>
          {back ? (
            <Link to={back} className="back-link">
              Back
            </Link>
          ) : null}
          <h1>{title}</h1>
          {lead ? <p className="page-lead">{lead}</p> : null}
        </div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </header>
      {children}
    </main>
  );
}

export function Panel({ title, aside, children, tone }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; tone?: "red" | "blue" | "gold" }) {
  return (
    <section className={`panel${tone ? ` panel-${tone}` : ""}`}>
      {title || aside ? (
        <div className="panel-head">
          {title ? <h2>{title}</h2> : <span />}
          {aside ? <div className="panel-aside">{aside}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children ? <p className="empty-body">{children}</p> : null}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "good"; children: ReactNode }) {
  return (
    <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function Chip({ children, tone }: { children: ReactNode; tone?: "red" | "blue" | "gold" | "good" | "warn" | "dim" }) {
  return <span className={`chip${tone ? ` chip-${tone}` : ""}`}>{children}</span>;
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <p className="loading" role="status">
      {label}…
    </p>
  );
}

export function describeError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (error instanceof TypeError) return "No connection to the server. Check your signal and try again.";
  switch (code) {
    case "not_signed_in":
      return "You are signed out. Sign in again to continue.";
    case "not_allowed":
      return "Your sign-in code does not give access to this.";
    case "tba_key_not_configured":
      return "The Blue Alliance key is not set on the server, so the schedule cannot be imported.";
    case "anthropic_key_not_configured":
      return "The AI key is not set on the server, so briefs cannot be written.";
    default:
      return code ? `Something went wrong (${code}).` : "Something went wrong.";
  }
}
