/** Glossary lookup: "BLESSED (3)" and "AUTOMATIC (X)" both find their base keyword. */
export const keywordKey = (k: string) =>
	k
		.toUpperCase()
		.replace(/\([^)]*\)/g, '')
		.replace(/[^A-Z ]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
