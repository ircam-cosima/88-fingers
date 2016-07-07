import { Experience } from 'soundworks/server';
import scoreRecorder from './scoreRecorder';

// server-side 'player' experience.
export default class PlayerExperience extends Experience {
  constructor(midiNotes, midi) {
    super('player');

    this.midiNotes = midiNotes;
    this.noteIsOn = [];
    this.midi = midi;

    this.params = this.require('shared-params');
    this.config = this.require('shared-config');
    this.placer = this.require('placer');

    this.onPanic = this.onPanic.bind(this);
    this.onStateChange = this.onStateChange.bind(this);
  }

  // if anything needs to append when the experience starts
  start() {
    this.params.addParamListener('panic', this.onPanic);
    this.params.addParamListener('state', this.onStateChange);

    scoreRecorder.init(this.config.get('scoreRecordDirectory'));
  }

  // if anything needs to happen when a client enters the performance (*i.e.*
  // starts the experience on the client side), write it in the `enter` method
  enter(client) {
    super.enter(client);

    this.receive(client, 'note-on', (intensity, deltaNoteOnTime) => {
      const index = client.index;
      const pitch = this.midiNotes[index];

      const velocity = Math.floor(1 + 127 * intensity);
      this.noteOn(pitch, velocity);
    });

    this.receive(client, 'note-off', (duration) => {
      const index = client.index;
      const pitch = this.midiNotes[index];
      this.noteOff(pitch);
      this.noteIsOn[index] = false;
    });

    this.params.update('numPlayers', this.clients.length);
  }

  exit(client) {
    super.exit(client);

    const index = client.index;
    const pitch = this.midiNotes[index];

    this.noteOff(pitch);
    this.params.update('numPlayers', this.clients.length);
  }

  noteOn(pitch, velocity) {
    if(this.noteIsOn[pitch])
      this.noteOff(pitch);

    this.midi.MidiOut(144, pitch, velocity);
    this.noteIsOn[pitch] = true;

    console.log("note on:", pitch, velocity);
    scoreRecorder.record('note-on', pitch, velocity);
  }

  noteOff(pitch) {
    this.midi.MidiOut(128, pitch, 64);
    this.noteIsOn[pitch] = false;

    //console.log("note off:", pitch);
    scoreRecorder.record('note-off', pitch);
  }

  onStateChange(state) {
    if (state === 'running')
      scoreRecorder.start();
  }

  onPanic() {
    this.midiNotes.forEach((pitch) => this.noteOff(pitch));
  }
}
