import { json } from '@sveltejs/kit';
import { api, requireUser } from '#lib/server/http.ts';
import { draftDocument } from '#lib/server/profile-document.ts';

// Drafts the profile from the résumé, the structured data and the confirmed
// answers. The draft is not saved: it only counts after the person saves it (PUT).
export const POST = api(async (event) => json(await draftDocument(requireUser(event).id)));
