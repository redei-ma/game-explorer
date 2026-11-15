import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	ElementRef,
	afterNextRender,
	inject,
	viewChild,
} from '@angular/core';

interface Star {
	x: number; y: number;// base position
	vx: number; vy: number;// slow drift (px per frame at 60fps)
	ox: number; oy: number;// displacement caused by the pointer
	ovx: number; ovy: number;// displacement velocity
	r: number;
	phase: number;
	speed: number;
	rgb: string;// "r,g,b"
}

const LINK_DISTANCE = 110;
const POINTER_RADIUS = 140;
const PUSH = 1.6;
const SPRING = 0.02;
const DAMPING = 0.92;
const GLOW_FACTOR = 4;// glow radius = star radius * this
const FREE_RATIO = 0.5;// stars without lines, relative to the linked ones

function toRgb(hex: string): string | null {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
	if (!m) return null;
	const n = parseInt(m[1], 16);
	return `${n >> 16},${(n >> 8) & 255},${n & 255}`;
}

/* Starry-sky hero background: drifting stars, some joined by faint lines and
   some free. Stars move away from the pointer and spring back. Decorative only. */
@Component({
	selector: 'app-hero-particles',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `<canvas #canvas aria-hidden="true"></canvas>`,
	styles: `
		:host { position: absolute; inset: 0; display: block; pointer-events: none; }
		canvas { display: block; width: 100%; height: 100%; }
	`,
})
export class HeroParticles {
	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
	private readonly destroyRef = inject(DestroyRef);
	private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

	constructor() {
		afterNextRender(() => this.start());
	}

	private start(): void {
		const canvas = this.canvasRef().nativeElement;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// The host is pointer-events: none, so pointer events are read from the hero (parent)
		const surface = this.host.parentElement ?? this.host;

		// Colors come from the design tokens: yellow stars, pale blue stars and lines
		const css = getComputedStyle(this.host);
		const warm = toRgb(css.getPropertyValue('--ge-accent')) ?? '252,211,77';
		const cool = toRgb(css.getPropertyValue('--ge-blue-soft')) ?? '159,179,200';

		const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
		let reduceMotion = motionQuery?.matches ?? false;
		let inView = true;
		let width = 0;
		let height = 0;
		let frameId = 0;
		let lastTime = 0;
		const pointer = { x: 0, y: 0, active: false };
		const linked: Star[] = [];// joined by lines
		const free: Star[] = [];// no lines
		const groups = [linked, free];

		const spawn = (): Star => ({
			x: Math.random() * width,
			y: Math.random() * height,
			vx: (Math.random() - 0.5) * 0.25,
			vy: (Math.random() - 0.5) * 0.25,
			ox: 0, oy: 0, ovx: 0, ovy: 0,
			r: 0.8 + Math.random() ** 2 * 2.5,
			phase: Math.random() * Math.PI * 2,
			speed: 0.6 + Math.random() * 1.2,
			rgb: Math.random() < 0.6 ? warm : cool,
		});

		const step = (dt: number): void => {
			const damping = DAMPING ** dt;
			for (const group of groups) {
				for (const s of group) {
					s.x += s.vx * dt;
					s.y += s.vy * dt;
					if (s.x < -10) s.x = width + 10; else if (s.x > width + 10) s.x = -10;
					if (s.y < -10) s.y = height + 10; else if (s.y > height + 10) s.y = -10;

					if (pointer.active) {
						const dx = s.x + s.ox - pointer.x;
						const dy = s.y + s.oy - pointer.y;
						const d = Math.hypot(dx, dy);
						if (d < POINTER_RADIUS && d > 0.001) {
							const f = 1 - d / POINTER_RADIUS;
							const push = f * f * PUSH * dt;
							s.ovx += (dx / d) * push;
							s.ovy += (dy / d) * push;
						}
					}
					s.ovx = (s.ovx - s.ox * SPRING * dt) * damping;
					s.ovy = (s.ovy - s.oy * SPRING * dt) * damping;
					s.ox += s.ovx * dt;
					s.oy += s.ovy * dt;
				}
			}
		};

		const drawStar = (s: Star, time: number): void => {
			const alpha = 0.55 + 0.45 * Math.sin(time * 0.001 * s.speed + s.phase);
			const x = s.x + s.ox;
			const y = s.y + s.oy;
			const glowRadius = s.r * GLOW_FACTOR;

			const glow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
			glow.addColorStop(0, `rgba(${s.rgb},${alpha * 0.4})`);
			glow.addColorStop(1, `rgba(${s.rgb},0)`);
			ctx.fillStyle = glow;
			ctx.beginPath();
			ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
			ctx.fill();

			ctx.fillStyle = `rgba(${s.rgb},${alpha})`;
			ctx.beginPath();
			ctx.arc(x, y, s.r, 0, Math.PI * 2);
			ctx.fill();
		};

		const draw = (time: number): void => {
			ctx.clearRect(0, 0, width, height);

			// Lines only between the linked stars
			ctx.lineWidth = 0.6;
			for (let i = 0; i < linked.length; i++) {
				const a = linked[i];
				const ax = a.x + a.ox;
				const ay = a.y + a.oy;
				for (let j = i + 1; j < linked.length; j++) {
					const b = linked[j];
					const dx = ax - (b.x + b.ox);
					const dy = ay - (b.y + b.oy);
					const d2 = dx * dx + dy * dy;
					if (d2 > LINK_DISTANCE * LINK_DISTANCE) continue;
					const alpha = (1 - Math.sqrt(d2) / LINK_DISTANCE) * 0.25;
					ctx.strokeStyle = `rgba(${cool},${alpha})`;
					ctx.beginPath();
					ctx.moveTo(ax, ay);
					ctx.lineTo(b.x + b.ox, b.y + b.oy);
					ctx.stroke();
				}
			}

			for (const group of groups) {
				for (const s of group) drawStar(s, time);
			}
		};

		const fit = (group: Star[], target: number): void => {
			group.length = Math.min(group.length, target);
			while (group.length < target) group.push(spawn());
		};

		const resize = (): void => {
			const rect = this.host.getBoundingClientRect();
			if (!rect.width || !rect.height) return;
			const sx = width ? rect.width / width : 1;
			const sy = height ? rect.height / height : 1;
			width = rect.width;
			height = rect.height;
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			for (const group of groups) {
				for (const s of group) { s.x *= sx; s.y *= sy; }
			}
			const target = Math.round(Math.min(80, Math.max(25, (width * height) / 12000)));
			fit(linked, target);
			fit(free, Math.round(target * FREE_RATIO));
			if (reduceMotion) draw(0);
		};

		const frame = (now: number): void => {
			const dt = Math.min((now - lastTime) / 16.667, 3);
			lastTime = now;
			step(dt);
			draw(now);
			frameId = requestAnimationFrame(frame);
		};

		// Runs only while the hero is visible, the tab is active and motion is allowed
		const sync = (): void => {
			const shouldRun = inView && !document.hidden && !reduceMotion;
			if (shouldRun && !frameId) {
				lastTime = performance.now();
				frameId = requestAnimationFrame(frame);
			} else if (!shouldRun && frameId) {
				cancelAnimationFrame(frameId);
				frameId = 0;
			}
		};

		const onMove = (e: PointerEvent): void => {
			const rect = this.host.getBoundingClientRect();
			pointer.x = e.clientX - rect.left;
			pointer.y = e.clientY - rect.top;
			pointer.active = true;
		};
		const onLeave = (): void => { pointer.active = false; };
		const onMotionChange = (e: MediaQueryListEvent): void => {
			reduceMotion = e.matches;
			sync();
			if (reduceMotion) draw(0);
		};

		const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
		const intersectionObserver = typeof IntersectionObserver !== 'undefined'
			? new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); })
			: null;

		surface.addEventListener('pointermove', onMove, { passive: true });
		surface.addEventListener('pointerleave', onLeave);
		surface.addEventListener('pointercancel', onLeave);
		document.addEventListener('visibilitychange', sync);
		motionQuery?.addEventListener('change', onMotionChange);
		resizeObserver?.observe(this.host);
		intersectionObserver?.observe(this.host);

		this.destroyRef.onDestroy(() => {
			if (frameId) cancelAnimationFrame(frameId);
			surface.removeEventListener('pointermove', onMove);
			surface.removeEventListener('pointerleave', onLeave);
			surface.removeEventListener('pointercancel', onLeave);
			document.removeEventListener('visibilitychange', sync);
			motionQuery?.removeEventListener('change', onMotionChange);
			resizeObserver?.disconnect();
			intersectionObserver?.disconnect();
		});

		resize();
		sync();
	}
}