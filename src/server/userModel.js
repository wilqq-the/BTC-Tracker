const fs = require('fs');
const bcrypt = require('bcryptjs');
const pathManager = require('./utils/path-manager');

// File paths
const USERS_FILE = pathManager.getUsersPath();

// Ensure data directory exists
if (!fs.existsSync(pathManager.getDataDirectory())) {
    fs.mkdirSync(pathManager.getDataDirectory(), { recursive: true });
}

// Initialize users if not exists
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
}

// Helper functions for user management
const userModel = {
    // Get all users
    getUsers: () => {
        try {
            const data = fs.readFileSync(USERS_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading users file:', error);
            return [];
        }
    },

    // Save users to file
    saveUsers: (users) => {
        try {
            fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving users file:', error);
            return false;
        }
    },

    // Check if any users exist
    hasUsers: () => {
        const users = userModel.getUsers();
        return users.length > 0;
    },

    // Find a user by username
    findUserByUsername: (username) => {
        const users = userModel.getUsers();
        return users.find(user => user.username === username);
    },

    // Find a user by ID
    findUserById: (id) => {
        const users = userModel.getUsers();
        return users.find(user => user.id === id);
    },

    // Ensure PIN fields exist for backward compatibility
    ensurePinFields: (user) => {
        // Return a user object with default pin fields if they don't exist
        return {
            ...user,
            pinEnabled: user.pinEnabled !== undefined ? user.pinEnabled : false,
            pin: user.pin !== undefined ? user.pin : null
        };
    },

    // Create a new user
    createUser: async (username, password, pin = null) => {
        // Validate inputs
        if (!username || !password) {
            throw new Error('Username and password are required');
        }

        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters long');
        }

        // Validate PIN if provided
        if (pin !== null) {
            if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
                throw new Error('PIN must be a 4-digit number');
            }
        }

        // Check if username already exists
        const existingUser = userModel.findUserByUsername(username);
        if (existingUser) {
            throw new Error('Username already exists');
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Hash PIN if provided
        let hashedPin = null;
        if (pin) {
            hashedPin = await bcrypt.hash(pin, saltRounds);
        }

        // Create new user
        const newUser = {
            id: Date.now().toString(),
            username,
            password: hashedPassword,
            pin: hashedPin,
            pinEnabled: !!pin,
            created: new Date().toISOString()
        };

        // Add to users array
        const users = userModel.getUsers();
        users.push(newUser);

        // Save to file
        userModel.saveUsers(users);

        // Return user without sensitive fields
        const { password: _, pin: __, ...userWithoutSensitiveData } = newUser;
        return userWithoutSensitiveData;
    },

    // Update user
    updateUser: async (id, updates) => {
        const users = userModel.getUsers();
        const index = users.findIndex(user => user.id === id);

        if (index === -1) {
            throw new Error('User not found');
        }

        // If updating password, hash it
        if (updates.password) {
            const saltRounds = 10;
            updates.password = await bcrypt.hash(updates.password, saltRounds);
        }

        // If updating PIN, hash it
        if (updates.pin) {
            const saltRounds = 10;
            updates.pin = await bcrypt.hash(updates.pin, saltRounds);
            updates.pinEnabled = true;
        }

        // If disabling PIN
        if (updates.pinEnabled === false) {
            updates.pin = null;
        }

        // Update user
        users[index] = {
            ...users[index],
            ...updates,
            updated: new Date().toISOString()
        };

        // Save to file
        userModel.saveUsers(users);

        // Return user without sensitive fields
        const { password: _, pin: __, ...userWithoutSensitiveData } = users[index];
        return userWithoutSensitiveData;
    },

    // Delete user
    deleteUser: (id) => {
        const users = userModel.getUsers();
        const filteredUsers = users.filter(user => user.id !== id);

        if (filteredUsers.length === users.length) {
            throw new Error('User not found');
        }

        // Save to file
        return userModel.saveUsers(filteredUsers);
    },

    // Verify PIN for a user
    verifyPin: async (userId, pin) => {
        const user = userModel.findUserById(userId);
        
        if (!user) {
            throw new Error('User not found');
        }
        
        // Ensure user has PIN fields
        const userWithPin = userModel.ensurePinFields(user);

        if (!userWithPin.pinEnabled || !userWithPin.pin) {
            throw new Error('PIN authentication not enabled for this user');
        }

        return await bcrypt.compare(pin, userWithPin.pin);
    },

    // Enable/disable PIN for a user
    updatePinSettings: async (userId, pin, enabled) => {
        const users = userModel.getUsers();
        const index = users.findIndex(user => user.id === userId);

        if (index === -1) {
            throw new Error('User not found');
        }
        
        // Ensure user has PIN fields (backward compatibility)
        const userWithPin = userModel.ensurePinFields(users[index]);

        if (enabled && !pin) {
            throw new Error('PIN is required when enabling PIN authentication');
        }

        let updates = { pinEnabled: enabled };
        
        if (enabled) {
            const saltRounds = 10;
            updates.pin = await bcrypt.hash(pin, saltRounds);
        } else {
            updates.pin = null;
        }

        // Update user
        users[index] = {
            ...userWithPin,
            ...updates,
            updated: new Date().toISOString()
        };

        // Save to file
        userModel.saveUsers(users);

        // Return user without sensitive fields
        const { password: _, pin: __, ...userWithoutSensitiveData } = users[index];
        return userWithoutSensitiveData;
    }
};

module.exports = userModel; 