const clients = new Map();

const SSEService = {
  addClient(userId, res) {
    if (!clients.has(userId)) {
      clients.set(userId, []);
    }
    clients.get(userId).push(res);

    res.on('close', () => {
      const arr = clients.get(userId);
      if (arr) {
        const idx = arr.indexOf(res);
        if (idx !== -1) arr.splice(idx, 1);
        if (arr.length === 0) clients.delete(userId);
      }
    });
  },

  sendToUser(userId, data) {
    const userClients = clients.get(userId);
    if (!userClients) return;
    const payload = `event: PAYMENT_SUCCESS\ndata: ${JSON.stringify(data)}\n\n`;
    userClients.forEach(res => {
      try {
        res.write(payload);
      } catch {
        // client disconnected
      }
    });
  },
};

module.exports = SSEService;
