import 'source-map-support/register'; // enable sourcemaps in node
import * as soundworks from 'soundworks/server';
import * as midi from 'midi';
import PlayerExperience from './PlayerExperience';
import defaultConfig from './config/default';

let config = null;

switch(process.env.ENV) {
  default:
    config = defaultConfig;
    break;
}


// define labels /
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
// initialize application with configuration options
soundworks.server.init(config);

// define the configuration object to be passed to the `.ejs` template
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

// open midi interface
const midiOutput = new midi.output();
const portCount = midiOutput.getPortCount();
let portName = '';
let portIndex = -1;

for(let i = 0; i < portCount; i++) {
  const str = midiOutput.getPortName(i);
  console.log('MIDI port', i.toString() + ':', str);

  if(str.indexOf('MIDI') >= 0) {
    portName = str;
    portIndex = i;
    break;
  }
}

if(portIndex >= 0) {
  console.log('Opening MIDI port', portIndex.toString() + ':', portName);
}

const experience = new PlayerExperience('player');

// start application
soundworks.server.start();
