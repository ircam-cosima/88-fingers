import * as soundworks from 'soundworks/client';
import PlacerView from './PlacerView';
import userTiming from './user-timing';
import Vex from 'vexflow';

const audioContext = soundworks.audioContext;
const client = soundworks.client;

const viewTemplate = `
  <div class="fit-container wrapper">
    <% if (state === 'wait') { %>
      <p class="message">Attendez !</p>
    <% } else if (state === 'running') { %>
      <div id="intensity">
        <p class="forte">fff</p>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="0" y1="0" x2="50" y2="100" />
          <line x1="50" y1="100" x2="100" y2="0" />
        </svg>
        <p class="piano">ppp</p>
      </div>
    <% } else { %>
      <p class="message">Merci !</p>
    <% } %>

    <canvas id="note" width="100" height="260"></canvas>
  </div>
`;

class PlayerView extends soundworks.View {
  onRender() {
    super.onRender();

    this.$canvas = this.$el.querySelector('#note');

    if (this._label)
      this.displayNote();
  }

  setLabel(label) {
    this._label = label;
  }

  noteOn() {
    this.$el.classList.add('active');
  }

  noteOff() {
    this.$el.classList.remove('active');
  }

  displayNote() {
    const label = this._label;
    const octava = parseInt(label.split('/')[1]);
    const clef = octava < 4 ? 'bass' : 'treble';
    const renderer = new Vex.Flow.Renderer(this.$canvas,
      Vex.Flow.Renderer.Backends.CANVAS);

    const ctx = this.$canvas.getContext('2d');

    const stave = new Vex.Flow.Stave(0, 80, 100, {
      fill_style: '#353535',
    });

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
  }
}

// this experience plays a sound when it starts, and plays another sound when
// other clients join the experience
export default class PlayerExperience extends soundworks.Experience {
  constructor() {
    super();

    this.platform = this.require('platform', { features: ['wake-lock'] });
    this.placer = this.require('placer', { view: new PlacerView() });
    this.params = this.require('shared-params');

    this.noteIsOn = false;
    this.lastNoteOnTime = -999999;
    this.fingersDown = new Set();

    this._handleTouchStart = this._handleTouchStart.bind(this);
    this._handleTouchEnd = this._handleTouchEnd.bind(this);
  }

  init() {
    // initialize the view
    this.viewTemplate = viewTemplate;
    this.viewContent = { state: 'wait' };
    this.viewCtor = PlayerView;
    this.viewOptions = { preservePixelRatio: true };
    this.view = this.createView();
  }

  set state(state) {
    this.viewContent.state = state;
    this.view.render();

    if(state === 'running') {
      this.surface.addListener('touchstart', this._handleTouchStart);
      this.surface.addListener('touchend', this._handleTouchEnd);
    } else {
      this.surface.removeListener('touchstart', this._handleTouchStart);
      this.surface.removeListener('touchend', this._handleTouchEnd);
    }
  }

  _handleTouchStart(id, normX, normY) {
    const now = performance.now();
    const intensity = Math.min(0.999, 1 - normY);
    this.send('note-on', 1 - normY, now - this.lastNoteOnTime);

    this.fingersDown.add(id);
    this.noteIsOn = true;
    this.lastNoteOnTime = now;
  }

  _handleTouchEnd(id, normX, normY) {
    this.fingersDown.delete(id);

    if(this.noteIsOn && this.fingersDown.size === 0) {
      const now = performance.now();
      this.send('note-off', now - this.lastNoteOnTime);
      this.noteIsOn = false;
    }
  }

  start() {
    super.start(); // don't forget this

    if (!this.hasStarted)
      this.init();

    this.show();

    this.view.setLabel(client.label);
    this.surface = new soundworks.TouchSurface(this.view.$el);
    this.params.addParamListener('state', (state) => this.state = state);
  }
}
