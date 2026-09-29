"use client";
import { useState } from "react";
import AuthModal from "./AuthModal";

interface Props {
  defaultMode?: "login" | "signup";
  redirectTo?: string;
  className?: string;
  children: React.ReactNode;
}

export default function LoginButton({ defaultMode = "login", redirectTo = "/dashboard", className, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      {open && (
        <AuthModal
          defaultMode={defaultMode}
          redirectTo={redirectTo}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
