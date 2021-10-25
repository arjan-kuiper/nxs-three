export class ZPoint {
    private lo: number;
    private hi: number;
    
    constructor(h: number, l: number) {
        this.lo = l;
        this.hi = h;
    }

    public copy(z: ZPoint): void {
        this.lo = z.lo;
        this.hi = z.hi;
    }

    public setBit(d: number): void {
        if (d < 32) {
            this.lo = (this.lo | (1 << d)) >>> 0;
        } else {
            this.hi = (this.hi | (1 << (d - 32))) >>> 0;
        }
    }

    public toPoint(min: any, step: any, buffer: any, pos: any): void {
        let x = this.morton3(this.lo, this.hi >>> 1);
        let y = this.morton3(this.lo >>> 1, this.hi >>> 2);
        let z = this.morton3((this.lo >>> 2 | (this.hi & 0x1) << 30) >>> 0, this.hi >>> 3);
    
        buffer[pos + 0] = (x + min[0]) * step;
        buffer[pos + 1] = (y + min[1]) * step;
        buffer[pos + 2] = (z + min[2]) * step;
    }

    public morton3(lo: number, hi: number): number {
        lo = (lo                 & 0x49249249) >>> 0;
        lo = ((lo | (lo >>> 2 )) & 0xc30c30c3) >>> 0;
        lo = ((lo | (lo >>> 4 )) & 0x0f00f00f) >>> 0;
        lo = ((lo | (lo >>> 8 )) & 0xff0000ff) >>> 0;
        lo = ((lo | (lo >>> 16)) & 0x0000ffff) >>> 0;

        hi = ( hi                & 0x49249249) >>> 0;
        hi = ((hi | (hi >> 2 ))  & 0xc30c30c3) >>> 0;
        hi = ((hi | (hi >> 4 ))  & 0x0f00f00f) >>> 0;
        hi = ((hi | (hi >> 8 ))  & 0xff0000ff) >>> 0;
        hi = ((hi | (hi >> 16))  & 0x0000ffff) >>> 0;

        return ((hi << 11) | lo) >>> 0;
    }
}

export class Tunstall {
    private wordSize: number;
    private lookupSize: number;
    private probabilities: Uint8Array;
    private index: Uint32Array;
    private lenghts: Uint32Array;
    private tables: Uint8Array

    constructor(wordSize?: number, lookupSize?: number) {
        this.wordSize = wordSize ? wordSize : 8;
        this.lookupSize = lookupSize ? lookupSize : 8;
        
        this.probabilities = new Uint8Array(0);
        this.index = new Uint32Array(0);
        this.lenghts = new Uint32Array(0);
        this.tables = new Uint8Array(0);
    }

    public decompress(stream: Stream): Uint8Array {
        let nSymbols = stream.readUChar();
        this.probabilities = stream.readArray(nSymbols * 2);
        this.createDecodingTables();
        let size = stream.readInt();
        let data = new Uint8Array(size);
        let compressedSize = stream.readInt();
        let compressedData = stream.readArray(compressedSize);
        if (size) {
            this._decompress(compressedData, compressedSize, data, size);
        }
        return data;
    }

    public _decompress(input: Uint8Array, inputSize: number, output: Uint8Array, outputSize: number) {
        let inputPos = 0;
        let outputPos = 0;
        if (this.probabilities.length == 2) {
            let symbol = this.probabilities[0];
            for (let i = 0; i < outputSize; i++) {
                output[i] = symbol;
            }
            return;
        }

        while (inputPos < inputSize - 1) {
            let symbol = input[inputPos++];
            let start = this.index[symbol];
            let end = start + this.lenghts[symbol];
            for (let i = start; i < end; i++) {
                output[outputPos++] = this.tables[i];
            }
        }

        let symbol = input[inputPos];
        let start = this.index[symbol];
        let end = start + outputSize - outputPos;
        let length = outputSize - outputPos;
        for (let i = start; i < end; i++) {
            output[outputPos++] = this.tables[i];
        }
        return output;
    }

    public createDecodingTables(): void {
        let nSymbols = this.probabilities?.length / 2;
        if (nSymbols <= 1) return;

        let queues = [];
        let buffer = [];

        for (let i = 0; i < nSymbols; i++) {
            let symbol = this.probabilities[i * 2];
            let s = [(this.probabilities[i * 2 + 1]) << 8, buffer.length, 1];
            queues[i] = [s];
            buffer.push(symbol);
        }
        let dictionarySize = 1 << this.wordSize;
        let nWords = nSymbols;
        let tableLength = nSymbols;

        while (nWords < dictionarySize - nSymbols + 1) {
            let best = 0;
            let maxProb = 0;
            for (let i = 0; i < nSymbols; i++) {
                let p = queues[i][0][0];
                if (p > maxProb) {
                    best = i;
                    maxProb = p;
                }
            }
            let symbol = queues[best][0];
            let pos: number = buffer.length;

            for (let i = 0; i < nSymbols; i++) {
                let sym = this.probabilities[i * 2];
                let prob = this.probabilities[i * 2 + 1] << 8;
                let s = [((prob * symbol[0]) >>> 16), pos, symbol[2] + 1];

                for (let k = 0; k < symbol[2]; k++) {
                    buffer[pos + k] = buffer[symbol[1] + k];
                }

                pos += symbol[2];
                buffer[pos++] = sym;
                queues[i].push(s);
            }
            tableLength += (nSymbols - 1) * (symbol[2] + 1) + 1;
            nWords += nSymbols - 1;
            queues[best].shift();
        }

        this.index = new Uint32Array(nWords);
        this.lenghts = new Uint32Array(nWords);
        this.tables = new Uint8Array(tableLength);
        let word = 0;
        let pos = 0;
        for (let i = 0; i < queues.length; i++) {
            let queue = queues[i];
            for (let k = 0; k < queue.length; k++) {
                let s = queue[k];
                this.index[word] = pos;
                this.lenghts[word] = s[2];
                word++;

                for (let j = 0; j < s[2]; j++) {
                    this.tables[pos + j] = buffer[s[1] + j];
                }
                pos += s[2];
            }
        }
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