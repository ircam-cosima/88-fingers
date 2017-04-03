import * as d3 from 'd3';

const dataSrc = 'assets/20170316-1650.txt';
// const dataSrc = 'assets/20160915-1517.txt';

d3.tsv(dataSrc)
  .row((d, i) => {
    return {
      time: parseFloat(d.time),
      action: parseInt(d.action) === 144 ? 'noteon' : 'noteoff',
      midinote: parseInt(d.midinote, 10),
      velocity: parseInt(d.velocity, 10),
    };
  })
  .get(display);

function display(data) {
  console.log(data.length);

  const padding = 10;
  const length = data.length;
  const width = window.innerWidth;
  const height = window.innerHeight;
  // time boundaries
  let startTime = +Infinity;
  let endTime = -Infinity;

  for (let i = 0; i < data.length; i++) {
    if (data[i].time < startTime)
      startTime = data[i].time;

    if (data[i].time > endTime)
      endTime = data[i].time;
  }

  const xScale = d3.scaleLinear()
    .domain([startTime, endTime])
    .range([padding, width - 2 * padding]);

  const yScale = d3.scaleLinear()
    .domain([21, 108])
    .range([padding, height - 2 * padding]);

  const radiusScale = d3.scaleLinear()
    .domain([0, 127])
    .range([0, 2]);

  const opacityScale = d3.scaleLinear()
    .domain([0, 127])
    .range([0, 0.5]);

  const svg = d3.select('svg')
    .attr('width', width)
    .attr('height', height);

  const circles = svg
    .selectAll('circle')
    .data(data)
    .enter()
    .filter((d) => d.action === 'noteon')
    .append('circle')
      .attr('fill', '#ffffff')
      .attr('cx', (d) => xScale(d.time))
      .attr('cy', (d) => yScale(d.midinote))
      .attr('r', (d) => radiusScale(d.velocity))
      .style('opacity', (d) => opacityScale(d.velocity));
}
