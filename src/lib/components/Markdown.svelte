<!--
	Markdown lido como texto, sem HTML: títulos, listas, parágrafos, negrito, itálico e código.
	Nada do documento vira marcação, então não há o que sanitizar.
-->
<script lang="ts">
	type Inline = { text: string; kind: 'plain' | 'strong' | 'em' | 'code' };
	type Block =
		| { kind: 'heading'; level: number; inline: Inline[] }
		| { kind: 'list'; ordered: boolean; items: Inline[][] }
		| { kind: 'text'; inline: Inline[] };

	let { source }: { source: string } = $props();

	function inline(text: string): Inline[] {
		const parts: Inline[] = [];
		const pattern = /\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|\*([^*\s][^*]*?)\*|_([^_\s][^_]*?)_/g;
		let last = 0;
		for (const match of text.matchAll(pattern)) {
			if (match.index > last) parts.push({ text: text.slice(last, match.index), kind: 'plain' });
			if (match[1] ?? match[2]) parts.push({ text: match[1] ?? match[2], kind: 'strong' });
			else if (match[3]) parts.push({ text: match[3], kind: 'code' });
			else parts.push({ text: match[4] ?? match[5], kind: 'em' });
			last = match.index + match[0].length;
		}
		if (last < text.length) parts.push({ text: text.slice(last), kind: 'plain' });
		return parts;
	}

	const blocks = $derived.by(() => {
		const out: Block[] = [];
		let paragraph: string[] = [];
		const flush = () => {
			if (paragraph.length) out.push({ kind: 'text', inline: inline(paragraph.join(' ')) });
			paragraph = [];
		};
		for (const raw of source.split('\n')) {
			const line = raw.trim();
			const heading = line.match(/^(#{1,6})\s+(.*)$/);
			const item = line.match(/^([-*+]|\d+[.)])\s+(.*)$/);
			if (!line) flush();
			else if (heading) {
				flush();
				out.push({ kind: 'heading', level: heading[1].length, inline: inline(heading[2]) });
			} else if (item) {
				flush();
				const ordered = /\d/.test(item[1]);
				const prev = out.at(-1);
				if (prev?.kind === 'list' && prev.ordered === ordered) prev.items.push(inline(item[2]));
				else out.push({ kind: 'list', ordered, items: [inline(item[2])] });
			} else paragraph.push(line);
		}
		flush();
		return out;
	});
</script>

{#snippet run(parts: Inline[])}
	{#each parts as part, i (i)}
		{#if part.kind === 'strong'}<strong class="font-semibold">{part.text}</strong
			>{:else if part.kind === 'em'}<em>{part.text}</em>{:else if part.kind === 'code'}<code
				class="rounded-sm bg-band px-1 font-mono text-[0.875em]">{part.text}</code
			>{:else}{part.text}{/if}
	{/each}
{/snippet}

<div class="md">
	{#each blocks as block, i (i)}
		{#if block.kind === 'heading'}
			{#if block.level === 1}
				<h2 class="t-headline">{@render run(block.inline)}</h2>
			{:else if block.level === 2}
				<h3 class="t-title">{@render run(block.inline)}</h3>
			{:else}
				<h4 class="text-[0.9375rem] font-semibold">{@render run(block.inline)}</h4>
			{/if}
		{:else if block.kind === 'list'}
			<svelte:element this={block.ordered ? 'ol' : 'ul'} class={block.ordered ? 'ordered' : 'dots'}>
				{#each block.items as item, j (j)}<li>{@render run(item)}</li>{/each}
			</svelte:element>
		{:else}
			<p>{@render run(block.inline)}</p>
		{/if}
	{/each}
</div>

<style>
	.md {
		font-size: 0.9375rem;
		line-height: 1.6;
		overflow-wrap: anywhere;
	}
	.md > :global(* + *) {
		margin-top: 0.6rem;
	}
	.md > :global(h2:not(:first-child)),
	.md > :global(h3:not(:first-child)) {
		margin-top: 1.5rem;
	}
	.md > :global(h4:not(:first-child)) {
		margin-top: 1rem;
	}
	.md :global(ul),
	.md :global(ol) {
		padding-left: 1.25rem;
	}
	.md :global(ul) {
		list-style: disc;
	}
	.md :global(ol) {
		list-style: decimal;
	}
	.md :global(li + li) {
		margin-top: 0.25rem;
	}
	.md :global(li::marker) {
		color: var(--color-primary);
	}
</style>
