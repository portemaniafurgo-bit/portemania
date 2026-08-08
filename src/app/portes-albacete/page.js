import ServiceLanding, { serviceMetadata } from "@/components/landing/ServiceLanding";

export const metadata = serviceMetadata("porte");
export const revalidate = 3600;

export default function Page() {
  return <ServiceLanding serviceKey="porte" />;
}
