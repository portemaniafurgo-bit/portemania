"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export default function PhotoLightbox({ photos }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  if (!photos?.length) return null;

  const prev = () => setIndex((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setIndex((i) => (i + 1) % photos.length);

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        {photos.map((url, i) => (
          <button
            key={i}
            onClick={() => {
              setIndex(i);
              setOpen(true);
            }}
            className="w-16 h-16 rounded-xl overflow-hidden border border-border hover:border-primary transition-colors focus:outline-none"
          >
            <img src={url} alt={`foto ${i + 1}`} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-white/10 rounded-full p-2 hover:bg-white/20"
            onClick={() => setOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>

          {photos.length > 1 && (
            <button
              className="absolute left-4 text-white bg-white/10 rounded-full p-2 hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          <img
            src={photos[index]}
            alt={`foto ${index + 1}`}
            className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {photos.length > 1 && (
            <button
              className="absolute right-4 text-white bg-white/10 rounded-full p-2 hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {photos.length > 1 && (
            <p className="absolute bottom-4 text-white/70 text-sm">
              {index + 1} / {photos.length}
            </p>
          )}
        </div>
      )}
    </>
  );
}
