import * as soundworks from 'soundworks/client';
import PlacerView from './PlacerView';
import userTiming from './user-timing';
import DeferService from '../shared/DeferService';
import Vex from './vexflow-min.js';

const audioContext = soundworks.audioContext;
const client = soundworks.client;

const template = `
  <div class="fit-container background"></div>
  <div class="fit-container wrapper <%= state %>">
    <% if (state === 'wait' || state === 'running') { %>
      <% if (state === 'wait') { %>
        <p class="message wait">Please wait</p>
      <% } %>
      <div id="intensity">
        <p class="forte">fff</p>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="0" y1="0" x2="50" y2="100" />
          <line x1="50" y1="100" x2="100" y2="0" />
        </svg>
        <p class="piano">ppp</p>
      </div>
      <canvas id="note"></canvas>
    <% } else { %>
      <p class="message">Thanks!</p>
    <% } %>
  </div>
`;

class PlayerView extends soundworks.View {
  constructor(template, model, events, options) {
    super(template, model, events, options);

    this.$canvas = null;
    this.$background = null;
    this._label = null;
  }

  onRender() {
    super.onRender();

    this.$canvas = this.$el.querySelector('#note');
    this.$background = this.$el.querySelector('.background');

    if (this._label && this.$canvas)
      this.displayNote();
  }

  setState(state) {
    if (state !== this.model.state) {
      this.model.state = state;
      this.render('.wrapper');
    }
  }

  setLabel(label) {
    this._label = label;
  }

  noteOn(value) {
    value = 0.1 + value * 0.9;
    this.$background.style.opacity = value;
  }

  noteOff() {
    this.$background.style.opacity = 0;
  }

  displayNote() {
    const label = this._label;
    const octava = parseInt(label.split('/')[1]);
    const clef = octava < 4 ? 'bass' : 'treble';

    const w = 100;
    const h = 260;

    const ctx = this.$canvas.getContext('2d');
    ctx.canvas.width = w;
    ctx.canvas.height = h;

    const renderer = new Vex.Flow.Renderer(this.$canvas, Vex.Flow.Renderer.Backends.CANVAS);
    const stave = new Vex.Flow.Stave(0, 80, 100, { fill_style: '#000000' });

    stave.addClef(clef);
    stave.setContext(ctx).draw();

    const note = new Vex.Flow.StaveNote({
      keys: [label],
      duration: "1",
      clef: clef,
    });

    if (/#/.test(label))
      note.addAccidental(0, new Vex.Flow.Accidental('#'))

    Vex.Flow.Formatter.FormatAndDraw(ctx, stave, [note]);

    // invert colors and shift image in y axis
    const imageData = ctx.getImageData(0, 0, 100, 260);
    const data = imageData.data;
    let lastDrawnPixelIndex = null;

    for (let i = 0; i < data.length; i += 4) {
      // if the pixel is not transparent
      if (data[i + 3] !== 0)
        lastDrawnPixelIndex = i;

      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }

    // define line of the last pixel (4 values per pixels * 100 pixels per lines)
    const line = Math.ceil(lastDrawnPixelIndex / (4 * w));
    const yShift = h - line;

    ctx.clearRect(0, 0, w, h);
    ctx.putImageData(imageData, 0, yShift);
  }
}

// this experience plays a sound when it starts, and plays another sound when
// other clients join the experience
class PlayerExperience extends soundworks.Experience {
  constructor() {
    super();

    this.platform = this.require('platform', { /*features: ['wake-lock']*/ });
    this.placer = this.require('placer');
    this.sharedParams = this.require('shared-params');

    this.placer.view = new PlacerView();

    // this.defer = this.require('defer', { service: 'placer' });
    // setTimeout(() => { this.defer.ready(); }, 10000);

    this.noteIsOn = false;
    this.lastNoteOnTime = -999999;
    this.fingersDown = new Set();

    this._handleTouchStart = this._handleTouchStart.bind(this);
    this._handleTouchEnd = this._handleTouchEnd.bind(this);
  }

  set state(state) {
    this.view.setState(state);

    if (state === 'running') {
      this.surface.addListener('touchstart', this._handleTouchStart);
      this.surface.addListener('touchend', this._handleTouchEnd);
    } else {
      this.surface.removeListener('touchstart', this._handleTouchStart);
      this.surface.removeListener('touchend', this._handleTouchEnd);
    }
  }

  _handleTouchStart(id, normX, normY, touch, touchEvent) {
    const now = performance.now();
    const scaledY = (0.9 - normY) / 0.8;
    const intensity = Math.max(0, Math.min(0.999, scaledY));
    this.send('note-on', intensity, now - this.lastNoteOnTime);

    this.fingersDown.add(id);
    this.noteIsOn = true;
    this.lastNoteOnTime = now;
    this.view.noteOn(intensity);
  }

  _handleTouchEnd(id, normX, normY) {
    this.fingersDown.delete(id);

    if (this.noteIsOn && this.fingersDown.size === 0) {
      const now = performance.now();

      this.send('note-off', now - this.lastNoteOnTime);
      this.noteIsOn = false;
      this.view.noteOff();
    }
  }

  start() {
    super.start(); // don't forget this

    this.view = new PlayerView(template, { state: 'wait' }, {}, { 
      id: 'player',
      preservePixelRatio: true,
    });
    this.view.setLabel(client.label);

    this.show().then(() => {
      this.surface = new soundworks.TouchSurface(this.view.$el);
      this.sharedParams.addParamListener('state', (state) => this.state = state);
    });
  }
}

export default PlayerExperience;