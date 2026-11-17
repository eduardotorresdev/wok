<!--
	Pilha de vagas com gesto real: pointer events, rotação conforme o ponto de pega,
	limiar por distância ou velocidade, fling com a velocidade do dedo e snap-back com mola.
-->
<script lang="ts">
	import type { Job, SwipeDirection } from '#lib/client/types.ts';
	import JobCard from './JobCard.svelte';

	interface Pose {
		x: number;
		y: number;
		rot: number;
	}
	interface Ghost {
		job: Job;
		direction: SwipeDirection;
		from: Pose;
		to: Pose;
		duration: number;
	}

	let {
		jobs,
		onswipe,
		onopen,
		allow = () => true
	}: {
		jobs: Job[];
		onswipe: (job: Job, direction: SwipeDirection) => void;
		onopen: (job: Job) => void;
		/** Veto antes de confirmar (ex.: aviso único da primeira inscrição). */
		allow?: (job: Job, direction: SwipeDirection) => boolean;
	} = $props();

	let width = $state(360);
	let dx = $state(0);
	let dy = $state(0);
	let grab = $state(1);
	let dragging = $state(false);
	let ghosts = $state.raw<Ghost[]>([]);

	// Um card em voo já saiu da pilha, mesmo antes de o cache confirmar.
	const stack = $derived(
		jobs.filter((job) => !ghosts.some((g) => g.job.id === job.id)).slice(0, 3)
	);
	const threshold = $derived(Math.min(130, width * 0.3));
	const lean = $derived(Math.max(-1, Math.min(1, dx / threshold)));
	const pull = $derived(Math.abs(lean));

	let pointer: number | null = null;
	let startX = 0;
	let startY = 0;
	let moved = false;
	let armed = false;
	let swallowClick = false;
	let samples: { t: number; x: number; y: number }[] = [];

	const SLOP = 8;
	const FLICK = 0.45; // px/ms

	function buzz(ms: number) {
		try {
			navigator.vibrate?.(ms);
		} catch {
			// sem haptics neste aparelho
		}
	}

	function reset() {
		dragging = false;
		dx = 0;
		dy = 0;
		armed = false;
	}

	function commit(job: Job, direction: SwipeDirection, from: Pose, vx = 0, vy = 0) {
		const sign = direction === 'apply' ? 1 : -1;
		const toX = sign * (width * 1.5 + 80);
		const speed = Math.max(Math.abs(vx), 1.4);
		const duration = Math.max(170, Math.min(360, Math.abs(toX - from.x) / speed));
		const ghost: Ghost = {
			job,
			direction,
			from,
			to: { x: toX, y: from.y + vy * duration * 0.35 + 24, rot: from.rot + sign * 14 },
			duration
		};
		ghosts = [...ghosts, ghost];
		reset();
		buzz(14);
		onswipe(job, direction);
	}

	/** Usado pelos botões de apoio e pela folha de detalhes. */
	export function swipe(direction: SwipeDirection, job: Job | undefined = stack[0]) {
		if (!job || !allow(job, direction)) return;
		commit(job, direction, { x: 0, y: 0, rot: 0 });
	}

	function down(event: PointerEvent) {
		if (!event.isPrimary || event.button !== 0 || pointer !== null) return;
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		pointer = event.pointerId;
		startX = event.clientX;
		startY = event.clientY;
		moved = false;
		swallowClick = false;
		// Pegar pela metade de baixo gira o papel ao contrário, como uma folha de verdade.
		grab = event.clientY > rect.top + rect.height / 2 ? -1 : 1;
		samples = [{ t: event.timeStamp, x: event.clientX, y: event.clientY }];
	}

	function move(event: PointerEvent) {
		if (event.pointerId !== pointer) return;
		const mx = event.clientX - startX;
		const my = event.clientY - startY;
		if (!moved) {
			if (Math.hypot(mx, my) < SLOP) return;
			moved = true;
			dragging = true;
			swallowClick = true;
			try {
				(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
			} catch {
				// ponteiro já solto: o gesto segue pelos eventos do próprio card
			}
		}
		dx = mx;
		dy = my * 0.4;
		samples.push({ t: event.timeStamp, x: event.clientX, y: event.clientY });
		if (samples.length > 6) samples.shift();

		const nowArmed = Math.abs(dx) > threshold;
		if (nowArmed !== armed) {
			armed = nowArmed;
			if (armed) buzz(8);
		}
	}

	function velocity(now: number) {
		const recent = samples.filter((s) => now - s.t < 110);
		if (recent.length < 2) return { vx: 0, vy: 0 };
		const first = recent[0];
		const last = recent[recent.length - 1];
		const dt = Math.max(1, last.t - first.t);
		return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
	}

	function up(event: PointerEvent, job: Job) {
		if (event.pointerId !== pointer) return;
		pointer = null;
		if (!moved) return; // toque simples: o click nativo abre os detalhes
		const { vx, vy } = velocity(event.timeStamp);
		const flick = Math.abs(vx) > FLICK && Math.sign(vx) === Math.sign(dx) && Math.abs(dx) > 28;
		if (Math.abs(dx) > threshold || flick) {
			const direction: SwipeDirection = dx > 0 ? 'apply' : 'skip';
			if (allow(job, direction)) {
				commit(job, direction, { x: dx, y: dy, rot: rotation(dx) }, vx, vy);
				return;
			}
		}
		reset();
	}

	function cancel(event: PointerEvent) {
		if (event.pointerId !== pointer) return;
		pointer = null;
		reset();
	}

	function click(event: MouseEvent, job: Job) {
		if (swallowClick) {
			swallowClick = false;
			event.preventDefault();
			return;
		}
		onopen(job);
	}

	const rotation = (x: number) => (x / width) * 13 * grab;
	const css = (p: Pose) => `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rot}deg)`;

	function pose(index: number) {
		if (index === 0) return css({ x: dx, y: dy, rot: rotation(dx) });
		const rest = 1 - pull;
		if (index === 1) {
			return `translate3d(0, ${13 * rest}px, 0) rotate(${-1.6 * rest}deg) scale(${0.955 + 0.045 * pull})`;
		}
		return `translate3d(0, ${26 - 13 * pull}px, 0) rotate(${1.9 - 3.5 * pull}deg) scale(${0.91 + 0.045 * pull})`;
	}

	function flyOut(node: HTMLElement, ghost: Ghost) {
		const done = () => (ghosts = ghosts.filter((g) => g !== ghost));
		const animation = node.animate([{ transform: css(ghost.from) }, { transform: css(ghost.to) }], {
			duration: ghost.duration,
			easing: 'cubic-bezier(0.3, 0.4, 0.5, 1)',
			fill: 'forwards'
		});
		animation.finished.then(done, done);
		return { destroy: () => animation.cancel() };
	}
</script>

<div class="deck" bind:clientWidth={width}>
	{#each stack as job, index (job.id)}
		<div
			class="slot"
			class:top={index === 0}
			class:dragging
			style="transform: {pose(index)}; z-index: {3 - index}"
			inert={index > 0}
			aria-hidden={index > 0}
			role={index === 0 ? 'group' : undefined}
			aria-label={index === 0 ? `Vaga: ${job.title}, ${job.company}` : undefined}
			onpointerdown={index === 0 ? down : undefined}
			onpointermove={index === 0 ? move : undefined}
			onpointerup={index === 0 ? (e) => up(e, job) : undefined}
			onpointercancel={index === 0 ? cancel : undefined}
			onclick={index === 0 ? (e) => click(e, job) : undefined}
		>
			<JobCard {job} lean={index === 0 ? lean : 0} interactive={index === 0} />
		</div>
	{/each}

	{#each ghosts as ghost (ghost.job.id)}
		<div class="slot ghost" use:flyOut={ghost} aria-hidden="true" inert>
			<JobCard job={ghost.job} lean={ghost.direction === 'apply' ? 1 : -1} interactive={false} />
		</div>
	{/each}
</div>

<style>
	.deck {
		position: relative;
		width: 100%;
		height: 100%;
	}
	.slot {
		position: absolute;
		inset: 0;
		transform-origin: 50% 60%;
		transition: transform 380ms var(--ease-spring);
		will-change: transform;
	}
	.slot.dragging {
		transition: none;
	}
	.slot.top {
		touch-action: none;
		cursor: grab;
	}
	.slot.top.dragging {
		cursor: grabbing;
	}
	.slot.top.dragging :global(.paper) {
		box-shadow: var(--shadow-lifted);
	}
	.slot :global(.paper) {
		transition: box-shadow 200ms;
	}
	.ghost {
		z-index: 5;
		pointer-events: none;
		transition: none;
	}
</style>
