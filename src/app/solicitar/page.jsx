import { Suspense } from "react";
import GuestRequestContent from "./GuestRequestContent";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <GuestRequestContent />
    </Suspense>
  );
}
