const { TrezorFormat } = require('../../formats/TrezorFormat.js');
const { BtcTrackerFormat } = require('../../formats/BtcTrackerFormat.js');

class FormatDetector {
    static FORMATS = [TrezorFormat, BtcTrackerFormat];

    static detectFormat(content) {
        for (const Format of this.FORMATS) {
            if (Format.detectFormat(content)) {
                return Format;
            }
        }
        throw new Error('Unknown CSV format. Supported formats: Trezor, BTCTracker');
    }

    static getFormatClass(formatName) {
        const format = this.FORMATS.find(f => f.name.toLowerCase() === formatName.toLowerCase());
        if (!format) {
            throw new Error(`Unsupported format: ${formatName}. Supported formats: ${this.FORMATS.map(f => f.name).join(', ')}`);
        }
        return format;
    }
}

module.exports = { FormatDetector };
