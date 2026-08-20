"use client";

import Konva from "konva";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Arrow, Ellipse, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import { loadDesignImage, renderDesignImageBitmap } from "@/lib/design/image-client";
import { snapDesignNodePosition } from "@/lib/design/geometry";
import type { DesignDocumentV1, DesignFile, DesignImageNode, DesignMaskOperation, DesignNode, DesignPathNode } from "@/lib/design/types";

export type DesignTool = "select" | "pan" | "draw" | "marker" | "erase" | "restore" | "lasso-erase" | "lasso-restore";
export type DesignStageHandle = { exportFull: () => HTMLCanvasElement; exportSelection: (ids: string[]) => HTMLCanvasElement | null; fit: () => void; isReady: () => boolean };

function compositeMode(mode: DesignNode["blendMode"]): GlobalCompositeOperation {
  return mode === "normal" ? "source-over" : mode;
}

function ImageObject({ node, file, selected, canDrag, onSelect, onChange, onReadyChange }: { node: DesignImageNode; file?: DesignFile; selected: boolean; canDrag: boolean; onSelect: (add: boolean) => void; onChange: (changes: Partial<DesignNode>) => void; onReadyChange: (id: string, ready: boolean) => void }) {
  const [bitmap, setBitmap] = useState<HTMLCanvasElement | null>(null);
  const renderKey = JSON.stringify([node.crop, node.masks, node.adjustments]);
  useEffect(() => {
    let cancelled = false;
    onReadyChange(node.id, false);
    if (!file?.url) { setBitmap(null); return; }
    loadDesignImage(file.url).then((image) => { if (!cancelled) { setBitmap(renderDesignImageBitmap(image, node)); onReadyChange(node.id, true); } }).catch(() => { if (!cancelled) { setBitmap(null); onReadyChange(node.id, false); } });
    return () => { cancelled = true; };
  }, [file?.url, node.id, onReadyChange, renderKey]);
  return <Group id={`design-node-${node.id}`} name="design-node" x={node.x + node.width / 2} y={node.y + node.height / 2} width={node.width} height={node.height} rotation={node.rotation} scaleX={node.flipX ? -1 : 1} scaleY={node.flipY ? -1 : 1} opacity={node.opacity} globalCompositeOperation={compositeMode(node.blendMode)} visible={node.visible} draggable={canDrag && !node.locked} onClick={(event) => { event.cancelBubble = true; onSelect(event.evt.shiftKey); }} onTap={(event) => { event.cancelBubble = true; onSelect(false); }} onDragEnd={(event) => { event.cancelBubble = true; onChange({ x: event.target.x() - node.width / 2, y: event.target.y() - node.height / 2 }); }}>
    {bitmap ? <KonvaImage image={bitmap} x={-node.width / 2} y={-node.height / 2} width={node.width} height={node.height} perfectDrawEnabled={false} /> : <Rect x={-node.width / 2} y={-node.height / 2} width={node.width} height={node.height} fill="#eef0f4" stroke={selected ? "#02a7c7" : "#c5cad3"} dash={[8, 6]} />}
  </Group>;
}

function RenderNode({ node, file, selected, canDrag, onSelect, onChange, onReadyChange }: { node: DesignNode; file?: DesignFile; selected: boolean; canDrag: boolean; onSelect: (add: boolean) => void; onChange: (changes: Partial<DesignNode>) => void; onReadyChange: (id: string, ready: boolean) => void }) {
  if (node.type === "group") return null;
  if (node.type === "image") return <ImageObject node={node} file={file} selected={selected} canDrag={canDrag} onSelect={onSelect} onChange={onChange} onReadyChange={onReadyChange} />;
  const common = { id: `design-node-${node.id}`, name: "design-node", x: node.x + node.width / 2, y: node.y + node.height / 2, width: node.width, height: node.height, rotation: node.rotation, scaleX: node.flipX ? -1 : 1, scaleY: node.flipY ? -1 : 1, opacity: node.opacity, globalCompositeOperation: compositeMode(node.blendMode), visible: node.visible, draggable: canDrag && !node.locked, onClick: (event: Konva.KonvaEventObject<MouseEvent>) => { event.cancelBubble = true; onSelect(event.evt.shiftKey); }, onTap: (event: Konva.KonvaEventObject<TouchEvent>) => { event.cancelBubble = true; onSelect(false); }, onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => { event.cancelBubble = true; onChange({ x: event.target.x() - node.width / 2, y: event.target.y() - node.height / 2 }); } };
  if (node.type === "text") return <Group {...common}><Text x={-node.width / 2} y={-node.height / 2} width={node.width} height={node.height} text={node.text} fontFamily={node.fontFamily} fontSize={node.fontSize} fontStyle={`${node.fontStyle} ${node.fontWeight >= 600 ? "bold" : "normal"}`} align={node.align} lineHeight={node.lineHeight} letterSpacing={node.letterSpacing} fill={node.fill} stroke={node.strokeWidth ? node.stroke : undefined} strokeWidth={node.strokeWidth} verticalAlign="middle" /></Group>;
  if (node.type === "path") return <Group {...common}><Line x={-node.width / 2} y={-node.height / 2} points={node.points.flatMap((point) => [point.x, point.y])} stroke={node.stroke} strokeWidth={node.strokeWidth} lineCap="round" lineJoin="round" tension={0.35} /></Group>;
  const shapeX = -node.width / 2; const shapeY = -node.height / 2;
  return <Group {...common}>
    {node.shape === "rectangle" ? <Rect x={shapeX} y={shapeY} width={node.width} height={node.height} cornerRadius={node.cornerRadius} fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} dash={node.dash} shadowColor={node.shadowColor} shadowBlur={node.shadowBlur} shadowOffsetX={node.shadowOffsetX} shadowOffsetY={node.shadowOffsetY} /> : null}
    {node.shape === "ellipse" ? <Ellipse radiusX={node.width / 2} radiusY={node.height / 2} fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} dash={node.dash} shadowColor={node.shadowColor} shadowBlur={node.shadowBlur} /> : null}
    {node.shape === "arrow" ? <Arrow x={shapeX} y={shapeY} points={node.points.length ? node.points.flatMap((point) => [point.x, point.y]) : [0, node.height / 2, node.width, node.height / 2]} stroke={node.stroke} fill={node.stroke} strokeWidth={node.strokeWidth} dash={node.dash} pointerLength={Math.max(10, node.strokeWidth * 4)} pointerWidth={Math.max(8, node.strokeWidth * 3)} /> : null}
    {node.shape === "line" ? <Line x={shapeX} y={shapeY} points={node.points.length ? node.points.flatMap((point) => [point.x, point.y]) : [0, node.height / 2, node.width, node.height / 2]} stroke={node.stroke} strokeWidth={node.strokeWidth} dash={node.dash} lineCap="round" /> : null}
    {node.shape === "polygon" ? <Line x={shapeX} y={shapeY} points={node.points.flatMap((point) => [point.x, point.y])} closed fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} dash={node.dash} /> : null}
  </Group>;
}

function inverseNodePoint(point: { x: number; y: number }, node: DesignImageNode) {
  const centerX = node.x + node.width / 2; const centerY = node.y + node.height / 2;
  const angle = -node.rotation * Math.PI / 180; const dx = point.x - centerX; const dy = point.y - centerY;
  let localX = dx * Math.cos(angle) - dy * Math.sin(angle); let localY = dx * Math.sin(angle) + dy * Math.cos(angle);
  if (node.flipX) localX *= -1; if (node.flipY) localY *= -1;
  return { x: Math.max(-4, Math.min(5, localX / node.width + 0.5)), y: Math.max(-4, Math.min(5, localY / node.height + 0.5)) };
}

function nodePoint(point: { x: number; y: number }, node: DesignImageNode) {
  let localX = (point.x - 0.5) * node.width; let localY = (point.y - 0.5) * node.height;
  if (node.flipX) localX *= -1; if (node.flipY) localY *= -1;
  const angle = node.rotation * Math.PI / 180;
  return { x: node.x + node.width / 2 + localX * Math.cos(angle) - localY * Math.sin(angle), y: node.y + node.height / 2 + localX * Math.sin(angle) + localY * Math.cos(angle) };
}

export const DesignCanvasStage = forwardRef<DesignStageHandle, { document: DesignDocumentV1; files: DesignFile[]; selectedIds: string[]; tool: DesignTool; brushRadius: number; drawColor: string; drawWidth: number; snapEnabled: boolean; onSelect: (id: string | null, additive?: boolean) => void; onChangeNode: (id: string, changes: Partial<DesignNode>) => void; onAddPath: (node: DesignPathNode) => void; onAddMask: (nodeId: string, operation: DesignMaskOperation) => void }>(({ document, files, selectedIds, tool, brushRadius, drawColor, drawWidth, snapEnabled, onSelect, onChangeNode, onAddPath, onAddMask }, ref) => {
  const hostRef = useRef<HTMLDivElement | null>(null); const stageRef = useRef<Konva.Stage | null>(null); const viewportRef = useRef<Konva.Group | null>(null); const contentRef = useRef<Konva.Group | null>(null); const uiLayerRef = useRef<Konva.Layer | null>(null); const transformerRef = useRef<Konva.Transformer | null>(null);
  const readyImageIdsRef = useRef(new Set<string>()); const draftPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const [size, setSize] = useState({ width: 800, height: 600 }); const [zoom, setZoom] = useState(1); const [pan, setPan] = useState({ x: 0, y: 0 }); const [draftPoints, setDraftPoints] = useState<Array<{ x: number; y: number }>>([]); const drawingRef = useRef(false);
  const filesById = useMemo(() => new Map(files.map((file) => [file.id, file])), [files]);
  const handleImageReady = useCallback((id: string, ready: boolean) => { if (ready) readyImageIdsRef.current.add(id); else readyImageIdsRef.current.delete(id); }, []);
  const fitScale = Math.min((size.width - 80) / document.canvas.width, (size.height - 80) / document.canvas.height); const scale = Math.max(0.02, fitScale * zoom);
  const viewportX = (size.width - document.canvas.width * scale) / 2 + pan.x; const viewportY = (size.height - document.canvas.height * scale) / 2 + pan.y;

  useEffect(() => { const host = hostRef.current; if (!host) return; const observer = new ResizeObserver(([entry]) => setSize({ width: Math.max(1, entry.contentRect.width), height: Math.max(1, entry.contentRect.height) })); observer.observe(host); return () => observer.disconnect(); }, []);
  useEffect(() => { const transformer = transformerRef.current; const stage = stageRef.current; if (!transformer || !stage) return; const transformableIds = new Set(tool === "select" ? document.nodes.filter((node) => selectedIds.includes(node.id) && node.visible && !node.locked).map((node) => node.id) : []); transformer.nodes([...transformableIds].map((id) => stage.findOne(`#design-node-${id}`)).filter((node): node is Konva.Node => Boolean(node))); transformer.getLayer()?.batchDraw(); }, [document.nodes, selectedIds, tool]);
  useEffect(() => { drawingRef.current = false; draftPointsRef.current = []; setDraftPoints([]); }, [tool]);

  function documentPoint() { const stage = stageRef.current; const viewport = viewportRef.current; const pointer = stage?.getPointerPosition(); if (!pointer || !viewport) return null; return viewport.getAbsoluteTransform().copy().invert().point(pointer); }
  function selectedImage() { return document.nodes.find((node): node is DesignImageNode => node.type === "image" && selectedIds.includes(node.id)); }
  function pointerDown(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (tool === "select") { if (event.target === event.target.getStage() || event.target.hasName("design-background")) onSelect(null); return; }
    const point = documentPoint(); if (!point || tool === "pan") return;
    if (tool === "draw" || tool === "marker") { drawingRef.current = true; draftPointsRef.current = [point]; setDraftPoints([point]); return; }
    const image = selectedImage(); if (!image) return; const firstPoint = inverseNodePoint(point, image); drawingRef.current = true; draftPointsRef.current = [firstPoint]; setDraftPoints([firstPoint]);
  }
  function pointerMove() { if (!drawingRef.current) return; const point = documentPoint(); if (!point) return; const image = selectedImage(); const nextPoint = image && tool !== "draw" && tool !== "marker" ? inverseNodePoint(point, image) : point; const lastPoint = draftPointsRef.current.at(-1); if (lastPoint && Math.hypot(nextPoint.x - lastPoint.x, nextPoint.y - lastPoint.y) < 0.001) return; draftPointsRef.current = [...draftPointsRef.current, nextPoint]; setDraftPoints(draftPointsRef.current); }
  function pointerUp() {
    if (!drawingRef.current) return; drawingRef.current = false;
    const points = draftPointsRef.current;
    if ((tool === "draw" || tool === "marker") && points.length > 1) {
      const minX = Math.min(...points.map((point) => point.x)); const minY = Math.min(...points.map((point) => point.y)); const maxX = Math.max(...points.map((point) => point.x)); const maxY = Math.max(...points.map((point) => point.y));
      onAddPath({ id: crypto.randomUUID(), type: "path", name: tool === "marker" ? "Marker stroke" : "Pencil stroke", x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY), rotation: 0, flipX: false, flipY: false, opacity: tool === "marker" ? 0.45 : 1, blendMode: "normal", visible: true, locked: false, parentId: null, points: points.map((point) => ({ x: point.x - minX, y: point.y - minY })), stroke: drawColor, strokeWidth: drawWidth, tool: tool === "marker" ? "marker" : "pencil" });
    } else {
      const image = selectedImage(); const lasso = tool === "lasso-erase" || tool === "lasso-restore";
      if (image && points.length >= (lasso ? 3 : 1)) onAddMask(image.id, { id: crypto.randomUUID(), kind: lasso ? "lasso" : "brush", mode: tool === "restore" || tool === "lasso-restore" ? "restore" : "erase", ...(lasso ? {} : { radius: brushRadius }), points } as DesignMaskOperation);
    }
    draftPointsRef.current = []; setDraftPoints([]);
  }
  function transformEnd() {
    const stage = stageRef.current; if (!stage) return;
    for (const id of selectedIds) {
      const target = stage.findOne(`#design-node-${id}`); const node = document.nodes.find((item) => item.id === id); if (!target || !node || node.locked) continue;
      const nextWidth = Math.max(1, node.width * Math.abs(target.scaleX())); const nextHeight = Math.max(1, node.height * Math.abs(target.scaleY()));
      const position = { x: target.x() - nextWidth / 2, y: target.y() - nextHeight / 2 };
      const snapped = snapEnabled ? snapDesignNodePosition({ ...node, width: nextWidth, height: nextHeight }, position, document.nodes, document.canvas) : { ...position };
      const changes: Partial<DesignNode> = { x: snapped.x, y: snapped.y, width: nextWidth, height: nextHeight, rotation: target.rotation(), flipX: target.scaleX() < 0, flipY: target.scaleY() < 0 };
      if (node.type === "path" || (node.type === "shape" && node.points.length)) onChangeNode(id, { ...changes, points: node.points.map((point) => ({ x: point.x * Math.abs(target.scaleX()), y: point.y * Math.abs(target.scaleY()) })) } as Partial<DesignNode>);
      else onChangeNode(id, changes);
      target.scale({ x: target.scaleX() < 0 ? -1 : 1, y: target.scaleY() < 0 ? -1 : 1 });
    }
  }

  function changeRenderedNode(node: DesignNode, changes: Partial<DesignNode>) {
    if (snapEnabled && typeof changes.x === "number" && typeof changes.y === "number") {
      const snapped = snapDesignNodePosition(node, { x: changes.x, y: changes.y }, document.nodes, document.canvas);
      onChangeNode(node.id, { ...changes, x: snapped.x, y: snapped.y });
      return;
    }
    onChangeNode(node.id, changes);
  }

  function finishViewportPan(event: Konva.KonvaEventObject<DragEvent>) {
    const viewport = viewportRef.current;
    if (!viewport || event.target !== viewport) return;
    setPan({ x: viewport.x() - (size.width - document.canvas.width * scale) / 2, y: viewport.y() - (size.height - document.canvas.height * scale) / 2 });
  }

  function exportCanvas(ids?: string[]) {
    const stage = stageRef.current; const viewport = viewportRef.current; const uiLayer = uiLayerRef.current; if (!stage || !viewport || !uiLayer) throw new Error("Design canvas is not ready.");
    const old = { width: stage.width(), height: stage.height(), x: viewport.x(), y: viewport.y(), scaleX: viewport.scaleX(), scaleY: viewport.scaleY() }; const hidden: Konva.Node[] = [];
    try {
      uiLayer.hide(); viewport.position({ x: 0, y: 0 }); viewport.scale({ x: 1, y: 1 }); stage.size({ width: document.canvas.width, height: document.canvas.height });
      let crop = { x: 0, y: 0, width: document.canvas.width, height: document.canvas.height };
      if (ids?.length || !document.canvas.background) stage.find(".design-background").forEach((node) => { node.hide(); hidden.push(node); });
      if (ids?.length) {
        stage.find(".design-node").forEach((node) => { const id = node.id().replace("design-node-", ""); if (!ids.includes(id)) { node.hide(); hidden.push(node); } });
        const visible = ids.map((id) => stage.findOne(`#design-node-${id}`)).filter((node): node is Konva.Node => Boolean(node?.visible()));
        if (!visible.length) return null;
        const boxes = visible.map((node) => node.getClientRect({ relativeTo: contentRef.current ?? undefined })); const left = Math.floor(Math.min(...boxes.map((box) => box.x))); const top = Math.floor(Math.min(...boxes.map((box) => box.y))); const right = Math.ceil(Math.max(...boxes.map((box) => box.x + box.width))); const bottom = Math.ceil(Math.max(...boxes.map((box) => box.y + box.height))); crop = { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
      }
      stage.draw(); return stage.toCanvas({ ...crop, pixelRatio: 1 });
    } finally {
      hidden.forEach((node) => node.show()); uiLayer.show(); viewport.position({ x: old.x, y: old.y }); viewport.scale({ x: old.scaleX, y: old.scaleY }); stage.size({ width: old.width, height: old.height }); stage.draw();
    }
  }
  useImperativeHandle(ref, () => ({ exportFull: () => exportCanvas()!, exportSelection: (ids) => exportCanvas(ids), fit: () => { setZoom(1); setPan({ x: 0, y: 0 }); }, isReady: () => document.nodes.every((node) => node.type !== "image" || !node.visible || Boolean(filesById.get(node.fileId)?.url && readyImageIdsRef.current.has(node.id))) }), [document, filesById, selectedIds, size]);

  const draftAbsolute = (tool === "draw" || tool === "marker") ? draftPoints : (() => { const image = selectedImage(); if (!image) return []; return draftPoints.map((point) => nodePoint(point, image)); })();
  return <div ref={hostRef} className={`design-stage ${tool === "pan" ? "is-panning" : ""}`} onWheel={(event) => { if (!event.ctrlKey && !event.metaKey) return; event.preventDefault(); setZoom((current) => Math.max(0.1, Math.min(8, current * (event.deltaY > 0 ? 0.9 : 1.1)))); }}>
    <Stage ref={stageRef} width={size.width} height={size.height} onMouseDown={pointerDown} onTouchStart={pointerDown} onMouseMove={pointerMove} onTouchMove={pointerMove} onMouseUp={pointerUp} onTouchEnd={pointerUp} onMouseLeave={pointerUp}>
      <Layer><Group ref={viewportRef} x={viewportX} y={viewportY} scaleX={scale} scaleY={scale} draggable={tool === "pan"} onDragEnd={finishViewportPan}><Group ref={contentRef}>{document.canvas.background ? <Rect name="design-background" width={document.canvas.width} height={document.canvas.height} fill={document.canvas.background} shadowColor="#111827" shadowBlur={18 / scale} shadowOpacity={0.15} /> : <Rect name="design-background" width={document.canvas.width} height={document.canvas.height} fill="#ffffff" opacity={0.72} stroke="#cbd1dc" strokeWidth={1 / scale} />}{document.nodes.map((node) => <RenderNode key={node.id} node={node} file={node.type === "image" ? filesById.get(node.fileId) : undefined} selected={selectedIds.includes(node.id)} canDrag={tool === "select"} onSelect={(add) => onSelect(node.id, add)} onChange={(changes) => changeRenderedNode(node, changes)} onReadyChange={handleImageReady} />)}{draftAbsolute.length > 1 ? <Line points={draftAbsolute.flatMap((point) => [point.x, point.y])} stroke={tool.includes("erase") ? "#f04438" : tool.includes("restore") ? "#12b76a" : drawColor} strokeWidth={(tool === "draw" || tool === "marker" ? drawWidth : brushRadius * (selectedImage()?.width ?? 100) * 2)} dash={tool.startsWith("lasso") ? [8 / scale, 6 / scale] : undefined} closed={tool.startsWith("lasso")} opacity={0.7} lineCap="round" lineJoin="round" /> : null}</Group></Group></Layer>
      <Layer ref={uiLayerRef}><Transformer ref={transformerRef} rotateEnabled enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right", "middle-left", "middle-right", "top-center", "bottom-center"]} borderStroke="#06a6c8" anchorStroke="#06a6c8" anchorFill="#ffffff" anchorSize={9} onTransformEnd={transformEnd} flipEnabled /></Layer>
    </Stage>
    <div className="design-stage__zoom"><button type="button" onClick={() => setZoom((value) => Math.max(0.1, value / 1.2))}>−</button><span>{Math.round(scale * 100)}%</span><button type="button" onClick={() => setZoom((value) => Math.min(8, value * 1.2))}>+</button><button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Fit</button></div>
  </div>;
});

DesignCanvasStage.displayName = "DesignCanvasStage";
