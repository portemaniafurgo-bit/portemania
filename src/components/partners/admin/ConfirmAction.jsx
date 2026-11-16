"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Diálogo de confirmación para las acciones del admin. `pending` = {title,
 * description, confirmLabel, withNote, noteLabel, destructive, run(note)} o
 * null (cerrado). run() devuelve true si hay que cerrar el diálogo.
 */
export default function ConfirmAction({ pending, onClose }) {
  return (
    <AlertDialog open={!!pending} onOpenChange={(open) => !open && onClose()}>
      {pending && <ConfirmBody key={pending.key || pending.title} pending={pending} onClose={onClose} />}
    </AlertDialog>
  );
}

function ConfirmBody({ pending, onClose }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // Se marca en el mismo clic (el estado tarda un render): un doble clic no
  // lanza la acción dos veces.
  const runningRef = useRef(false);

  const confirm = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusy(true);
    try {
      const close = await pending.run(note.trim());
      if (close !== false) onClose();
    } finally {
      runningRef.current = false;
      setBusy(false);
    }
  };

  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{pending.title}</AlertDialogTitle>
        {pending.description && <AlertDialogDescription>{pending.description}</AlertDialogDescription>}
      </AlertDialogHeader>
      {pending.withNote && (
        <div className="space-y-1.5">
          <Label htmlFor="confirm-note">{pending.noteLabel || "Nota (opcional)"}</Label>
          <Textarea
            id="confirm-note"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-xl"
            rows={3}
          />
        </div>
      )}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
        <AlertDialogAction
          disabled={busy}
          className={pending.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
          onClick={(e) => {
            e.preventDefault();
            confirm();
          }}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : pending.confirmLabel || "Confirmar"}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
