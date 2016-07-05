import 'source-map-support/register'; // enable sourcemaps in node
import * as soundworks from 'soundworks/server';
import * as jazz from 'jazz-midi';
import PlayerExperience from './PlayerExperience';
import defaultConfig from './config/default';

let config = null;

switch(process.env.ENV) {
  default:
    config = defaultConfig;
    break;
}

// define labels
const firstNoteNumber = 21;
const numberOfNotes = 88;
const noteNames = {
  0: 'do',
  1: 'do#',
  2: 'ré',
  3: 'ré#',
  4: 'mi',
  5: 'fa',
  6: 'fa#',
  7: 'sol',
  8: 'sol#',
  9: 'la',
  10: 'la#',
  11: 'si'
};

function getOctava(midiNote) {
  return Math.floor(midiNote / 12) - 1;
}

function getLabel(midiNote) {
  return `${noteNames[midiNote % 12]} - ${getOctava(midiNote)}`;
}

const labels = [];
const midiNotes = [];

for (let i = 0; i < numberOfNotes; i++) {
  const note = i + firstNoteNumber;
  const label = getLabel(note);
  labels.push(label);
  midiNotes.push(note);
}

config.setup.labels = labels;
config.setup.coordinates = midiNotes;

// configure express environment ('production' enables cache systems)
process.env.NODE_ENV = config.env;

soundworks.server.init(config);
soundworks.server.setClientConfigDefinition((clientType, config, httpRequest) => {
  return {
    clientType: clientType,
    env: config.env,
    appName: config.appName,
    socketIO: config.socketIO,
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
let iacName = '';
let iacIndex = -1;

if(midiOutList.length > 0) {
  console.log('Available MIDI output ports');

  for(let i = 0; i < midiOutList.length; i++) {
    const str = midiOutList[i];
    console.log('  ' + i + ': ' + str);

    if(str.indexOf('Port1') >= 0) {
      outName = str;
      outIndex = i;
      break;
    }

    if(str.indexOf('IAC') >= 0 || str.indexOf('Bus') >= 0) {
      iacName = str;
      iacIndex = i;
      break;
    }
  }

  if(outIndex >= 0) {
    console.log('Opening MIDI output port ' + outIndex.toString() + ' (' + outName + ')');
    midi.MidiOutOpen(outIndex);
  } else if (iacIndex) {
    console.log('Opening MIDI output port ' + iacIndex.toString() + ' (' + iacName + ')');
    midi.MidiOutOpen(iacIndex);
  } else {
    console.log('Failed to open MIDI output');
  }
} else {
  console.log('No MIDI output ports available');
}

/********************************************************
 *
 *  setup shared parameters, controller, and player
 *
 */
const sharedParams = soundworks.server.require('shared-params');
sharedParams.addText('numPlayers', 'num players', 0, ['controller']);
sharedParams.addEnum('state', 'state', ['wait', 'running', 'end'], 'wait');
sharedParams.addTrigger('panic', 'all notes off');

const controller = new soundworks.BasicSharedController('controller');
const experience = new PlayerExperience(midiNotes, midi);

// start application
soundworks.server.start();
