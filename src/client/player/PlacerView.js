import { View, SegmentedView, TouchSurface } from 'soundworks/client';

const keyboardDef = {
  0: { type: 'w', position: 0 },
  1: { type: 'b', position: 2 },
  2: { type: 'w', position: 3 },
  3: { type: 'b', position: 5 },
  4: { type: 'w', position: 6 },
  5: { type: 'w', position: 9 },
  6: { type: 'b', position: 11 },
  7: { type: 'w', position: 12 },
  8: { type: 'b', position: 14 },
  9: { type: 'w', position: 15 },
  10: { type: 'b', position: 17 },
  11: { type: 'w', position: 18 },
};

const whiteKeyHeight = 12; // in units
const whiteKeyWidth = 3; // in units
const blackKeyHeight = 2 * whiteKeyHeight / 3; // in units
const blackKeyWidth = 2 * whiteKeyWidth / 3; // in units
const preferedUnit = 16;

// @note : changing `width`(s) here can break position definitions
const keyDefinitions = {
  'w': { height: whiteKeyHeight, width: whiteKeyWidth, zIndex: 0 },
  'b': { height: blackKeyHeight, width: blackKeyWidth, zIndex: 1 },
};

const octavaWidth = 21;
const defaultTemplate = `
  <div id="instruction-container" class="flex-middle">
    <p><%= instructions %></p>
  </div>
  <div id="keyboard-container">
    <div id="keyboard-nav"><div id="cursor"></div></div>
    <div id="keyboard-layer"></div>
  </div>
  <div id="messages">
    <div id="confirm-container" class="flex-middle">
    <% if (!rejected && showBtn) { %>
      <button class="btn"><%= send %></button>
    <% } %>
    </div>
    <div id="reject" class="flex-middle<% if (rejected) { %> fit-container<% } %>">
      <% if (rejected) { %>
      <p><%= reject %></p>
      <% } %>
    </div>
  </div>
`;

const defaultModel = {
  instructions: `Claim your key`,
  send: `Select`,
  reject: `Sorry, no key is available`,
  showBtn: false,
  rejected: false,
};

class KeyboardView extends SegmentedView {
  constructor(template = defaultTemplate, model = defaultModel, event, options) {
    super(template, model, event, { id: 'keyboard' });

    this.ratios = {
      '#instruction-container': 0.2,
      '#keyboard-container': 0.6,
      '#confirm-container': 0.2,
    };

    this.$elementInfosMap = new Map();
    this.$selectedKey = null;
    this.hasSelection = false;

    this._keys = [];
    this._coordinates = null;
    this._unit = preferedUnit;

    this._viewportWidth = null;
    this._touchId = null;
    this._cursorX = 0;
    this._diffX = 0;
    this._startKeyboardX = 0;
    this._keyboardX = 0;

    this._listersRegistered = false;

    this._onCursorTouchStart = this._onCursorTouchStart.bind(this);
    this._onCursorTouchMove = this._onCursorTouchMove.bind(this);
    this._onCursorTouchEnd = this._onCursorTouchEnd.bind(this);
    this._onKeyboardTouchStart = this._onKeyboardTouchStart.bind(this);
    this._onKeyboardTouchMove = this._onKeyboardTouchMove.bind(this);
    this._onKeyboardTouchEnd = this._onKeyboardTouchEnd.bind(this);
    this._onSelectionChange = this._onSelectionChange.bind(this);
    this._animateKeyboard = this._animateKeyboard.bind(this);
  }

  updateDisabledPositions(indexes) {
    if (indexes.length === this._keys.length) {
      this.model.rejected = true;
    } else {
      // if previously rejected, reset everything
      const position = this.$elementInfosMap.get(this.$selectedKey);

      if (this.model.rejected || (position && indexes.indexOf(position.index) !== -1)) {
        this.$selectedKey = null;
        this.model.showBtn = false;
        this.hasSelection = false;
      }

      this.model.rejected = false;
    }

    this.render('#messages');

    this._keys.forEach(($key, index) => {
      const isDisabled = (indexes.indexOf(index) !== -1);

      if (isDisabled) {
        if ($key.classList.contains('selected'))
          $key.classList.remove('selected');

        $key.classList.add('disabled');
      } else if ($key.classList.contains('disabled')) {
        $key.classList.remove('disabled');
      }
    });
  }

  onRender() {
    super.onRender();

    if (!this._listersRegistered) {
      this._listersRegistered = true;

      this.$keyboardContainer = this.$el.querySelector('#keyboard-container');
      this.$keyboardLayer = this.$el.querySelector('#keyboard-layer');
      this.$keyboardNav = this.$el.querySelector('#keyboard-nav');
      this.$cursor = this.$el.querySelector('#cursor');

      this.navSurface = new TouchSurface(this.$keyboardNav);
      this.navSurface.addListener('touchstart', this._onCursorTouchStart);
      this.navSurface.addListener('touchmove', this._onCursorTouchMove);
      this.navSurface.addListener('touchend', this._onCursorTouchEnd);

      this.keySurface = new TouchSurface(this.$keyboardLayer, { normalizeCoordinates: false });
      this.keySurface.addListener('touchstart', this._onKeyboardTouchStart);
      this.keySurface.addListener('touchmove', this._onKeyboardTouchMove);
      this.keySurface.addListener('touchend', this._onKeyboardTouchEnd);
    }
  }

  setArea(area) {}

  displayPositions(capacity, labels = null, coordinates = null, maxClientsPerPosition = 1) {
    let octavaCount = 0;

    this._coordinates = coordinates;
    this._keys = [];
    this.$keyboardLayer.innerHTML = "";

    for (let i = 0; i < coordinates.length; i++) {
      const note = coordinates[i];
      const normNote = note % 12;
      const type = keyboardDef[normNote].type;

      if (normNote === 0)
        octavaCount += 1;

      const $key = document.createElement('div');
      $key.classList.add('key', type);

      if (normNote === 0) {
        const $label = document.createElement('div');

        $label.classList.add('key-label');
        $label.innerHTML = `C${octavaCount}`;

        $key.appendChild($label);
      }

      this.$keyboardLayer.appendChild($key);
      this._keys.push($key);

      this.$elementInfosMap.set($key, {
        index: i,
        label: labels[i],
        coordinates: note,
      });
    }

    this.installEvents({
      'touchend .key': this._onSelectionChange
    });

    this._updateKeyboardSize();
  }

  onResize(viewportWidth, viewportHeight, orientation) {
    super.onResize(viewportWidth, viewportHeight, orientation);

    if (viewportWidth !== this._viewportWidth) {
      const needsInitialPosition = (this._viewportWidth === null);
      this._viewportWidth = viewportWidth;

      this._updateKeyboardSize();
      this._updateSize();

      if (needsInitialPosition)
        this._onCursorTouchStart(null, Math.random());
    }
  }

  reject(disabledPositions) {
    this.updateDisabledPositions(disabledPositions);
  }

  setSelectCallack(callback) {
    this._onSelect = callback;
  }

  _updateSize() {
    const viewportWidth = this._viewportWidth;
    const navRect = this.$keyboardNav.getBoundingClientRect();
    const navWidth = navRect.width;
    const navHeight = navRect.height;
    const keyboardHeight = this.$keyboardContainer.getBoundingClientRect().height;
    const maxHeight = keyboardHeight - navHeight;
    let maxWidth = navWidth * 8;
    let unit = preferedUnit;

    this._screenToKeyboardRatio = viewportWidth / this.keyboardWidth;
    this._cursorWidth = viewportWidth * this._screenToKeyboardRatio;

    this.$cursor.style.width = `${this._cursorWidth}px`;
    this.$cursor.style.left = `${this._normCursorX * viewportWidth}px`;

    let keyWidth = whiteKeyWidth * unit;

    if (keyWidth > maxWidth)
      unit = keyWidth / whiteKeyWidth;

    let keyHeight = whiteKeyHeight * unit;

    if (keyHeight > maxHeight)
      unit = maxHeight / whiteKeyHeight;

    this._unit = unit;

    const margin = (maxHeight - keyHeight) / 2;
    this.$keyboardNav.style.top = `${margin}px`;;
    this.$keyboardLayer.style.top = `${margin + navHeight}px`;

    if (this._normCursorX)
      this._moveCursor(this._normCursorX * this._viewportWidth);
  }

  _updateKeyboardSize() {
    const coordinates = this._coordinates;
    const unit = this._unit;
    let offset = 0;
    let octavaCount = 0;

    this.keyboardWidth = 0;

    for (let i = 0; i < coordinates.length; i++) {
      const note = coordinates[i];
      const normNote = note % 12;
      const { type, position } = keyboardDef[normNote];
      const { width: keyWidth, height: keyHeight, zIndex } = keyDefinitions[type];

      if (i === 0)
        offset = position;

      if (normNote === 0)
        octavaCount += 1;

      let x = (position + (octavaWidth * octavaCount) - offset) * unit;
      if (type === 'b')
        x -= 1;

      const width = keyWidth * unit;
      const height = keyHeight * unit;

      const $key = this._keys[i];

      $key.style.left = `${x}px`;
      $key.style.top = `0px`;
      $key.style.width = `${width}px`;
      $key.style.height = `${height}px`;
      $key.style.zIndex = zIndex;

      // define keyboard size in pixel
      if (type === 'w')
        this.keyboardWidth += width;
    }
  }

  _moveCursor(cursorX) {
    const viewportWidth = this._viewportWidth;

    cursorX = Math.max(cursorX, 0);
    cursorX = Math.min(cursorX, viewportWidth - this._cursorWidth);

    if (cursorX !== this._cursorX) {
      const keyboardX = -1 * cursorX / this._screenToKeyboardRatio;
      this.$cursor.style.left = `${cursorX}px`;
      this.$keyboardLayer.style.left = `${keyboardX}px`;

      this._keyboardX = keyboardX;
      this._cursorX = cursorX;
      this._normCursorX = cursorX / viewportWidth;
    }
  }

  _moveKeyboard(keyboardX) {
    const cursorX = -1 * keyboardX * this._screenToKeyboardRatio;
    this._moveCursor(cursorX);
  }

  _onCursorTouchStart(id, normX, normY, touch, touchEvent) {
    if (this._touchId === null) {
      this._touchId = id;

      const x = this._viewportWidth * normX;
      // if touch is outside cursor, jump to position else do nothing
      if (x < this._cursorX || x > (this._cursorX + this._cursorWidth))
        this._onCursorTouchMove(id, normX, normY);
    }
  }

  _onCursorTouchMove(id, normX, normY, touch, touchEvent) {
    if (this._touchId === id) {
      const cursorX = this._viewportWidth * normX - this._cursorWidth / 2;
      this._moveCursor(cursorX);
    }
  }

  _onCursorTouchEnd(id) {
    if (id === this._touchId)
      this._touchId = null;
  }

  _onKeyboardTouchStart(id, x, y, touch, touchEvent) {
    if (this._touchId === null) {
      this._touchId = id;
      this._touchX = x;
      this._touchMove = false;
      this._diffX = 0;
      this._startKeyboardX = this._keyboardX;
    }
  }

  _onKeyboardTouchMove(id, x, y, touch, touchEvent) {
    if (this._touchId === id) {
      const diffX = x - this._touchX;
      this._moveKeyboard(this._keyboardX + diffX);
      this._diffX = diffX;
      this._touchX = x;
      this._touchMove = true;
    }
  }

  _onKeyboardTouchEnd(id, x, y, touch, touchEvent) {
    if (id === this._touchId) {
      this._touchId = null;
      requestAnimationFrame(this._animateKeyboard);
    }
  }

  _animateKeyboard() {
    if (this._touchId === null) {
      const diffX = 0.9 * this._diffX;

      if (Math.abs(diffX) >= 1) {
        this._moveKeyboard(this._keyboardX + diffX);
        requestAnimationFrame(this._animateKeyboard);
      }

      this._diffX = diffX;
    }
  }

  _onSelectionChange(e) {
    const $key = e.target;

    if (!this._touchMove) {
      if ($key.classList.contains('disabled'))
        return;

      if (this.$selectedKey)
        this.$selectedKey.classList.remove('selected');

      $key.classList.add('selected');
      this.$selectedKey = $key;

      if (!this.hasSelection) {
        this.model.showBtn = true;
        this.render('#confirm-container');

        this.installEvents({
          'touchstart .btn': (e) => {
            const position = this.$elementInfosMap.get(this.$selectedKey);

            if (position)
              this._onSelect(position.index, position.label, position.coordinates);
          }
        });

        this.hasSelection = true;
      }
    }
  }
}

export default KeyboardView;