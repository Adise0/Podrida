import { avatarLimits, type AvatarCrop } from "@podrida/shared";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import styled from "styled-components";
import { clampCrop, type AvatarSource } from "../lib/avatarImage";
import { Button } from "./ui/Button";
import { MutedText } from "./ui/Card";
import { Modal } from "./ui/Modal";
import { Row, Stack } from "./ui/layout";

const Stage = styled.div`
  position: relative;
  width: 100%;
  max-width: 320px;
  aspect-ratio: 1;
  margin: 0 auto;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.feltDeep};
  cursor: grab;
  touch-action: none;
  user-select: none;

  &:active {
    cursor: grabbing;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.focus};
    outline-offset: 2px;
  }

  img {
    position: absolute;
    top: 0;
    left: 0;
    max-width: none;
    transform-origin: 0 0;
    pointer-events: none;
  }
`;

// Dims everything outside the circle: what's inside is the avatar as others will see it.
const CircleMask = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 50%;
  box-shadow: 0 0 0 9999px rgba(5, 20, 15, 0.6);
  outline: 2px solid rgba(255, 255, 255, 0.85);
  outline-offset: -2px;
  pointer-events: none;
`;

const ZoomRow = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space(3)};
  font-size: 14px;
  font-weight: 600;

  input {
    flex: 1;
    accent-color: ${({ theme }) => theme.colors.accent};
  }
`;

interface AvatarEditorProps {
  source: AvatarSource | null; // Open while there's one.
  initialCrop: AvatarCrop;
  isPending?: boolean;
  error?: ReactNode;
  onCancel: () => void;
  onConfirm: (crop: AvatarCrop) => void;
}

type Point = { x: number; y: number };

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

// Drag (or the arrow keys) to move the picture, scroll, pinch or the slider to zoom.
export function AvatarEditor({
  source,
  initialCrop,
  isPending = false,
  error,
  onCancel,
  onConfirm,
}: AvatarEditorProps) {
  return (
    <Modal
      isOpen={source !== null}
      title="Frame your picture"
      onClose={isPending ? () => {} : onCancel}
    >
      {source && (
        <EditorBody
          // A new picture starts over from its own crop.
          key={source.dataUrl}
          source={source}
          initialCrop={initialCrop}
          isPending={isPending}
          error={error}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      )}
    </Modal>
  );
}

function EditorBody({
  source,
  initialCrop,
  isPending,
  error,
  onCancel,
  onConfirm,
}: AvatarEditorProps & { source: AvatarSource }) {
  const { naturalWidth: width, naturalHeight: height } = source.image;
  const [crop, setCrop] = useState(() => clampCrop(initialCrop, width, height));
  const [stageSize, setStageSize] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());

  // Screen pixels per source pixel at the current zoom: zoom 1 fits the short side to the stage.
  const scale = (stageSize / Math.min(width, height)) * crop.zoom;

  const update = (next: (current: AvatarCrop) => AvatarCrop) =>
    setCrop((current) => clampCrop(next(current), width, height));

  // Moving the picture by (dx, dy) screen pixels moves the crop's center the other way.
  const pan = (dx: number, dy: number) =>
    update((current) => {
      const currentScale = (stageSize / Math.min(width, height)) * current.zoom;
      return {
        ...current,
        x: current.x - dx / (width * currentScale),
        y: current.y - dy / (height * currentScale),
      };
    });

  const zoomBy = (factor: number) =>
    update((current) => ({ ...current, zoom: current.zoom * factor }));

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    const observer = new ResizeObserver(([entry]) => setStageSize(entry.contentRect.width));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // React's wheel listener is passive, and the page would scroll along with the zoom.
  const zoomByRef = useRef(zoomBy);
  useLayoutEffect(() => {
    zoomByRef.current = zoomBy;
  });
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomByRef.current(Math.exp(-event.deltaY * 0.0015));
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;

    const point = { x: event.clientX, y: event.clientY };
    const others = [...pointers.current.entries()].filter(([id]) => id !== event.pointerId);

    if (others.length === 0) {
      pan(point.x - previous.x, point.y - previous.y);
    } else {
      // Two fingers: zoom by how much further apart they got.
      const other = others[0][1];
      const before = distance(previous, other);
      if (before > 0) zoomBy(distance(point, other) / before);
    }

    pointers.current.set(event.pointerId, point);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 40 : 10;
    const actions: Record<string, () => void> = {
      ArrowLeft: () => pan(step, 0),
      ArrowRight: () => pan(-step, 0),
      ArrowUp: () => pan(0, step),
      ArrowDown: () => pan(0, -step),
      "+": () => zoomBy(1.1),
      "=": () => zoomBy(1.1),
      "-": () => zoomBy(1 / 1.1),
    };

    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  return (
    <Stack>
      <Stage
        ref={stageRef}
        tabIndex={0}
        role="application"
        aria-label="Picture framing. Arrow keys move it, plus and minus zoom."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        {stageSize > 0 && (
          <img
            src={source.dataUrl}
            alt=""
            draggable={false}
            style={{
              width: width * scale,
              height: height * scale,
              transform: `translate(${stageSize / 2 - crop.x * width * scale}px, ${
                stageSize / 2 - crop.y * height * scale
              }px)`,
            }}
          />
        )}
        <CircleMask />
      </Stage>

      <ZoomRow>
        Zoom
        <input
          type="range"
          min={1}
          max={avatarLimits.maxZoom}
          step={0.01}
          value={crop.zoom}
          onChange={(event) =>
            update((current) => ({ ...current, zoom: Number(event.target.value) }))
          }
        />
      </ZoomRow>
      <MutedText>Drag to move it. Scroll, pinch or use the slider to zoom.</MutedText>

      {error}

      <Row $justify="flex-end">
        <Button variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button onClick={() => onConfirm(crop)} loading={isPending}>
          Use this picture
        </Button>
      </Row>
    </Stack>
  );
}
