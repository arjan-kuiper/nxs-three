export class Tunstall {
    private wordSize: number;
    private lookupSize: number;

    constructor(wordSize?: number, lookupSize?: number) {
        this.wordSize = wordSize ? wordSize : 8;
        this.lookupSize = lookupSize ? lookupSize : 8;
    }
}

export class Stream {
    private data: any;
    private buffer: Uint8Array;
    private pos: number;

    constructor(buffer: any) {
        this.data = buffer;
        this.buffer = new Uint8Array(buffer);
        this.pos = 0;
    }

    public readChar(): number {
        var c = this.buffer[this.pos++];
		if (c > 127) {
            c -= 256
        }
		return c;
    }

    public readUChar(): number {
        return this.buffer[this.pos++];
    }

    public readInt(): number {
        var c = this.buffer[this.pos + 3]
		c <<= 8;
		c |= this.buffer[this.pos + 2];
		c <<= 8;
		c |= this.buffer[this.pos + 1];
		c <<= 8;
		c |= this.buffer[this.pos + 0];
		this.pos += 4;
		return c;
    }

    public readArray(n: number): Uint8Array {
        var a = this.buffer.subarray(this.pos, this.pos + n);
		this.pos += n;
		return a;
    }

    public readBitStream(): BitStream {
        var n = this.readInt();
		var pad = this.pos & 0x3;
		if (pad != 0) {
            this.pos += 4 - pad;
        }
		var b = new BitStream(new Uint32Array(this.data, this.pos, n * 2));
		this.pos += n*8;
		return b;
    }
}

export class BitStream {
    private array: Uint32Array;
    private position: number;
    private bitsPending: number;

    constructor(array: Uint32Array) {
        this.array = array;
        for (let i = 0; i < array.length; i += 2) {
            const s = array[i];
            array[i] = array[i + 1];
            array[i + 1] = s;
        }
        this.position = 0;
        this.bitsPending = 0;
    }

    public read(bits: number): number {
        let bitBuffer = 0;
        while (bits > 0) {
            let partial;
            let bitsConsumed;
            if (this.bitsPending > 0) {
                let byte = (this.array[this.position - 1] & (0xffffffff >>> (32 - this.bitsPending))) >>> 0;
                bitsConsumed = Math.min(this.bitsPending, bits);
                this.bitsPending -= bitsConsumed;
                partial = byte >>> this.bitsPending;
            } else {
                bitsConsumed = Math.min(32, bits);
                this.bitsPending = 32 - bitsConsumed;
                partial = this.array[this.position++] >>> this.bitsPending;
            }
            bits -= bitsConsumed;
            bitBuffer = ((bitBuffer << bitsConsumed) | partial) >>> 0;
        }

        return bitBuffer;
    }

    public replace(bits: number, value: number): number {
        value = (value & (0xffffffff >>> 32 - bits)) >>> 0;
		value = (value | this.read(bits)) >>> 0;
		return value;
    }
}