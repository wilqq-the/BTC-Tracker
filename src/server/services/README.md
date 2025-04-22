# Credential Manager

## Overview
The Credential Manager is a secure service that handles storage and retrieval of exchange API credentials in BTC Tracker. It's designed with security and privacy in mind, ensuring your API keys and secrets are stored safely on your local machine.

## Security Features

### Local Storage Only
- All credentials are stored **locally** on your machine
- No data is ever sent to external servers
- Credentials are saved in your user data directory, not in the application directory

### Encryption
- All sensitive data is encrypted before being stored
- Uses AES-256-CBC encryption (industry standard)
- Each credential is encrypted with a unique initialization vector (IV)
- Encrypted data is stored in a format that includes both the IV and the encrypted content

### Data Protection
- Credentials are stored in a JSON file with encrypted values
- Even if someone gains access to the credentials file, they cannot read the actual API keys without the encryption key
- The encryption key is stored separately from the encrypted data

## How It Works

1. **When you save credentials:**
   - Your API keys and secrets are encrypted
   - Each piece of data gets its own encryption
   - The encrypted data is saved to a local file

2. **When you use credentials:**
   - The encrypted data is read from the file
   - Data is decrypted only when needed
   - Decrypted credentials are never written to disk

3. **When you delete credentials:**
   - The encrypted data is completely removed from storage
   - No backup copies are kept

## Best Practices
- **ALWAYS use READ-ONLY API keys** - this ensures that even if compromised, your funds cannot be withdrawn or traded
- Keep your BTC Tracker installation up to date
- Don't share your user data directory with others
- Use unique API keys for BTC Tracker
- Regularly review your saved credentials
- Revoke and rotate API keys if you suspect they've been compromised

## Technical Note
The encryption key can be customized through the `ENCRYPTION_KEY` environment variable. If not set, a default key is used. For maximum security in a production environment, it's recommended to set your own encryption key. 