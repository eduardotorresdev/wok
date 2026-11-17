<script lang="ts" module>
	const PATHS = {
		cards:
			'M6.5 3h11A1.5 1.5 0 0 1 19 4.5v12a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 16.5v-12A1.5 1.5 0 0 1 6.5 3z M8 21h8',
		send: 'M21 3 10.5 13.5 M21 3l-6.5 18-4-7.5L3 9.5 21 3z',
		globe:
			'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c2.6 2.5 3.9 5.5 3.9 9s-1.3 6.5-3.9 9c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3z',
		doc: 'M7 3h7l4 4v12.5a1.5 1.5 0 0 1-1.5 1.500h-9.500A1.5 1.5 0 0 1 5.5 19.500v-15A1.5 1.5 0 0 1 7 3z M14 3v4h4 M9 12h6 M9 16h4',
		x: 'M6 6l12 12 M18 6 6 18',
		check: 'M5 12.500l4.5 4.500L19 7.5',
		sliders:
			'M4 7h9 M19 7h1 M4 17h1 M11 17h9 M13 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0z M5 17a3 3 0 1 0 6 0 3 3 0 0 0-6 0z',
		back: 'M15 5l-7 7 7 7',
		chevron: 'M9 5l7 7-7 7',
		down: 'M5 9l7 7 7-7',
		external:
			'M14 5h5v5 M19 5l-8 8 M11 7H6.500A1.5 1.5 0 0 0 5 8.500v9A1.5 1.5 0 0 0 6.5 19h9a1.5 1.5 0 0 0 1.5-1.500V13',
		keyboard:
			'M4.5 6h15A1.5 1.5 0 0 1 21 7.500v9a1.5 1.5 0 0 1-1.5 1.500h-15A1.5 1.5 0 0 1 3 16.500v-9A1.5 1.5 0 0 1 4.5 6z M7 10h.01 M11 10h.01 M15 10h.01 M8 14h8',
		refresh: 'M20 11a8 8 0 1 0-2.3 6.3 M20 5v6h-6',
		alert: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 8v5 M12 16.500h.01',
		upload: 'M12 16V4 M7 9l5-5 5 5 M5 20h14',
		plus: 'M12 5v14 M5 12h14',
		mail: 'M4.5 5h15A1.5 1.5 0 0 1 21 6.500v11a1.5 1.5 0 0 1-1.5 1.500h-15A1.5 1.5 0 0 1 3 17.500v-11A1.5 1.5 0 0 1 4.5 5z M3.5 7l8.5 6 8.5-6',
		pin: 'M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.3 12 21 12 21z M12 12.500a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
		clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7.500V12l3 2',
		lock: 'M7 11V8a5 5 0 0 1 10 0v3 M6.5 11h11A1.5 1.5 0 0 1 19 12.500v7a1.5 1.5 0 0 1-1.5 1.500h-11A1.5 1.5 0 0 1 5 19.500v-7A1.5 1.5 0 0 1 6.5 11z',
		logout: 'M10 4H6.500A1.5 1.5 0 0 0 5 5.500v13A1.5 1.5 0 0 0 6.5 20H10 M15 8l4 4-4 4 M19 12H9'
	} as const;
	export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
	let {
		name,
		size = 24,
		stroke = 1.6
	}: { name: IconName; size?: number; stroke?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={stroke}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	<path d={PATHS[name]} />
</svg>
