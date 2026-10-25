import type { ReactNode } from "react";

export default function LoadingText({ children }: { children: ReactNode }) {
  return (
    <p className="panel-sub loading-text" role="status">
      {children}
      <span className="dots" aria-hidden="true">
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
    </p>
  );
}