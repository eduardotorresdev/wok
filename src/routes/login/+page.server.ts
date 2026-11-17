import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Quem já tem sessão não vê o formulário: vai direto para o destino.
 * O link de acesso que falha (usado ou vencido) volta para cá com ?error=…;
 * links antigos traziam o erro dentro de ?next, por isso os dois são lidos.
 */
export const load: PageServerLoad = ({ locals, url }) => {
	let next = '/';
	let error = url.searchParams.get('error');

	const raw = url.searchParams.get('next');
	if (raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/login')) {
		const target = new URL(raw, url.origin);
		if (target.origin === url.origin) {
			error ??= target.searchParams.get('error');
			target.searchParams.delete('error');
			target.searchParams.delete('error_description');
			next = target.pathname + target.search;
		}
	}

	if (locals.user) redirect(303, next);

	return {
		next,
		linkError: !error
			? null
			: /expired/i.test(error)
				? ('expired' as const)
				: /token|attempt/i.test(error)
					? ('used' as const)
					: ('failed' as const)
	};
};
