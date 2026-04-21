import { useRef, useEffect, useCallback } from "react";
import { GameState, InputState } from "@/game/types";
import { render } from "@/game/renderer";
import { ARENA_WIDTH, ARENA_HEIGHT, CANVAS_BLEED } from "@/game/constants";

const CANVAS_WIDTH = ARENA_WIDTH + CANVAS_BLEED * 2;
const CANVAS_HEIGHT = ARENA_HEIGHT;

interface Props {
  gameState: GameState;
  inputRef: React.MutableRefObject<InputState>;
  onCanvasTap: (x: number, y: number) => void;
  onPointerUp?: () => void;
  controlMode?: string;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

const BattleCanvas = ({ gameState, inputRef, onCanvasTap, onPointerUp, controlMode, canvasRef }: Props) => {
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef?.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = (t: number) => {
      render(ctx, gameState, t);
      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState]);

  /** Convert client coords → arena coords, accounting for bleed offset */
  const getCanvasPos = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    // Pixel within the canvas bitmap
    const pxX = (clientX - rect.left) * (CANVAS_WIDTH / rect.width);
    const pxY = (clientY - rect.top) * (CANVAS_HEIGHT / rect.height);
    // Subtract bleed to get arena coordinate
    return {
      x: pxX - CANVAS_BLEED,
      y: pxY,
    };
  }, [canvasRef]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const pos = getCanvasPos(e.clientX, e.clientY);
    const input = inputRef.current;
    input.dragging = true;
    input.dragStartX = pos.x;
    input.dragStartY = pos.y;
    input.currentX = pos.x;
    input.currentY = pos.y;

    // Canvas tap for missile target selection & pro/pro_loose fire
    input.canvasTapped = true;
    input.tapX = pos.x;
    input.tapY = pos.y;
    onCanvasTap(pos.x, pos.y);
  }, [getCanvasPos, inputRef, onCanvasTap]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!inputRef.current.dragging) return;
    const pos = getCanvasPos(e.clientX, e.clientY);
    const input = inputRef.current;
    input.currentX = pos.x;

    const dy = pos.y - input.dragStartY;
    input.swipeUpHeld = dy < -30;
    input.swipeDownHeld = dy > 30;
  }, [getCanvasPos, inputRef]);

  const handlePointerUp = useCallback(() => {
    const input = inputRef.current;
    input.dragging = false;
    input.canvasTapped = false;
    input.swipeUpHeld = false;
    input.swipeDownHeld = false;
    onPointerUp?.();
  }, [inputRef, onPointerUp]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="touch-none"
      style={{
        height: '100%',
        aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}`,
        maxWidth: '100%',
        maxHeight: '100%',
        margin: '0 auto',
        display: 'block',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitTapHighlightColor: 'transparent',
        WebkitUserDrag: 'none',
      } as React.CSSProperties}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
};

export default BattleCanvas;
