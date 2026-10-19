'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Dialog } from './Dialog';
import { HorseAvatar } from './HorseAvatar';

export function HorsePhotoPicker({ horse, value, onChange, onBusyChange }: {
  horse?: { id: string; name: string; photo?: string | null }; value: Blob | null | undefined; onChange: (value: Blob | null) => void; onBusyChange: (busy: boolean) => void;
}) {
  const [image, setImage] = useState<ImageBitmap | null>(null);
  const [preview, setPreview] = useState('');
  const [zoom, setZoom] = useState(1), [x, setX] = useState(50), [y, setY] = useState(50);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  useEffect(() => { return () => { generation.current++; }; }, []);
  useEffect(() => () => image?.close(), [image]);
  useEffect(() => {
    if (!value) { setPreview(''); return; }
    const url = URL.createObjectURL(value); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!image || !context) return;
    const side = Math.min(image.width, image.height) / zoom;
    context.fillStyle = '#fff'; context.fillRect(0, 0, 640, 640);
    context.drawImage(image, (image.width - side) * x / 100, (image.height - side) * y / 100, side, side, 0, 0, 640, 640);
  }, [image, zoom, x, y]);
  async function select(selected?: File) {
    if (!selected) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) { setError('Choose a JPEG, PNG, or WebP photo.'); return; }
    if (selected.size > 8 * 1024 * 1024) { setError('Choose a photo smaller than 8 MB.'); return; }
    const current = ++generation.current;
    setBusy(true);
    try {
      const decoded = await createImageBitmap(selected, { imageOrientation: 'from-image' });
      if (current !== generation.current) { decoded.close(); return; }
      if (decoded.width * decoded.height > 24_000_000 || Math.min(decoded.width, decoded.height) < 100) {
        decoded.close(); throw new Error('Choose a photo at least 100 pixels on each side and no larger than 24 megapixels.');
      }
      setImage(decoded); setZoom(1); setX(50); setY(50);
    } catch (error) { if (current === generation.current) setError(error instanceof Error && error.message.startsWith('Choose') ? error.message : 'This photo could not be opened. Try a JPEG, PNG, or WebP image.'); }
    finally { if (current === generation.current) setBusy(false); }
  }
  async function usePhoto() {
    setBusy(true); setError('');
    try {
      let blob: Blob | null = null;
      for (const quality of [0.85, 0.7, 0.5]) {
        blob = await new Promise(resolve => canvas.current!.toBlob(resolve, 'image/jpeg', quality));
        if (blob && blob.size <= 256 * 1024) break;
      }
      if (!blob || blob.size > 256 * 1024) throw new Error('This crop is too detailed. Zoom in a little more and try again.');
      onChange(blob); setImage(null);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not prepare this photo.'); }
    finally { setBusy(false); }
  }
  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current || !image) return;
    const side = Math.min(image.width, image.height) / zoom;
    const scale = side / event.currentTarget.getBoundingClientRect().width;
    const clamp = (value: number) => Math.max(0, Math.min(100, value));
    if (image.width > side) setX(clamp(drag.current.left - (event.clientX - drag.current.x) * scale / (image.width - side) * 100));
    if (image.height > side) setY(clamp(drag.current.top - (event.clientY - drag.current.y) * scale / (image.height - side) * 100));
  }
  const hasPhoto = value instanceof Blob || (value === undefined && Boolean(horse?.photo));
  return <div className="sm:col-span-2">
    <p className="mb-3 text-sm font-semibold">Horse photo</p>
    <div className="flex flex-wrap items-center gap-4">
      {preview ? <img src={preview} alt="Cropped horse photo preview" width={96} height={96} className="h-24 w-24 rounded-2xl object-cover" /> :
        <HorseAvatar id={horse?.id ?? ''} name={horse?.name ?? 'Horse'} photo={value === null ? null : horse?.photo} className="flex h-24 w-24 items-center justify-center rounded-2xl bg-[#dce7df] font-display text-4xl text-[#315c47]" />}
      <div><input ref={file} aria-label="Choose horse photo" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { void select(event.target.files?.[0]); event.target.value = ''; }} />
        <div className="flex flex-wrap gap-2"><button type="button" className="button-secondary" disabled={busy} onClick={() => file.current?.click()}>{busy ? 'Opening…' : hasPhoto ? 'Change photo' : 'Add photo'}</button>
          {hasPhoto && <button type="button" className="button-secondary" disabled={busy} onClick={() => onChange(null)}>Remove photo</button>}</div>
        <p className="mt-2 text-xs font-normal text-[#68736b]">JPEG, PNG or WebP · up to 8 MB. Crop before saving.</p>
        {value !== undefined && <p className="mt-1 text-xs font-normal text-[#315c47]">{value === null ? 'Photo will be removed when you save.' : 'Photo ready. Save the profile to apply it.'}</p>}
      </div>
    </div>
    {error && <p role="alert" className="form-error mt-2 text-xs">{error}</p>}
    {image && <Dialog title="Crop horse photo" busy={busy} onClose={() => setImage(null)}>
      <p className="mb-4 text-sm text-[#68736b]">Drag to position your horse, or use the sliders below.</p>
      <canvas ref={canvas} width={640} height={640} aria-label="Horse photo crop preview" className="mx-auto aspect-square w-full max-w-60 sm:max-w-80 touch-none cursor-grab rounded-2xl bg-white" onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, left: x, top: y }; }} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
      <div className="reinwell-form mt-5 grid gap-3"><label>Zoom<input type="range" className="!h-6 !min-h-0 !p-0" min={1} max={3} step={0.01} value={zoom} disabled={busy} onChange={event => setZoom(Number(event.target.value))} /></label>
        <label>Horizontal position<input type="range" className="!h-6 !min-h-0 !p-0" min={0} max={100} value={x} disabled={busy} onChange={event => setX(Number(event.target.value))} /></label>
        <label>Vertical position<input type="range" className="!h-6 !min-h-0 !p-0" min={0} max={100} value={y} disabled={busy} onChange={event => setY(Number(event.target.value))} /></label></div>
      {error && <p role="alert" className="form-error mt-3">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-3"><button type="button" className="button-primary" disabled={busy} onClick={usePhoto}>{busy ? 'Preparing…' : 'Use photo'}</button><button type="button" className="button-secondary" disabled={busy} onClick={() => setImage(null)}>Cancel crop</button></div>
    </Dialog>}
  </div>;
}
