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

// @note : changing `width`(s) here can break position definitions
const keyDefinitions = {
  'w': { height: 12, width: 3, zIndex: 0 },
  'b': { height: 8, width: 2, zIndex: 1 },
};

const unit = 10; // nbr of pixels for 1 unit
const octavaWidth = 21;
const defaultTemplate = `
  <div id="instruction-container" class="flex-middle">
    <p><%= instructions %></p>
  </div>
  <div id="keyboard-nav">
    <div id="cursor"></div>
  </div>
  <div id="keyboard-container">
    <div id="keyboard-layer">

    </div>
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
  instructions: `Select your key`,
  send: `Send`,
  reject: `Sorry, no key is available`,
  showBtn: false,
  rejected: false,
};

class KeyboardView extends SegmentedView {
  constructor(template = defaultTemplate, model = defaultModel, event, options) {
    super(template, model, event, { id: 'keyboard' });

    this.$elementInfosMap = new Map();
    this.$keys = [];
    this.hasSelection = false;
    this.$selectedKey = null;

    this.ratios = {
      '#instruction-container': 0.3,
      '#keyboard-nav': 0.07,
      '#keyboard-container': 0.43,
      '#confirm-container': 0.2,
    };

    this._touchId = null;
    this._cursorX = 0;
    this._startX = 0;
    this._diffX = 0;
    this._startKeyboardX = 0;

    this._isDisplayed = false;

    this._onCursorTouchStart = this._onCursorTouchStart.bind(this);
    this._onCursorTouchMove = this._onCursorTouchMove.bind(this);
    this._onCursorTouchEnd = this._onCursorTouchEnd.bind(this);
    this._onKeyboardTouchStart = this._onKeyboardTouchStart.bind(this);
    this._onKeyboardTouchMove = this._onKeyboardTouchMove.bind(this);
    this._onKeyboardTouchEnd = this._onKeyboardTouchEnd.bind(this);
    this._onSelectionChange = this._onSelectionChange.bind(this);
  }

  updateDisabledPositions(indexes) {
    if (indexes.length === this.$keys.length) {
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

    this.$keys.forEach(($key, index) => {
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

  setArea(area) {}

  displayPositions(capacity, labels = null, coordinates = null, maxClientsPerPosition = 1) {
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


      const $key = document.createElement('div');
      $key.classList.add('key', type);

      $key.style.left = `${x}px`;
      $key.style.top = `0px`;
      $key.style.width = `${width}px`;
      $key.style.height = `${height}px`;
      $key.style.zIndex = zIndex;

      this.$keyboardLayer.appendChild($key);

      this.$elementInfosMap.set($key, {
        index: i,
        label: labels[i],
        coordinates: note,
      });

      this.$keys.push($key);

      // define keyboard size in pixel
      if (type === 'w')
        this.keyboardWidth += width;
    }

    this.installEvents({
      'touchend .key': this._onSelectionChange
    });
  }

  onResize(viewportWidth, viewportHeight, orientation) {
    super.onResize(viewportWidth, viewportHeight, orientation);

    this._updateCursorSize();

    if (!this._isDisplayed) {
      this._onCursorTouchStart(null, Math.random());
      this._isDisplayed = true;
    }
  }

  reject(disabledPositions) {
    this.updateDisabledPositions(disabledPositions);
  }

  setSelectCallack(callback) {
    this._onSelect = callback;
  }

  _updateCursorSize() {
    const screenWidth = this.viewportWidth;
    const height = this.$keyboardNav.getBoundingClientRect().height;

    this._screenToKeyboardRatio = screenWidth / this.keyboardWidth;
    this._cursorWidth = screenWidth * this._screenToKeyboardRatio;

    this.$cursor.style.width = `${this._cursorWidth}px`;
    this.$cursor.style.height = `${height}px`;
    this.$cursor.style.left = `${this._normCursorX * screenWidth}px`;

    if (this._normCursorX) {
      const viewportWidth = this.viewportWidth;
      // update cursor
      let cursorX = (viewportWidth * this._normCursorX);
      cursorX = Math.max(cursorX, 0);
      cursorX = Math.min(cursorX, viewportWidth - this._cursorWidth);

      if (cursorX !== this._cursorX) {
        let keyboardX = -1 * cursorX / this._screenToKeyboardRatio;

        this.$cursor.style.left = `${cursorX}px`;
        this.$keyboardLayer.style.left = `${keyboardX}px`;

        this._cursorX = cursorX;
        this._normCursorX = cursorX / viewportWidth;
      }
    }
  }

  _moveCursor(cursorX) {
    const viewportWidth = this.viewportWidth;

    cursorX = Math.max(cursorX, 0);
    cursorX = Math.min(cursorX, viewportWidth - this._cursorWidth);

    const keyboardX = -1 * cursorX / this._screenToKeyboardRatio;
    this.$cursor.style.left = `${cursorX}px`;
    this.$keyboardLayer.style.left = `${keyboardX}px`;

    this._keyboardX = keyboardX;
    this._cursorX = cursorX;
    this._normCursorX = cursorX / viewportWidth;
  }

  _moveKeyboard(keyboardX) {
    const cursorX = -1 * keyboardX * this._screenToKeyboardRatio;
    this._moveCursor(cursorX);
  }

  _onCursorTouchStart(id, normX, normY, touch, touchEvent) {
    if (this._touchId === null) {
      this._touchId = id;

      const x = this.viewportWidth * normX;
      // if touch is outside cursor, jump to position else do nothing
      if (x < this._cursorX || x > (this._cursorX + this._cursorWidth))
        this._onCursorTouchMove(id, normX, normY);
    }
  }

  _onCursorTouchMove(id, normX, normY, touch, touchEvent) {
    if (this._touchId === id) {
      const halfCursor = this._cursorWidth / 2;
      this._moveCursor(this.viewportWidth * normX - halfCursor);
    }
  }

  _onCursorTouchEnd(id) {
    if (id === this._touchId)
      this._touchId = null;
  }

  _onKeyboardTouchStart(id, x, y, touch, touchEvent) {
    if (this._touchId === null) {
      this._touchId = id;
      this._startX = x;
      this._diffX = 0;
      this._startKeyboardX = this._keyboardX;
    }
  }

  _onKeyboardTouchMove(id, x, y, touch, touchEvent) {
    if (this._touchId === id) {
      const viewportWidth = this.viewportWidth;
      const diffX = x - this._startX;

      this._moveKeyboard(this._startKeyboardX + diffX);
      this._diffX = diffX;
    }
  }

  _onKeyboardTouchEnd(id) {
    if (id === this._touchId) {
      this._touchId = null;
    }
  }

  _onSelectionChange(e) {
    const $key = e.target;

    if (this._diffX === 0) {
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