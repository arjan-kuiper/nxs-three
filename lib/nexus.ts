export default class Nexus {
    
}

export function getUint64(view: DataView) {
    var s = 0;
	var lo = view.getUint32(view.byteOffset, true);
	var hi = view.getUint32(view.byteOffset + 4, true);
	view.byteOffset += 8;
	return ((hi * (1 << 32)) + lo);
}