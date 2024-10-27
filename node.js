const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const fileUpload = require('express-fileupload');
const session = require('express-session'); // Import express-session for session management

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const screensFilePath = path.join(__dirname, 'screens.json');

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(fileUpload());

// Session middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to `true` in production with HTTPS
}));

// Load screens from JSON file
let screens = [];
function loadScreensFromFile() {
    try {
        const data = fs.readFileSync(screensFilePath, 'utf8');
        screens = JSON.parse(data);
    } catch (err) {
        console.error('Error reading screens file:', err);
        screens = [];
    }
}

// Save screens to JSON file
function saveScreensToFile() {
    try {
        fs.writeFileSync(screensFilePath, JSON.stringify(screens, null, 2));
    } catch (err) {
        console.error('Error saving screens file:', err);
    }
}

loadScreensFromFile();

// Serve the index page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Serve login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Handle login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    // Simple authentication: replace with more secure solution in production
    if (username === 'admin' && password === 'Admin@321') {
        req.session.isAuthenticated = true;
        res.redirect('/config');
    } else {
        res.redirect('/login'); // Redirect to login if authentication fails
    }
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Middleware to protect routes
function authMiddleware(req, res, next) {
    if (req.session.isAuthenticated) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Protected routes
app.get('/config', authMiddleware, (req, res) => res.sendFile(path.join(__dirname, 'views', 'config.html')));
app.get('/controller', authMiddleware, (req, res) => res.sendFile(path.join(__dirname, 'views', 'controller.html')));

// Endpoint to retrieve screens
app.get('/screens', (req, res) => res.json(screens));

// Add new screen configuration and save to file
app.post('/addScreen', authMiddleware, (req, res) => {
    const { screenName } = req.body;
    if (screenName && !screens.find(s => s.name === screenName)) {
        const newScreen = { name: screenName, route: `/screen/${screenName}` };
        screens.push(newScreen);
        saveScreensToFile(); // Save updated screens to file
        res.status(201).json(newScreen);
    } else {
        res.status(400).json({ error: 'Invalid or duplicate screen name' });
    }
});

// Route to delete a screen
app.delete('/removeScreen/:screenName', authMiddleware, (req, res) => {
    const { screenName } = req.params;
    const screenIndex = screens.findIndex(s => s.name === screenName);

    if (screenIndex !== -1) {
        screens.splice(screenIndex, 1); // Remove screen from array
        saveScreensToFile(); // Save updated list to JSON
        res.status(200).send(`Screen ${screenName} removed successfully`);
    } else {
        res.status(404).send('Screen not found');
    }
});


// Serve screen player views
app.get('/screen/:screenName', (req, res) => {
    const screen = screens.find(s => s.name === req.params.screenName);
    if (screen) {
        res.sendFile(path.join(__dirname, 'views', 'screen.html'));
    } else {
        res.status(404).send('Screen not found');
    }
});

// Handle file uploads for specific screens
app.post('/upload/:screenName', authMiddleware, (req, res) => {
    const { screenName } = req.params;
    const screen = screens.find(s => s.name === screenName);

    if (!screen) {
        return res.status(404).send('Screen not found');
    }

    if (!req.files || !req.files.videoFile) {
        return res.status(400).send('No file uploaded');
    }

    const screenFolderPath = path.join(__dirname, 'public', 'videos', screenName);

    if (!fs.existsSync(screenFolderPath)) {
        fs.mkdirSync(screenFolderPath, { recursive: true });
    }

    const videoFile = req.files.videoFile;
    const uploadPath = path.join(screenFolderPath, videoFile.name);

    videoFile.mv(uploadPath, (err) => {
        if (err) return res.status(500).send(err);
        res.send('File uploaded successfully!');
    });
});

// Get videos for a specific screen
app.get('/videos/:screenName', (req, res) => {
    const { screenName } = req.params;
    const screenFolderPath = path.join(__dirname, 'public/videos/', screenName);

    if (!fs.existsSync(screenFolderPath)) {
        return res.json([]);
    }

    fs.readdir(screenFolderPath, (err, files) => {
        if (err) return res.status(500).send('Error reading videos');
        res.json(files.map(file => `/videos/${screenName}/${file}`));
    });
});

// DELETE route to delete a video file
app.delete('/videos/:screenName/:fileName', authMiddleware, (req, res) => {
    const { screenName, fileName } = req.params;
    const filePath = path.join(__dirname, 'public', 'videos', screenName, fileName);

    fs.unlink(filePath, (err) => {
        if (err) {
            console.error(`Failed to delete file: ${filePath}`, err);
            return res.status(500).send('Failed to delete video');
        }
        console.log(`File deleted: ${filePath}`);
        res.send('Video deleted successfully');
    });
});

// WebSocket setup
io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('playVideo', ({ screen, videoUrl }) => {
        console.log(`Broadcasting playVideo event to screen: ${screen} with URL: ${videoUrl}`);
        io.emit('playVideo', { screen, videoUrl });
    });

    socket.on('loopSingle', ({ screen, videoUrl }) => {
        console.log(`Broadcasting loopSingle event to screen: ${screen} with URL: ${videoUrl}`);
        io.emit('loopSingle', { screen, videoUrl });
    });

    // Emit startLoop to all screens (or handle screen-specific event handling in the client)
    socket.on('startLoop', ({ screen, videoUrls }) => {
        console.log(`Broadcasting startLoop event to screen: ${screen} with URLs:`, videoUrls);
        io.emit(`startLoop_${screen}`, { screen, videoUrls });  // Emit globally but with a unique screen identifier
    });




    socket.on('disconnect', () => console.log('Client disconnected'));
});

// Start the server
server.listen(3000, () => console.log('Server running on http://localhost:3000'));
