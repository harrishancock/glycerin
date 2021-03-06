const getChats = require('../api/get-chats');
const getChatThreads = require('../api/get-chat-threads');
const getChatMessages = require('../api/get-chat-messages');
const getThreadMessages = require('../api/get-thread-messages');
const unpack = require('../api/unpack');
const User = require('./user');

// indexed by unpack.room.uri
const cache = {};

/**
 * Give me all my chats, please
 * broken up into sections:
 *   - favorites (starred)
 *   - dms
 *   - rooms
 *   - bots
 *
 * @see unpack.chats
 */
function getAll() {
  return getChats()
    .then(unpack.chats)
    .then(chats => {
      // eslint-disable-next-line no-unused-vars
      for (let [type, group] of Object.entries(chats)) {
        group.forEach(chat => {
          cache[chat.uri] = chat;
          if (chat.isDm) {
            User.prefetch(chat.user);
          }
        });
      }

      return chats;
    });
}

/**
 * fetch threads from a chat, allows cache busting
 * without any paging returns the 5 most recently active threads
 * also includes the first ~10 messages of a thread. to laod more @see messages()
 *
 * @TODO support paging
 *
 * @param {unpack.chat} chat
 * @param {Boolean} ignoreCache
 *
 * @return {Boolean|unpack.thread}
 */
async function threads(chat, ignoreCache = false) {
  if (chat.isDm) {
    throw new Error(`threads called on a dm ${chat.displayName}`);
  }

  if (!cache[chat.uri].threads || ignoreCache) {
    cache[chat.uri].threads = await getChatThreads(chat).then(ts => {
      const unpacked = ts.map(unpack.thread).filter(t => !t.isMembershipUpdate);
      // we have to let the users cache know about all the users we just saw
      // so that when we go to display them we fetch all at once
      unpacked.forEach(t => t.messages.forEach(m => User.prefetch(m.user)));

      // index threads by id
      return unpacked.reduce((a, c) => {
        a[c.id] = c;
        return a;
      }, {});
    });
  }

  return cache[chat.uri].threads;
}

/**
 * fetch more messages for a thread.
 * updates cached thread
 *
 * @param {unpack.chat|unpack.thread} chat
 * @param {Boolean} force
 */
async function messages(chat, ignoreCache = false) {
  if (chat.isDm) {
    if (!cache[chat.uri].messages || ignoreCache) {
      cache[chat.uri].messages = await getChatMessages(chat).then(
        rawMessages => {
          // each "message" looks like a single-message thread
          // so... let's flatten that
          const unpacked = rawMessages.map(m => unpack.message(m[4][0]));
          unpacked.forEach(u => User.prefetch(u.user));

          return unpacked;
        }
      );
    }

    return cache[chat.uri].messages;
  }

  // we're dealing with a thread
  // NOTE: the assumption that thread() has been called above to load this thread
  if (!cache[chat.room.uri].threads[chat.id].messages || ignoreCache) {
    // we're passed an unpack.thread
    cache[chat.room.uri].threads[chat.id].messages = await getThreadMessages(
      chat
    ).then(rawMessages => {
      const messages = rawMessages.map(unpack.message);
      messages.forEach(m => User.prefetch(m.user));

      if (messages.length === cache[chat.room.uri].threads[chat.id].total) {
        cache[chat.room.uri].threads[chat.id].unfetched = 0;
      }

      return messages;
    });
  }

  return cache[chat.room.uri].threads[chat.id].messages;
}

module.exports = {
  getAll,
  threads,
  messages,
};
