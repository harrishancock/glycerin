const blessed = require('neo-blessed');
const EE = require('../lib/eventemitter');
const sendChatMessage = require('../lib/api/send-chat-message');
const sendThreadMessage = require('../lib/api/send-thread-message');

const input = blessed.textbox({
  label: 'Input',
  // keys: false,
  // vi: false,
  height: '10%+1',
  width: '75%',
  top: '90%',
  left: '25%',
  border: {
    type: 'line',
  },
  cursor: {
    artificial: true,
    shape: 'underline',
    blink: true,
  },
  // inputOnFocus: true,
});
input._data = {};

// listeners need to be duplicated from screen
// as input captures keys and doesn't bubble them
input.key('C-r', function () {
  EE.emit('screen.refresh');
});
input.key('C-d', function () {
  process.exit(0);
});
input.key('C-e', function () {
  EE.emit('messages.expand');
});

input.on('focus', () => {
  input.readInput(async (err, value) => {
    input.clearValue();
    if (value !== null) {
      if (value.length) {
        if (input._data.from === 'chats') {
          await sendChatMessage(value, input._data.chat);
        } else {
          await sendThreadMessage(value, input._data.thread);
        }
      }

      // input gets a little assume-y on submit
      // so let's give ourselves focus again
      input.focus();
    } else {
      EE.emit('input.blur', input._data.from);
      input._data = false;
    }

    input.screen.render();
  });
});

EE.on('chats.select', chat => {
  if (chat.isDm) {
    input._data = {
      chat,
      from: 'chats',
    };
    input.focus();
    input.screen.render();
  }
});

EE.on('threads.select', thread => {
  input._data = {
    thread,
    from: 'threads',
  };
  input.focus();
  input.screen.render();
});

module.exports = {
  input,
};
