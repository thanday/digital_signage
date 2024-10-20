const express = require('express');
const fileUpload = require('express-fileupload');
const http = require('http');
const path = require('path');
const fs = require('fs');
const socketIo = require('socket.io');

// Create the app and the server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware for handling file uploads
app.use(fileUpload());
app.use(express.static('public'));

// Serve the static files (e.g., video player and controller)
app.get('/player', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/player.html'));
});

app.get('/controller', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/controller.html'));
});

// Handle file uploads from the controller
app.post('/upload', (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send('No files were uploaded.');
  }

  let videoFile = req.files.videoFile;
  let uploadPath = path.join(__dirname, 'public/videos/', videoFile.name);

  // Save the uploaded video in the 'public/videos' folder
  videoFile.mv(uploadPath, (err) => {
    if (err) return res.status(500).send(err);
    res.send('File uploaded successfully!');
  });
});

// Serve the uploaded videos list for the playlist
app.get('/videos', (req, res) => {
  const videoDir = path.join(__dirname, 'public/videos');
  fs.readdir(videoDir, (err, files) => {
    if (err) {
      return res.status(500).send('Unable to read videos');
    }
    res.json(files);
  });
});

// WebSocket handling
io.on('connection', (socket) => {
  console.log('A user connected');

  // Play a selected video
  socket.on('playVideo', (videoUrl) => {
    io.emit('playVideo', videoUrl);
  });

  // Loop the entire playlist
  socket.on('startLoop', (playlistArray) => {
    io.emit('startLoop', playlistArray);
  });

  // Loop a single video
  socket.on('loopSingle', (videoUrl) => {
    io.emit('loopSingle', videoUrl);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Start the server
server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
