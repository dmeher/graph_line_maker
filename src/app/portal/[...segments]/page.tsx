import PortalClient from "@/components/portal/portal-client";

interface PortalRoutePageProps {
  params: Promise<{ segments: string[] }>;
}

export default async function PortalRoutePage({ params }: PortalRoutePageProps) {
  const { segments } = await params;
  const pathname = `/portal/${segments.join("/")}`;

  return <PortalClient pathname={pathname} segments={segments} />;
}
