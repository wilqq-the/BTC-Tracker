const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// File paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
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

    // Create a new user
    createUser: async (username, password) => {
        // Validate inputs
        if (!username || !password) {
            throw new Error('Username and password are required');
        }

        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters long');
        }

        // Check if username already exists
        const existingUser = userModel.findUserByUsername(username);
        if (existingUser) {
            throw new Error('Username already exists');
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create new user
        const newUser = {
            id: Date.now().toString(),
            username,
            password: hashedPassword,
            created: new Date().toISOString()
        };

        // Add to users array
        const users = userModel.getUsers();
        users.push(newUser);

        // Save to file
        userModel.saveUsers(users);

        // Return user without password
        const { password: _, ...userWithoutPassword } = newUser;
        return userWithoutPassword;
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

        // Update user
        users[index] = {
            ...users[index],
            ...updates,
            updated: new Date().toISOString()
        };

        // Save to file
        userModel.saveUsers(users);

        // Return user without password
        const { password: _, ...userWithoutPassword } = users[index];
        return userWithoutPassword;
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
    }
};

module.exports = userModel; 