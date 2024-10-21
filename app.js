const express = require('express');
const fileUpload = require('express-fileupload');
const http = require('http');
const path = require('path');
const fs = require('fs');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(fileUpload());
app.use(express.static('public'));

app.get('/player', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/player.html'));
});


app.get('/controller', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/controller.html'));
});

app.post('/upload', (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send('No files were uploaded.');
  }

  let videoFile = req.files.videoFile;
  let uploadPath = path.join(__dirname, 'public/videos/', videoFile.name);

  videoFile.mv(uploadPath, (err) => {
    if (err) return res.status(500).send(err);
    res.send('File uploaded successfully!');
  });
});

app.get('/videos', (req, res) => {
  const videoDir = path.join(__dirname, 'public/videos');
  fs.readdir(videoDir, (err, files) => {
    if (err) {
      return res.status(500).send('Unable to read videos');
    }
    res.json(files);
  });
});

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('playVideo', (videoUrl) => {
    io.emit('playVideo', videoUrl);
  });

  socket.on('startLoop', (playlistArray) => {
    io.emit('startLoop', playlistArray);
  });

  socket.on('loopSingle', (videoUrl) => {
    io.emit('loopSingle', videoUrl);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
