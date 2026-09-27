/** Unit types share a default picture by name, ignoring case, spacing and punctuation. */
export const unitTypeKey = (type: string) => type.toLowerCase().replace(/[^a-z0-9]/g, '');
