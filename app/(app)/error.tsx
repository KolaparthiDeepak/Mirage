"use client";
import { AppError } from "@/app/_shell/AppError";

export default function AppRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AppError error={error} reset={reset} />;
}
