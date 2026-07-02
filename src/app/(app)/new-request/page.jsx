import { Suspense } from "react";
import NewRequestContent from "./NewRequestContent";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NewRequestContent />
    </Suspense>
  );
}
