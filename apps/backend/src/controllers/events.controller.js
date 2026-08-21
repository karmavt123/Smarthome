const sseService = require('../services/sse.service');

const HEARTBEAT_MS = 20000;

function stream(req, res) {
  const userId = req.user.sub;

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  sseService.addClient(userId, res);

  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseService.removeClient(userId, res);
  });
}

module.exports = { stream };
