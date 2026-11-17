<!-- Folha que sobe da base da tela (bits-ui Dialog). -->
<script lang="ts">
	import { Dialog } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		open = $bindable(false),
		title,
		description,
		tall = false,
		children,
		footer
	}: {
		open?: boolean;
		title: string;
		description?: string;
		tall?: boolean;
		children: Snippet;
		footer?: Snippet;
	} = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="sheet-overlay fixed inset-0 z-50 bg-ink/35" />
		<Dialog.Content
			tabindex={-1}
			onOpenAutoFocus={(event) => {
				// Foco na folha, não no botão de fechar: sem anel de foco ao abrir por toque.
				event.preventDefault();
				(event.currentTarget as HTMLElement | null)?.focus?.();
			}}
			class="sheet fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-md flex-col rounded-t-md bg-paper shadow-lifted outline-none {tall
				? 'top-[calc(env(safe-area-inset-top)+20px)]'
				: 'max-h-[calc(100dvh-env(safe-area-inset-top)-20px)]'}"
		>
			<div class="flex shrink-0 items-start gap-2 pt-2 pr-2 pl-5">
				<div class="min-w-0 flex-1 pt-3">
					<Dialog.Title class="t-headline text-balance">{title}</Dialog.Title>
					{#if description}
						<Dialog.Description class="mt-1 text-[0.9375rem] text-ink-soft"
							>{description}</Dialog.Description
						>
					{/if}
				</div>
				<Dialog.Close class="btn-icon shrink-0" aria-label="Fechar">
					<Icon name="x" />
				</Dialog.Close>
			</div>
			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-6">
				{@render children()}
			</div>
			{#if footer}
				<div
					class="shrink-0 border-t border-line px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]"
				>
					{@render footer()}
				</div>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	:global(.sheet) {
		animation: sheet-in 320ms var(--ease-out-quart);
	}
	:global(.sheet[data-state='closed']) {
		animation: sheet-out 180ms ease-in forwards;
	}
	:global(.sheet-overlay) {
		animation: fade-in 200ms ease-out;
	}
	:global(.sheet-overlay[data-state='closed']) {
		animation: fade-out 180ms ease-in forwards;
	}
	@keyframes -global-sheet-in {
		from {
			transform: translateY(100%);
		}
	}
	@keyframes -global-sheet-out {
		to {
			transform: translateY(100%);
		}
	}
	@keyframes -global-fade-in {
		from {
			opacity: 0;
		}
	}
	@keyframes -global-fade-out {
		to {
			opacity: 0;
		}
	}
</style>
