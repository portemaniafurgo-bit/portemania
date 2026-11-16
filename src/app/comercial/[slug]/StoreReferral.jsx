"use client";

import { useEffect } from "react";
import { storeRefCode } from "@/lib/referral";

/** Guarda en el navegador el código del comercial cuyo enlace se ha abierto. */
export default function StoreReferral({ code }) {
  useEffect(() => {
    storeRefCode(code);
  }, [code]);
  return null;
}
