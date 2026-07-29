// Minimal ESC/POS command encoder for thermal receipt printers. ESC/POS is
// the de-facto standard command set almost all 58mm/80mm thermal printers
// understand, regardless of whether they're connected over Bluetooth or USB
// — see printerConnection.ts for the two transports this app supports.
//
// This only implements the handful of commands an ERP receipt actually
// needs (init, plain text, bold, alignment, line feed, partial cut). It's
// intentionally small rather than a full ESC/POS library.

const ESC = 0x1b;
const GS = 0x1d;

export type EscPosAlign = 'left' | 'center' | 'right';

export class EscPosBuilder {
  private parts: Uint8Array[] = [];

  private push(bytes: number[] | Uint8Array) {
    this.parts.push(bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes));
    return this;
  }

  /** Resets the printer to its default state. Always call this first. */
  init() {
    return this.push([ESC, 0x40]);
  }

  text(str: string) {
    return this.push(new TextEncoder().encode(str));
  }

  line(str: string = '') {
    this.text(str);
    return this.push([0x0a]);
  }

  newline(count: number = 1) {
    for (let i = 0; i < count; i++) this.push([0x0a]);
    return this;
  }

  bold(on: boolean) {
    return this.push([ESC, 0x45, on ? 1 : 0]);
  }

  align(mode: EscPosAlign) {
    const value = mode === 'left' ? 0 : mode === 'center' ? 1 : 2;
    return this.push([ESC, 0x61, value]);
  }

  /** A full-width dashed divider — handy between receipt sections. */
  divider(char: string = '-', width: number = 32) {
    return this.line(char.repeat(width));
  }

  /** Feeds a few lines then does a partial cut. Most (not all) thermal printers support GS V. */
  feedAndCut(feedLines: number = 3) {
    this.newline(feedLines);
    return this.push([GS, 0x56, 0x01]);
  }

  build(): Uint8Array {
    const total = this.parts.reduce((sum, p) => sum + p.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const p of this.parts) {
      out.set(p, offset);
      offset += p.length;
    }
    return out;
  }
}

/** A short receipt used by the "Cetak Test Roll" button in Pengaturan > Printer. */
export function buildTestPrint(printerName: string, storeName?: string): Uint8Array {
  const now = new Date();
  return new EscPosBuilder()
    .init()
    .align('center')
    .bold(true)
    .line(storeName || 'Masri Jaya')
    .bold(false)
    .line('TEST PRINT')
    .divider()
    .align('left')
    .line(`Printer : ${printerName}`)
    .line(`Waktu   : ${now.toLocaleString('id-ID')}`)
    .divider()
    .align('center')
    .line('Jika teks ini tercetak dengan')
    .line('rapi, koneksi printer sukses.')
    .feedAndCut(4)
    .build();
}
