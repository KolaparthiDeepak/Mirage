"use client";
import { use, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { useProject } from "@/app/_lib/view-model-context";

export default function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const project = useProject(slug);
  if (!project) notFound();
  return <>{children}</>;
}
