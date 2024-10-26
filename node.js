const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const fileUpload = require('express-fileupload'); // Import express-fileupload

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(fileUpload()); // Add file upload middleware

// In-memory storage for screens
let screens = [];

// Serve config and controller pages
app.get('/config', (req, res) => res.sendFile(path.join(__dirname, 'views', 'config.html')));
app.get('/controller', (req, res) => res.sendFile(path.join(__dirname, 'views', 'controller.html')));

// Add new screen configuration
app.post('/addScreen', (req, res) => {
    const { screenName } = req.body;
    if (screenName && !screens.find(s => s.name === screenName)) {
        screens.push({ name: screenName, route: `/screen/${screenName}` });
        res.status(201).json({ name: screenName });
    } else {
        res.status(400).json({ error: 'Invalid or duplicate screen name' });
    }
});

// Endpoint to retrieve screens
app.get('/screens', (req, res) => res.json(screens));

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
app.post('/upload/:screenName', (req, res) => {
    const { screenName } = req.params;
    const screen = screens.find(s => s.name === screenName);

    if (!screen) {
        return res.status(404).send('Screen not found');
    }

    if (!req.files || !req.files.videoFile) {
        return res.status(400).send('No file uploaded');
    }

    const screenFolderPath = path.join(__dirname, 'public', 'videos', screenName);

    // Ensure the screen folder exists
    if (!fs.existsSync(screenFolderPath)) {
        fs.mkdirSync(screenFolderPath, { recursive: true });
    }

    const videoFile = req.files.videoFile;
    const uploadPath = path.join(screenFolderPath, videoFile.name);

    // Save the video file to the screen's folder
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
app.delete('/videos/:screenName/:fileName', (req, res) => {
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

    // Broadcast playVideo event to all screens, specifying target screen
    socket.on('playVideo', ({ screen, videoUrl }) => {
        console.log(`Broadcasting playVideo event to screen: ${screen} with URL: ${videoUrl}`);
        io.emit('playVideo', { screen, videoUrl });
    });

    // Broadcast loopSingle event to all screens, specifying target screen
    socket.on('loopSingle', ({ screen, videoUrl }) => {
        console.log(`Broadcasting loopSingle event to screen: ${screen} with URL: ${videoUrl}`);
        io.emit('loopSingle', { screen, videoUrl });
    });

    socket.on('disconnect', () => console.log('Client disconnected'));
});


// Start the server
server.listen(3000, () => console.log('Server running on http://localhost:3000'));
