const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const AUTH_PORT = 3000; 


const MOCK_USERS = [];
let nextUserId = 1; 


app.use(bodyParser.json()); 


app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); 
    res.header('Access-Control-Allow-Methods', 'GET,POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});


function generateMockToken(user) {
    
    const payload = { id: user.id, email: user.email, name: user.name, timestamp: Date.now() };
    return 'mock-jwt.' + Buffer.from(JSON.stringify(payload)).toString('base64');
}



/**
 * @route POST /api/register
 * Handles new user account creation.
 */
app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;

   
    if (!name || !email || !password || password.length < 6) {
        return res.status(400).json({ 
            success: false, 
            message: 'Invalid input. Name, email, and password (min 6 chars) are required.' 
        });
    }

    
    if (MOCK_USERS.some(user => user.email === email)) {
        return res.status(409).json({ 
            success: false, 
            message: 'An account with this email already exists.' 
        });
    }

    
    const newUser = {
        id: nextUserId++,
        name,
        email,
        password: password, 
    };

    MOCK_USERS.push(newUser);
    
    console.log(`Registered new user: ${name} (${email})`);

    
    res.status(201).json({ 
        success: true, 
        message: 'Account created successfully. Please log in.',
        user: { id: newUser.id, name: newUser.name, email: newUser.email }
    });
});


/**
 * @route POST /api/login
 * Handles user login and session creation.
 */
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

   
    if (!email || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Email and password are required.' 
        });
    }

 
    const user = MOCK_USERS.find(u => u.email === email);

    if (!user) {
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid email or password.' 
        });
    }

    
    if (user.password !== password) {
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid email or password.' 
        });
    }

   
    const token = generateMockToken(user);

    console.log(`User logged in: ${user.name} (${user.email})`);

    
    res.json({
        success: true,
        message: 'Login successful.',
        token: token,
        user: { name: user.name, email: user.email }
    });
});



app.listen(AUTH_PORT, () => {
    console.log(`\n======================================================`);
    console.log(`Authentication Server running on http://localhost:${AUTH_PORT}`);
    console.log(`Mock DB currently has ${MOCK_USERS.length} users.`);
    console.log(`======================================================\n`);
});