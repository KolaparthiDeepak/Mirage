"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { useToast } from "./Toast";

export function CopyButton({
  text,
  label = "Copy",
}: {
  text: string | (() => string);
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useToast();

  useEffect(() => () => clearTimeout(timer.current), []);

  async function onClick() {
    try {
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      const value = typeof text === "function" ? text() : text;
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1200);
    } catch {
      toast("Couldn't copy to clipboard");
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      {copied ? "Copied" : label}
    </Button>
  );
}
