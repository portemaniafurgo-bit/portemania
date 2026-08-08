import ServiceLanding, { serviceMetadata } from "@/components/landing/ServiceLanding";

export const metadata = serviceMetadata("mini_mudanza");
export const revalidate = 3600;

export default function Page() {
  return <ServiceLanding serviceKey="mini_mudanza" />;
}
