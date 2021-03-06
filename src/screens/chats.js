const blessed = require('neo-blessed');
const Chat = require('../lib/model/chat');
const EE = require('../lib/eventemitter');
const format = require('../lib/format');

const DEFAULT_DISPLAY_LIMIT = 5;

const chats = blessed.list({
  label: 'Rooms',
  width: '25%',
  height: '100%',
  tags: true,
  border: {
    type: 'line',
  },
  mouse: true,
  keys: true,
  vi: true,
  style: {
    selected: {
      bg: 'grey',
    },
  },
  search: find => {
    const search = chats.screen.getSearch();

    search.setFront();
    search.focus();
    search.readInput('Search', '', (err, val) => {
      find(err, val);
      search.setBack();
    });
  },
});
chats._data = { chats: {}, expanded: [] };

chats.on('focus', () => {
  chats.style.selected = {
    fg: 'white',
    bg: 'grey',
  };
  chats.style.item = {
    fg: 'white',
  };
  chats.screen.render();
});
chats.on('blur', () => {
  chats.style.selected = {
    fg: 'black',
    bg: 'grey',
  };
  chats.style.item = {
    fg: 'grey',
  };
  chats.screen.render();
});

chats.key(['enter'], () => {
  const selected = chats._data.visible[chats.selected];

  if (selected.expand) {
    expand();
  } else if (selected.collapse) {
    collapse();
  } else {
    EE.emit('chats.select', selected);
  }

  chats.screen.render();
});
chats.key(['C-e'], expand);
chats.key(['C-c'], collapse);

function expand() {
  const type = selectedType();
  if (!expanded(type)) {
    chats._data.expanded.push(type);
    display();
    chats.screen.render();
  }
}
function collapse() {
  const type = selectedType();
  if (expanded(type)) {
    chats._data.expanded = chats._data.expanded.filter(t => t !== type);
    display();
    chats.screen.render();
  }
}
function selectedType() {
  const idx = chats.selected;
  let currentLen = 0;
  for (let type of Object.keys(chats._data.chats)) {
    const limit = displayLimit(type);
    const expando = expanded(type) || shouldDisplayExpando(type) ? 1 : 0;
    const nextLen = currentLen + limit + expando;
    if (idx >= currentLen && idx < nextLen) {
      return type;
    }
    currentLen = nextLen;
  }
}
function displayLimit(type) {
  return !expanded(type) &&
    chats._data.chats[type].length > DEFAULT_DISPLAY_LIMIT
    ? DEFAULT_DISPLAY_LIMIT
    : chats._data.chats[type].length;
}
function shouldDisplayExpando(type) {
  return (
    chats._data.chats[type].length > DEFAULT_DISPLAY_LIMIT &&
    displayLimit(type) === DEFAULT_DISPLAY_LIMIT
  );
}
function expanded(type) {
  return chats._data.expanded.indexOf(type) !== -1;
}

function display() {
  let content = [];
  let visible = [];

  for (let [type, data] of Object.entries(chats._data.chats)) {
    const items = data.slice(0, displayLimit(type));
    content = content.concat(items.map(format.chat));
    visible = visible.concat(items);

    if (expanded(type)) {
      content.push('{underline}▲ Collapse{/}');
      visible.push({ collapse: true });
    } else if (shouldDisplayExpando(type)) {
      content.push('{underline}▼ Expand{/}');
      visible.push({ expand: true });
    }
  }

  chats.setItems(content);
  chats._data.visible = visible;
  chats.screen.render();
}

async function loadAll() {
  chats.setItems(['Loading...']);
  chats.screen.render();

  chats._data.chats = await Chat.getAll();
  display();
}

EE.on('screen.ready', loadAll);
EE.on('screen.refresh', loadAll);
EE.on('input.blur', from => {
  if (from === 'chats') {
    chats.focus();
  }
});
EE.on('threads.blur', () => {
  chats.focus();
});

module.exports = {
  chats,
};
