<!-- Status de uma inscrição: marca + rótulo. Os estados em andamento pulsam. -->
<script lang="ts">
	import { STATUS_LABEL } from '#lib/client/format.ts';
	import type { ApplicationStatus } from '#lib/client/types.ts';
	import Icon from './Icon.svelte';

	let { status }: { status: ApplicationStatus } = $props();

	const tone = $derived(
		{
			queued: 'text-ink-soft',
			tailoring: 'text-primary-deep',
			applying: 'text-primary-deep',
			needs_user: 'bg-primary-tint text-primary-deep px-2',
			submitted: 'text-ink',
			failed: 'text-danger'
		}[status]
	);
</script>

<span
	class="inline-flex min-h-6 items-center gap-1.5 rounded-sm text-[0.8125rem] leading-none font-medium {tone}"
>
	{#if status === 'tailoring' || status === 'applying'}
		<span class="live" aria-hidden="true"></span>
	{:else if status === 'queued'}
		<Icon name="clock" size={15} />
	{:else if status === 'needs_user'}
		<Icon name="alert" size={15} />
	{:else if status === 'submitted'}
		<span class="text-primary"><Icon name="check" size={16} stroke={2.4} /></span>
	{:else}
		<Icon name="x" size={15} stroke={2} />
	{/if}
	{STATUS_LABEL[status]}
</span>

<style>
	.live {
		width: 8px;
		height: 8px;
		margin: 0 3px;
		border-radius: 50%;
		background: var(--color-primary);
		animation: live 1.4s ease-in-out infinite;
	}
	@keyframes live {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(116, 70, 196, 0.45);
		}
		60% {
			box-shadow: 0 0 0 6px rgba(116, 70, 196, 0);
		}
	}
</style>
