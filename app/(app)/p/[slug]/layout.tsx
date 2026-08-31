"use client";
import { use, type ReactNode } from "react";
import { notFound, usePathname } from "next/navigation";
import { useProject } from "@/app/_lib/view-model-context";
import { Breadcrumbs } from "@/app/_shell/Breadcrumbs";

const SEGMENT_LABELS: Record<string, string> = {
  endpoints: "Endpoints",
  cases: "Cases",
  rules: "Rules",
  scenarios: "Scenarios",
  environments: "Environments",
  variables: "Variables",
  settings: "Settings",
  public: "Public",
};

export default function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const project = useProject(slug);
  const pathname = usePathname();
  if (!project) notFound();

  const segment = pathname.split("/")[3];
  const crumbs: { label: string; href?: string }[] = [
    { label: project.name, href: `/p/${slug}` },
  ];
  if (segment) crumbs.push({ label: SEGMENT_LABELS[segment] ?? segment });

  return (
    <>
      <Breadcrumbs items={crumbs} />
      {children}
    </>
  );
}
