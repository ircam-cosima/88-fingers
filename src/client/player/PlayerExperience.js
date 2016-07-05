import * as soundworks from 'soundworks/client';
import PlacerView from './PlacerView';
import userTiming from './user-timing';

const audioContext = soundworks.audioContext;

const viewTemplate = `
  <canvas class="background"></canvas>
  <div class="foreground">
    <div class="section-top flex-middle"></div>
    <div class="section-center flex-center">
    <% if (state === 'wait') { %>
      <p>Attend!</p>
    <% } else if (state === 'running') { %>
      <p>Vas y!</p>
    <% } else { %>
      <p>Merci!</p>
    <% } %>
    </div>
    <div class="section-bottom flex-middle"></div>
  </div>
`;

// this experience plays a sound when it starts, and plays another sound when
// other clients join the experience
export default class PlayerExperience extends soundworks.Experience {
  constructor() {
    super();

    this.platform = this.require('platform', { features: ['wake-lock'] });
    this.placer = this.require('placer', {
      view: new PlacerView(),
    });
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
    this.viewCtor = soundworks.CanvasView;
    this.viewOptions = { preservePixelRatio: true };
    this.view = this.createView();
  }

  set state(state) {
    this.viewContent.state = state;
    this.view.render('.section-center');

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

    this.surface = new soundworks.TouchSurface(this.view.$el);
    this.params.addParamListener('state', (state) => this.state = state);
  }
}
