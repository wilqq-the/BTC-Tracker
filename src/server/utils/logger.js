const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

const LOG_COLORS = {
    ERROR: '\x1b[31m', // Red
    WARN: '\x1b[33m',  // Yellow
    INFO: '\x1b[36m',  // Cyan
    DEBUG: '\x1b[90m', // Gray
    RESET: '\x1b[0m'
};

class Logger {
    constructor(module = 'APP', level = 'INFO') {
        this.module = module;
        this.level = LOG_LEVELS[level] || LOG_LEVELS.INFO;
    }

    _log(level, ...args) {
        if (LOG_LEVELS[level] > this.level) return;

        const timestamp = new Date().toISOString();
        const color = LOG_COLORS[level] || '';
        const reset = LOG_COLORS.RESET;
        
        const prefix = `${color}[${timestamp}] [${level}] [${this.module}]${reset}`;
        
        if (level === 'ERROR') {
            console.error(prefix, ...args);
        } else if (level === 'WARN') {
            console.warn(prefix, ...args);
        } else {
            console.log(prefix, ...args);
        }
    }

    error(...args) {
        this._log('ERROR', ...args);
    }

    warn(...args) {
        this._log('WARN', ...args);
    }

    info(...args) {
        this._log('INFO', ...args);
    }

    debug(...args) {
        this._log('DEBUG', ...args);
    }

    // Static method to create logger for a module
    static create(module, level = process.env.LOG_LEVEL || 'INFO') {
        return new Logger(module, level);
    }
}

module.exports = Logger; 