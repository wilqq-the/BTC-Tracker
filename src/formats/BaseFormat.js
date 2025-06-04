class BaseFormat {
    constructor() {
        if (this.constructor === BaseFormat) {
            throw new Error('BaseFormat is an abstract class and cannot be instantiated directly');
        }
    }

    // Method to detect if the CSV content matches this format
    static detectFormat(content) {
        throw new Error('detectFormat must be implemented by subclass');
    }

    // Method to parse a row into a standardized transaction format
    parseRow(row) {
        throw new Error('parseRow must be implemented by subclass');
    }

    // Method to convert to standardized transaction format
    toStandardFormat() {
        throw new Error('toStandardFormat must be implemented by subclass');
    }

    // Method to get headers for this format
    getHeaders() {
        throw new Error('getHeaders must be implemented by subclass');
    }

    // Method to get delimiter for this format
    getDelimiter() {
        throw new Error('getDelimiter must be implemented by subclass');
    }
}

module.exports = { BaseFormat }; 