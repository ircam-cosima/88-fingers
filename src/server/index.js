// enable source-maps in node
import 'source-map-support/register';
import path from 'path';
import * as soundworks from 'soundworks/server';
import PlayerExperience from './PlayerExperience';
import ControllerExperience from './ControllerExperience';
import * as jazz from 'jazz-midi';

const configName = process.env.ENV || 'default';
const configPath = path.join(__dirname, 'config', configName);
let config = null;

// rely on node `require` for synchronicity
try {
  config = require(configPath).default;
} catch(err) {
  console.error(`Invalid ENV "${configName}", file "${configPath}.js" not found`);
  process.exit(1);
}

process.env.NODE_ENV = config.env;

// define labels
const firstNoteNumber = 21;
const numNotes = 88;
const noteNames = {
  0: 'c',
  1: 'c#',
  2: 'd',
  3: 'd#',
  4: 'e',
  5: 'f',
  6: 'f#',
  7: 'g',
  8: 'g#',
  9: 'a',
  10: 'a#',
  11: 'b'
};

function getOctava(midiNote) {
  return Math.floor(midiNote / 12) - 1;
}

function getLabel(midiNote) {
  return `${noteNames[midiNote % 12]}/${getOctava(midiNote)}`;
}

const labels = [];
const midiNotes = [];

for (let i = 0; i < numNotes; i++) {
  const note = i + firstNoteNumber;
  const label = getLabel(note);
  labels.push(label);
  midiNotes.push(note);
}

config.setup.labels = labels;
config.setup.coordinates = midiNotes;

// initialize the server with configuration informations
soundworks.server.init(config);

// define the configuration object to be passed to the `.ejs` template
soundworks.server.setClientConfigDefinition((clientType, config, httpRequest) => {
  return {
    env: config.env,
    clientType: clientType,
    websockets: config.websockets,
    appName: config.appName,
    version: config.version,
    defaultType: config.defaultClient,
    assetsDomain: config.assetsDomain,
  };
});

/********************************************************
 *
 *  configure MIDI interface
 *
 */
const midi = new jazz.MIDI();
const midiOutList = midi.MidiOutList();
let outName = '';
let outIndex = -1;

if (midiOutList.length > 0) {
  console.log('Available MIDI output ports');

  for (let i = 0; i < midiOutList.length; i++) {
    const str = midiOutList[i];
    console.log('  ' + i + ': ' + str);

    if(str.indexOf('Port1') >= 0) {
      outName = str;
      outIndex = i;
      break;
    }
  }

  if (outIndex >= 0) {
    console.log(`Opening MIDI output port ${outIndex} (${outName})`);
    midi.MidiOutOpen(outIndex);
  } else if (midiOutList.length > 0) {
    console.log(`Opening MIDI output port 0 (${midiOutList[0]})`);
    midi.MidiOutOpen(0);
  } else {
    console.log('Failed to open MIDI output');
  }
} else {
  console.log('No MIDI output ports available');
}

// create the common server experience for both the soloists and the players
const controller = new ControllerExperience();
const experience = new PlayerExperience(midiNotes, midi);

// start the application
soundworks.server.start();
