/**
 * The first bytes of a PNG of a given size: the signature and the header chunk, which is all the frame check reads.
 * Not a picture a browser could show; the e2e tests use a real one.
 */
export function pngHeader(width: number, height: number): Uint8Array {
	const b = new Uint8Array(33);
	b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
	const v = new DataView(b.buffer);
	v.setUint32(16, width);
	v.setUint32(20, height);
	b.set([8, 6, 0, 0, 0], 24);
	return b;
}
