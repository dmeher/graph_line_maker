"use client";

import { Grid2x2, PanelBottom, PanelLeft, PanelRight, PanelTop, PanelsTopLeft, type LucideIcon } from "lucide-react";
import type { QuickCropSegment } from "@/lib/canvas/crop";

type QuickCropControl = {
  segment: QuickCropSegment;
  label: string;
  Icon: LucideIcon;
  rotation?: number;
};

const HALF_CONTROLS: QuickCropControl[] = [
  { segment: "left", label: "Keep left half", Icon: PanelLeft },
  { segment: "right", label: "Keep right half", Icon: PanelRight },
  { segment: "top", label: "Keep top half", Icon: PanelTop },
  { segment: "bottom", label: "Keep bottom half", Icon: PanelBottom },
];

const QUARTER_CONTROLS: QuickCropControl[] = [
  { segment: "top-left", label: "Keep top-left quarter", Icon: PanelsTopLeft },
  { segment: "top-right", label: "Keep top-right quarter", Icon: PanelsTopLeft, rotation: 90 },
  { segment: "bottom-left", label: "Keep bottom-left quarter", Icon: PanelsTopLeft, rotation: 270 },
  { segment: "bottom-right", label: "Keep bottom-right quarter", Icon: PanelsTopLeft, rotation: 180 },
];

function CropControlButton({
  control,
  disabled,
  onSelect,
  variant,
}: {
  control: QuickCropControl;
  disabled: boolean;
  onSelect: (segment: QuickCropSegment) => void;
  variant: "panel" | "toolbar";
}) {
  const { Icon } = control;
  return (
    <button
      type="button"
      onClick={() => onSelect(control.segment)}
      disabled={disabled}
      className={variant === "panel" ? "quick-crop-controls__button mock-btn" : "quick-crop-controls__button editor-crop-modal__tool"}
      title={control.label}
      aria-label={control.label}
    >
      <Icon size={variant === "panel" ? 18 : 16} strokeWidth={1.9} style={control.rotation ? { transform: `rotate(${control.rotation}deg)` } : undefined} aria-hidden="true" />
    </button>
  );
}

export function QuickCropControls({
  disabled = false,
  onSelect,
  variant = "panel",
}: {
  disabled?: boolean;
  onSelect: (segment: QuickCropSegment) => void;
  variant?: "panel" | "toolbar";
}) {
  return (
    <div className={`quick-crop-controls quick-crop-controls--${variant}`} role="group" aria-label="Quick crop selection">
      {variant === "panel" ? <span className="quick-crop-controls__label inline-flex items-center gap-2 text-sm font-semibold"><Grid2x2 size={16} aria-hidden="true" />Quick crop</span> : null}
      <div className={`quick-crop-controls__halves ${variant === "panel" ? "create-transform-actions" : "quick-crop-controls__toolbar-row"}`} aria-label="Crop to a half">
        {HALF_CONTROLS.map((control) => <CropControlButton key={control.segment} control={control} disabled={disabled} onSelect={onSelect} variant={variant} />)}
      </div>
      <div className={`quick-crop-controls__quarters ${variant === "panel" ? "create-transform-actions" : "quick-crop-controls__toolbar-row"}`} aria-label="Crop to a quarter">
        {QUARTER_CONTROLS.map((control) => <CropControlButton key={control.segment} control={control} disabled={disabled} onSelect={onSelect} variant={variant} />)}
      </div>
    </div>
  );
}
