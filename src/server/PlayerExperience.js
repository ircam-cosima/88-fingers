import { Experience } from 'soundworks/server';

// server-side 'player' experience.
export default class PlayerExperience extends Experience {
  constructor(midiNotes, midiOutput) {
    super('player');

    this.midiNotes = midiNotes;
    this.midiOutput = midiOutput;

    this.params = this.require('shared-params');
    this.checkin = this.require('checkin');
  }

  // if anything needs to append when the experience starts
  start() {}

  // if anything needs to happen when a client enters the performance (*i.e.*
  // starts the experience on the client side), write it in the `enter` method
  enter(client) {
    super.enter(client);

    this.receive(client, 'note-on', (intensity, deltaNoteOnTime) => {
      const note = 60 + client.index;
      const velocity = Math.floor(128 * intensity);
      const message = [128, note, velocity];
      this.midiOutput.sendMessage(message);

      console.log("note on:", message);
    });

    this.receive(client, 'note-off', (duration) => {
      const note = 60 + client.index;
      const message = [144, note, 64];
      this.midiOutput.sendMessage(message);

      console.log("note off:", message);
    });
  }

  exit(client) {
    super.exit(client);
    // ...
  }
}
