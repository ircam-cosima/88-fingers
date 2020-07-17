import fse from 'fs-extra';
import path from 'path';

function padLeft(str, value, length) {
  str = str + '';
  while (str.length < length) { str = value + str; }
  return str;
}

const recorder = {
  init(directory) {
    const date = new Date();
    const now = new Date();
    const year = padLeft(now.getFullYear(), 0, 4);
    const month = padLeft(now.getMonth() + 1, 0, 2);
    const day = padLeft(now.getDate(), 0, 2);
    const hours = padLeft(now.getHours(), 0, 2);
    const minutes = padLeft(now.getMinutes(), 0, 2);
    const filename = `${year}${month}${day}-${hours}${minutes}.txt`;
    this.path = path.join(directory, filename);

    fse.ensureFileSync(this.path);
    this.writable = fse.createWriteStream(this.path);

    this._tick = this._tick.bind(this);
    // init buffering and flushing
    this.writable.cork();
    this._tick();
  },

  start() {
    this._startTime = process.hrtime();
    console.log('recorder:startTime', this._startTime);
  },

  record(type, pitch, velocity = 64) {
    let cmd;
    if (type === 'note-on')
      cmd = 144;
    else if (type === 'note-off')
      cmd = 128;

    const diff = process.hrtime(this._startTime);
    const time = diff[0] + (diff[1] * 1e-9);
    const msg = `${time}\t${cmd}\t${pitch}\t${velocity}\n`;
    this.writable.write(msg);
  },

  _tick() {
    this.writable.uncork();
    this.writable.cork();

    setTimeout(this._tick, 500);
  },
};

export default recorder;