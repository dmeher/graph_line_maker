"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ManualCropper, type CropGuide } from "@/components/projects/manual-cropper";
import type { CropPixels } from "@/lib/canvas/crop";
import type { DesignCrop, DesignFile, DesignImageNode } from "@/lib/design/types";

export function DesignCropDialog({ node, file, onApply, onClose }: { node: DesignImageNode; file: DesignFile; onApply: (crop: DesignCrop) => void; onClose: () => void }) {
  const initial = useMemo<CropPixels>(() => ({ x: Math.round(node.crop.x * file.width), y: Math.round(node.crop.y * file.height), width: Math.max(1, Math.round(node.crop.width * file.width)), height: Math.max(1, Math.round(node.crop.height * file.height)) }), [file.height, file.width, node.crop]);
  const [crop, setCrop] = useState<CropPixels | null>(initial);
  const [guide, setGuide] = useState<CropGuide>("thirds");
  const [zoom, setZoom] = useState(1);
  return <div className="design-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="design-dialog design-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="design-crop-title">
    <header><div><p className="eyebrow">Non-destructive crop</p><h2 id="design-crop-title">Advanced crop</h2></div><button type="button" onClick={onClose} aria-label="Close crop"><X size={19} /></button></header>
    <div className="design-crop-dialog__canvas"><ManualCropper imageUrl={file.url || ""} crop={crop} onCropChange={setCrop} guide={guide} zoom={zoom} onZoomChange={setZoom} /></div>
    <footer><label>Guide<select value={guide} onChange={(event) => setGuide(event.target.value as CropGuide)}><option value="thirds">Thirds</option><option value="golden">Golden</option><option value="center">Center</option><option value="grid">Grid</option><option value="none">None</option></select></label><button type="button" className="ui-button" onClick={() => { setCrop(initial); setZoom(1); }}><RotateCcw size={15} /> Reset</button><span className="design-dialog__spacer" /><button type="button" className="ui-button" onClick={onClose}>Cancel</button><button type="button" className="ui-button ui-button--primary" disabled={!crop} onClick={() => crop && onApply({ x: crop.x / file.width, y: crop.y / file.height, width: crop.width / file.width, height: crop.height / file.height })}><Check size={15} /> Apply crop</button></footer>
  </section></div>;
}
