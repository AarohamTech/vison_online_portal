import { SectionBrowser } from "@/components/section-browser";

export default async function AnnotatedPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ path?: string }>;
}) {
  const { projectId } = await params;
  const { path } = await searchParams;
  return (
    <SectionBrowser projectId={projectId} section="annotated" rawPath={path ?? ""} />
  );
}
