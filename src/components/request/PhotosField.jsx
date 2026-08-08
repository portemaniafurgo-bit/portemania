"use client";

import { Camera, Images, Loader2, X } from "lucide-react";
import { Label } from "@/components/ui/label";

/** Fotos de la carga: cámara del móvil o galería, con vista previa borrable. */
export default function PhotosField({ photos, required, uploading, onUpload, onRemove, hint }) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Camera className="w-4 h-4 text-primary" />
        {required ? "Fotos de la mercancía" : "Foto (opcional)"}
        {required ? (
          <span className="text-destructive">*</span>
        ) : (
          <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
        )}
      </Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      <div className="flex gap-3 flex-wrap">
        {photos.map((url, i) => (
          <div key={url} className="relative w-20 h-20 rounded-xl overflow-hidden border border-border">
            <img src={url} alt={`Carga ${i + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white"
              aria-label="Quitar foto"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        <label
          className={`w-20 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
            required && photos.length === 0
              ? "border-destructive/60 hover:border-destructive"
              : "border-border hover:border-primary/40"
          }`}
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
          ) : (
            <Camera className="w-5 h-5 text-muted-foreground" />
          )}
          <span className="text-[10px] text-muted-foreground leading-none">Hacer foto</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onUpload}
          />
        </label>

        <label className="w-20 h-20 rounded-xl border-2 border-dashed border-border hover:border-primary/40 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors">
          <Images className="w-5 h-5 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground leading-none">Galería</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={onUpload} />
        </label>
      </div>

      {required && photos.length === 0 && (
        <p className="text-xs text-destructive">Debes subir al menos 1 foto</p>
      )}
    </div>
  );
}
