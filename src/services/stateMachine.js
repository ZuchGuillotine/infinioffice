
const { createMachine, assign } = require('xstate');

const bookingMachine = createMachine({
  id: 'booking',
  initial: 'greet',
  context: {
    service: null,
    timeWindow: null,
    contact: null,
  },
  states: {
    greet: {
      on: {
        HEAR_SPEECH: {
          actions: 'logSpeech',
          target: 'collectService',
        },
      },
    },
    collectService: {
      on: {
        HEAR_SPEECH: {
          actions: assign({ service: (context, event) => event.speech }),
          target: 'collectTimeWindow',
        },
      },
    },
    collectTimeWindow: {
      on: {
        HEAR_SPEECH: {
          actions: assign({ timeWindow: (context, event) => event.speech }),
          target: 'collectContact',
        },
      },
    },
    collectContact: {
      on: {
        HEAR_SPEECH: {
          actions: assign({ contact: (context, event) => event.speech }),
          target: 'confirm',
        },
      },
    },
    confirm: {
      on: {
        HEAR_SPEECH: [
          {
            cond: (context, event) => /yes/i.test(event.speech),
            target: 'book',
          },
          {
            target: 'collectTimeWindow',
          },
        ],
      },
    },
    book: {
      invoke: {
        src: 'createEvent',
        onDone: 'success',
        onError: 'fallback',
      },
    },
    fallback: {},
    success: {},
  },
}, {
  actions: {
    logSpeech: (context, event) => {
      console.log(event.speech);
    },
  },
});

module.exports = {
  bookingMachine,
};
