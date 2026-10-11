'use client';

import { motion, useDragControls, useReducedMotion, type PanInfo } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';

const project = (v: number) => ((v / 1000) * 0.998) / (1 - 0.998);

/**
 * Liquid-glass sheet that rises out of the dock. Drag the grabber to dismiss: a flick is judged
 * by where it is heading, and a half-hearted drag springs back. Esc and the scrim also close it.
 */
export default function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const reduce = useReducedMotion();
  const controls = useDragControls();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y + project(info.velocity.y) > 150) onClose();
  };

  const enter = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { y: 70, opacity: 0, scale: 0.92, filter: 'blur(14px)' },
        animate: { y: 0, opacity: 1, scale: 1, filter: 'blur(0px)' },
        exit: { y: 70, opacity: 0, scale: 0.94, filter: 'blur(10px)' },
      };

  return (
    <>
      <motion.div
        className="scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
      />
      <motion.section
        className="sheet lg refract-lg"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        {...enter}
        transition={reduce ? { duration: 0.15 } : { type: 'spring', bounce: 0.08, duration: 0.55 }}
        drag={reduce ? false : 'y'}
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0.04, bottom: 1 }}
        dragMomentum={false}
        dragSnapToOrigin
        onDragEnd={onDragEnd}
      >
        <div className="sheet-handle" onPointerDown={(e) => controls.start(e)} aria-hidden>
          <span />
        </div>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="close-gel" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </motion.section>
    </>
  );
}
